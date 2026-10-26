'use strict';

const fs = require('fs');
const path = require('path');
const { readFileSafe } = require('../utils');
const { saveFeatureContext } = require('../state');
const { parseTasksFromMarkdown } = require('./brief');

/**
 * Lee context.json de la funcionalidad o retorna un objeto vacío.
 */
function readContextOrEmpty(featureDir) {
  const ctxPath = path.join(featureDir, 'context.json');
  if (!fs.existsSync(ctxPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
  } catch (err) {
    return {};
  }
}

/**
 * Verifica que el identificador de tarea exista dentro de tasks.md.
 */
function validateTaskInFeature(featureDir, taskId) {
  const tasksContent = readFileSafe(path.join(featureDir, 'tasks.md')) || '';
  const allTasks = parseTasksFromMarkdown(tasksContent);
  const found = allTasks.find((t) => t.id === taskId);
  if (!found) {
    const validIds = allTasks.map((t) => t.id).join(', ') || 'ninguna';
    return {
      valid: false,
      error: `La tarea "${taskId}" no existe en tasks.md. Tareas válidas: ${validIds}`,
    };
  }
  return { valid: true };
}

/**
 * Normaliza la decisión de resolución de una apelación ('approved' | 'rejected' | '').
 */
function normalizeResolutionStatus(rawStatus) {
  const val = String(rawStatus || '').trim().toLowerCase();
  if (val === 'accept' || val === 'accepted' || val === 'approved' || val === 'approve') {
    return 'approved';
  }
  if (val === 'reject' || val === 'rejected' || val === 'deny' || val === 'denied') {
    return 'rejected';
  }
  return '';
}

/**
 * Busca la apelación más reciente de una tarea o crea una entrada base para resolverla.
 */
function findOrCreateAppealForResolution(appeals, normTaskId, resolution, defaultTestFile) {
  const existingAppeal = appeals
    .slice()
    .reverse()
    .find((a) => a.taskId === normTaskId);
  if (existingAppeal) {
    existingAppeal.status = resolution;
    existingAppeal.resolvedAt = new Date().toISOString();
    return existingAppeal;
  }

  const created = {
    id: `APPEAL-${String(appeals.length + 1).padStart(2, '0')}`,
    taskId: normTaskId,
    testFile: defaultTestFile || null,
    reason: 'Resolución directa del Juez',
    status: resolution,
    createdAt: new Date().toISOString(),
  };
  appeals.push(created);
  return created;
}

/**
 * Resuelve una apelación existente abriendo el candado si se aprueba o consumiendo intento si se rechaza.
 */
function resolveExistingAppeal(featureDir, normTaskId, resolution, existing, cwd) {
  const appeals = Array.isArray(existing.harness && existing.harness.appeals)
    ? [...existing.harness.appeals]
    : [];
  const tasksMap = { ...((existing.harness && existing.harness.tasks) || {}) };
  const sealsMap = { ...((existing.harness && existing.harness.seals) || {}) };
  const prevTask = tasksMap[normTaskId] || {};

  const targetAppeal = findOrCreateAppealForResolution(
    appeals,
    normTaskId,
    resolution,
    prevTask.testFile
  );
  const isApproved = resolution === 'approved';
  const sealKey = targetAppeal.testFile || prevTask.testFile;

  if (sealKey && sealsMap[sealKey]) {
    sealsMap[sealKey] = {
      ...sealsMap[sealKey],
      status: isApproved ? 'unlocked' : 'locked',
    };
  }

  tasksMap[normTaskId] = {
    ...prevTask,
    attempts: isApproved ? prevTask.attempts || 0 : (prevTask.attempts || 0) + 1,
    status: isApproved ? 'appeal_approved' : 'in-progress',
  };

  saveFeatureContext(
    featureDir,
    { harness: { appeals, tasks: tasksMap, seals: sealsMap } },
    cwd
  );

  return {
    ok: true,
    valid: true,
    appeal: targetAppeal,
    sealStatus: isApproved ? 'unlocked' : 'locked',
    taskStatus: tasksMap[normTaskId].status,
    errors: [],
  };
}

/**
 * Crea y persiste una nueva apelación pendiente en context.json.
 */
function createPendingAppeal(featureDir, normTaskId, reason, params, existing, cwd) {
  const appeals = Array.isArray(existing.harness && existing.harness.appeals)
    ? [...existing.harness.appeals]
    : [];
  const tasksMap = { ...((existing.harness && existing.harness.tasks) || {}) };
  const prevTask = tasksMap[normTaskId] || {};
  const testFile = params.testFile || params.testPath || prevTask.testFile || null;

  const newAppeal = {
    id: `APPEAL-${String(appeals.length + 1).padStart(2, '0')}`,
    taskId: normTaskId,
    testFile,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  appeals.push(newAppeal);

  tasksMap[normTaskId] = {
    ...prevTask,
    status: 'appealed',
    activeAppealId: newAppeal.id,
  };

  saveFeatureContext(
    featureDir,
    { harness: { appeals, tasks: tasksMap } },
    cwd
  );

  return {
    ok: true,
    valid: true,
    appeal: newAppeal,
    sealStatus: 'locked',
    taskStatus: 'appealed',
    errors: [],
  };
}

/**
 * Registra o resuelve una apelación formal entre el Implementador y el Autor de Tests.
 */
function manageAppeal(featureDir, params = {}) {
  const cwd = params.cwd || process.cwd();
  const normTaskId = String(params.taskId || '').trim().toUpperCase();
  if (!normTaskId) {
    return {
      ok: false,
      valid: false,
      errors: ['Debe indicar el identificador de tarea (ej. TASK-01).'],
    };
  }

  const checkTask = validateTaskInFeature(featureDir, normTaskId);
  if (!checkTask.valid) {
    return { ok: false, valid: false, errors: [checkTask.error] };
  }

  const existing = readContextOrEmpty(featureDir);
  const resolution = normalizeResolutionStatus(params.status || params.resolve);
  if (resolution) {
    return resolveExistingAppeal(featureDir, normTaskId, resolution, existing, cwd);
  }

  const reason = String(params.reason || '').trim();
  if (!reason) {
    return {
      ok: false,
      valid: false,
      errors: ['Debe especificar un motivo no vacío mediante --reason "<motivo>".'],
    };
  }

  return createPendingAppeal(featureDir, normTaskId, reason, params, existing, cwd);
}

module.exports = {
  manageAppeal,
  registerAppeal: manageAppeal,
  resolveExistingAppeal,
};
