'use strict';

const fs = require('fs');
const path = require('path');
const { readFileSafe } = require('../utils');
const { saveFeatureContext } = require('../state');

/**
 * Obtiene el mtimeMs actual de un archivo o 0 si no existe.
 */
function getFileMtimeMs(filePath) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch (err) {
    return 0;
  }
}

/**
 * Lee los tiempos de modificación de idea.md, spec.md y plan.md.
 */
function readSourceMtimes(featureDir) {
  return {
    idea: getFileMtimeMs(path.join(featureDir, 'idea.md')),
    spec: getFileMtimeMs(path.join(featureDir, 'spec.md')),
    plan: getFileMtimeMs(path.join(featureDir, 'plan.md')),
  };
}

/**
 * Determina si una línea abre o cierra una cerca de código Markdown.
 */
function updateFenceState(line, currentFence) {
  const match = line.trim().match(/^(`{3,}|~{3,})/);
  if (!match) {
    return currentFence;
  }
  const marker = match[1];
  if (!currentFence) {
    return marker;
  }
  const isSameChar = marker[0] === currentFence[0];
  return isSameChar && marker.length >= currentFence.length ? null : currentFence;
}

/**
 * Extrae secciones H2 cuyo título coincida con alguno de los patrones indicados.
 */
function extractH2Sections(markdown, patterns) {
  if (!markdown) {
    return '';
  }
  const lines = markdown.split(/\r?\n/);
  const captured = [];
  let active = false;
  let fence = null;

  for (const line of lines) {
    fence = updateFenceState(line, fence);
    if (!fence && /^##\s+/.test(line)) {
      const title = line.replace(/^##\s+/, '').trim();
      active = patterns.some((rx) => rx.test(title));
    }
    if (active) {
      captured.push(line);
    }
  }
  return captured.join('\n').trim();
}

/**
 * Extrae bloques H3 completos por identificador exacto (ej. RF-01, DT-01) sin truncar líneas.
 */
function extractH3BlocksByIds(markdown, ids) {
  if (!markdown || !ids || ids.length === 0) {
    return '';
  }
  const idSet = new Set(ids.map((id) => id.toUpperCase()));
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let active = false;
  let fence = null;

  for (const line of lines) {
    fence = updateFenceState(line, fence);
    if (!fence && /^#{2,3}\s+/.test(line)) {
      const idMatch = line.match(/^###\s+((?:RF|DT|RNF)-\d+)\b/i);
      active = Boolean(idMatch && idSet.has(idMatch[1].toUpperCase()));
    }
    if (active) {
      blocks.push(line);
    }
  }
  return blocks.join('\n').trim();
}

/**
 * Lee y formatea la memoria verificada del repositorio si existe.
 */
function formatRepoMemory(featureDir) {
  const candidates = [
    path.resolve(featureDir, '..', 'repo-memory.json'),
    path.join(featureDir, 'repo-memory.json'),
  ];
  const memPath = candidates.find((p) => fs.existsSync(p));
  if (!memPath) {
    return 'Sin entradas registradas en repo-memory.json.';
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(memPath, 'utf8'));
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    if (entries.length === 0) {
      return 'Sin entradas registradas en repo-memory.json.';
    }
    return entries
      .map((e) => `- [${e.id || 'MEM'}] ${e.fact || e.summary || ''} (${e.anchor || 'repo'})`)
      .join('\n');
  } catch (err) {
    return 'Sin entradas legibles en repo-memory.json.';
  }
}

/**
 * Construye el texto del Contexto Compartido Global a partir de idea.md, spec.md, plan.md y memoria.
 */
function buildSharedBriefContent(featureDir, docs) {
  const ideaSec = extractH2Sections(docs.idea, [
    /problema/i,
    /qu[eé]\s+vamos\s+a\s+hacer/i,
    /alcance/i,
    /listo\s+cuando/i,
  ]);
  const planSec = extractH2Sections(docs.plan, [
    /alineaci[oó]n/i,
    /m[oó]dulos\s+y\s+arquitectura/i,
    /modelo\s+de\s+datos/i,
    /algoritmos\s+y\s+l[oó]gica/i,
    /contratos\s+e\s+interfaces/i,
    /[aá]rbol\s+de\s+cambios/i,
  ]);
  const rulesSec = [
    extractH2Sections(docs.tasks, [/reglas\s+de\s+ejecuci[oó]n/i]),
    extractH2Sections(docs.spec, [/requisitos\s+no\s+funcionales/i, /casos\s+l[ií]mite/i]),
  ].filter(Boolean).join('\n\n');
  const antiGoalsSec = extractH2Sections(docs.spec, [
    /l[ií]mites\s+y\s+exclusiones/i,
    /non-goals/i,
    /anti-goals/i,
  ]);
  const memorySec = formatRepoMemory(featureDir);

  return [
    '# Contexto Compartido Global',
    '## Objetivo de negocio (idea.md)',
    ideaSec,
    '## Diseño técnico, Pseudocódigo y Arquitectura (plan.md)',
    planSec,
    '## Reglas de ejecución y Requisitos No Funcionales',
    rulesSec,
    '## Qué NO hacer / Anti-Goals (spec.md)',
    antiGoalsSec,
    '## Memoria del repositorio (repo-memory.json)',
    memorySec,
  ].filter(Boolean).join('\n\n');
}

/**
 * Parsea todas las tareas declaradas en tasks.md extrayendo bloque completo, estado y referencias Cubre.
 */
function parseTasksFromMarkdown(tasksContent) {
  const lines = (tasksContent || '').split(/\r?\n/);
  const tasks = [];
  let current = null;

  for (const line of lines) {
    const headerMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(?:\*\*)?(TASK-\d+)\b(.*)$/);
    if (headerMatch) {
      current = {
        id: headerMatch[2].toUpperCase(),
        completed: headerMatch[1].toLowerCase() === 'x',
        headerLine: line.trim(),
        lines: [line],
        coveredIds: [],
      };
      tasks.push(current);
      continue;
    }
    if (current && (/^#{1,6}\s+/.test(line) || (/^-\s+\[[ xX]\]/.test(line) && !/^\s{2,}/.test(line)))) {
      current = null;
      continue;
    }
    if (current) {
      current.lines.push(line);
      if (/\bcubre\b/i.test(line)) {
        const matches = line.match(/\b(?:RF|DT|RNF)-\d+\b/gi) || [];
        current.coveredIds.push(...matches.map((m) => m.toUpperCase()));
      }
    }
  }
  return tasks;
}

/**
 * Verifica si la caché de sharedBrief en context.json coincide con los mtimeMs actuales.
 */
function isSharedBriefValid(cached, mtimes) {
  if (!cached || typeof cached.content !== 'string' || !cached.content) {
    return false;
  }
  const src = cached.sourceMtimes || {
    idea: cached.ideaMtimeMs,
    spec: cached.specMtimeMs,
    plan: cached.planMtimeMs,
  };
  return src.idea === mtimes.idea && src.spec === mtimes.spec && src.plan === mtimes.plan;
}

/**
 * Obtiene o regenera el Contexto Compartido Global con persistencia en context.json.
 */
function resolveSharedBrief(featureDir, docs, mtimes) {
  const contextPath = path.join(featureDir, 'context.json');
  let existing = {};
  if (fs.existsSync(contextPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {
      existing = {};
    }
  }

  const cached = existing.harness && existing.harness.sharedBrief;
  if (isSharedBriefValid(cached, mtimes)) {
    return { content: cached.content, cacheHit: true };
  }

  const content = buildSharedBriefContent(featureDir, docs);
  saveFeatureContext(featureDir, {
    harness: {
      sharedBrief: {
        content,
        sourceMtimes: { ...mtimes },
        ideaMtimeMs: mtimes.idea,
        specMtimeMs: mtimes.spec,
        planMtimeMs: mtimes.plan,
        updatedAt: new Date().toISOString(),
      },
    },
  });
  return { content, cacheHit: false };
}

/**
 * Construye el Corte Específico de la Tarea activa uniendo tareas previas, RFs, DTs y bloque de tarea.
 */
function buildTaskSliceContent(targetTask, allTasks, docs) {
  const completedTasks = allTasks
    .filter((t) => t.completed && t.id !== targetTask.id)
    .map((t) => t.headerLine);
  const completedSection =
    completedTasks.length > 0
      ? completedTasks.join('\n')
      : 'Ninguna tarea previa completada.';

  const rfIds = targetTask.coveredIds.filter((id) => id.startsWith('RF-'));
  const dtIds = targetTask.coveredIds.filter((id) => id.startsWith('DT-'));
  const rfBlocks = extractH3BlocksByIds(docs.spec, rfIds);
  const dtBlocks = extractH3BlocksByIds(docs.plan, dtIds);
  const taskBlock = targetTask.lines.join('\n').trim();

  return [
    `# Corte Específico de Tarea: ${targetTask.id}`,
    '## Tareas previas completadas ([x])',
    completedSection,
    '## Requisitos Funcionales Activos (spec.md)',
    rfBlocks || 'Sin RF específicos declarados.',
    '## Decisiones Técnicas Activas (plan.md)',
    dtBlocks || 'Sin DT específicas declaradas.',
    `## Especificación de ${targetTask.id} (tasks.md)`,
    taskBlock,
  ].join('\n\n');
}

/**
 * Ensambla el paquete de contexto inteligente (SharedBrief + TaskSlice) para una tarea.
 */
function assembleBrief(featureDir, taskId, options = {}) {
  const normalizedTaskId = String(taskId || '').trim().toUpperCase();
  const docs = {
    idea: readFileSafe(path.join(featureDir, 'idea.md')) || '',
    spec: readFileSafe(path.join(featureDir, 'spec.md')) || '',
    plan: readFileSafe(path.join(featureDir, 'plan.md')) || '',
    tasks: readFileSafe(path.join(featureDir, 'tasks.md')) || '',
  };

  const allTasks = parseTasksFromMarkdown(docs.tasks);
  const targetTask = allTasks.find((t) => t.id === normalizedTaskId);
  if (!targetTask) {
    const validIds = allTasks.map((t) => t.id);
    const err = new Error(
      `La tarea "${normalizedTaskId}" no existe en tasks.md. Tareas válidas: ${validIds.join(', ') || 'ninguna'}`
    );
    err.code = 'TASK_NOT_FOUND';
    err.validTasks = validIds;
    throw err;
  }

  const mtimes = readSourceMtimes(featureDir);
  const { content: sharedBrief, cacheHit } = resolveSharedBrief(featureDir, docs, mtimes);
  const taskSlice = buildTaskSliceContent(targetTask, allTasks, docs);
  const fullText = `${sharedBrief}\n\n---\n\n${taskSlice}`;

  return {
    sharedBrief,
    taskSlice,
    fullText,
    cacheHit,
    meta: {
      taskId: normalizedTaskId,
      cacheHit,
      coveredIds: targetTask.coveredIds,
      completedTasks: allTasks.filter((t) => t.completed).map((t) => t.id),
      sourceMtimes: mtimes,
      options,
    },
  };
}

module.exports = {
  assembleBrief,
  buildTaskBrief: assembleBrief,
  parseTasksFromMarkdown,
  extractH2Sections,
  extractH3BlocksByIds,
};
