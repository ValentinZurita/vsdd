'use strict';

const fs = require('fs');
const path = require('path');
const { getGitRoot, hasGitCommits, execGit, getCurrentBranch } = require('./git');
const { readFileSafe } = require('./utils');
const { parseTrackedFilesFromPlanContent } = require('./drift');
const { getIntakeDraftPath } = require('./paths');

/**
 * Lee y parsea un archivo JSON de forma segura retornando un objeto vacío ante error.
 */
function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return {};
  }
}

/**
 * Hidrata y preserva el estado de harness dentro de context.json.
 */
function hydrateHarnessState(existingHarness = {}, incomingHarness = {}) {
  const prev = existingHarness && typeof existingHarness === 'object' ? existingHarness : {};
  const next = incomingHarness && typeof incomingHarness === 'object' ? incomingHarness : {};
  return {
    testCommand: next.testCommand !== undefined ? next.testCommand : (prev.testCommand ?? null),
    sharedBrief: next.sharedBrief !== undefined ? next.sharedBrief : (prev.sharedBrief ?? null),
    seals: {
      ...(prev.seals || {}),
      ...(next.seals || {}),
    },
    tasks: {
      ...(prev.tasks || {}),
      ...(next.tasks || {}),
    },
    appeals: Array.isArray(next.appeals)
      ? next.appeals
      : Array.isArray(prev.appeals)
        ? prev.appeals
        : [],
  };
}

/**
 * Resuelve la lista de trackedFiles desde data, plan.md o context.json previo.
 */
function resolveTrackedFiles(featureDir, data, existing) {
  if (data.trackedFiles) {
    return data.trackedFiles;
  }
  const planPath = path.join(featureDir, 'plan.md');
  if (fs.existsSync(planPath)) {
    const parsed = parseTrackedFilesFromPlanContent(readFileSafe(planPath));
    if (parsed && parsed.length > 0) {
      return parsed;
    }
  }
  return existing.trackedFiles || [];
}

/**
 * Guarda o actualiza el archivo context.json de una funcionalidad.
 */
function saveFeatureContext(featureDir, data = {}, cwd = process.cwd()) {
  const gitRoot = getGitRoot(cwd) || getGitRoot(featureDir);
  let baseCommit = data.baseCommit || '';
  let branch = data.branch || '';

  if (gitRoot && hasGitCommits(gitRoot)) {
    const stdout = !baseCommit ? execGit(['rev-parse', 'HEAD'], gitRoot, 1500) : '';
    baseCommit = baseCommit || (stdout ? stdout.trim() : '');
    branch = branch || getCurrentBranch(gitRoot);
  }

  const contextPath = path.join(featureDir, 'context.json');
  const existing = readJsonSafe(contextPath);
  const trackedFilesToSave = resolveTrackedFiles(featureDir, data, existing);

  const updated = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    version: '1.0',
    featureId: path.basename(featureDir),
    status: data.status || existing.status || 'activa',
    git: {
      branch: branch || (existing.git && existing.git.branch) || '',
      baseCommit: baseCommit || (existing.git && existing.git.baseCommit) || '',
      capturedAt: new Date().toISOString(),
    },
    trackedFiles: trackedFilesToSave,
    phases: {
      ...(existing.phases || {}),
      ...(data.phases || {}),
    },
    harness: hydrateHarnessState(existing.harness, data.harness),
    ...(existing.cancelledAt ? { cancelledAt: existing.cancelledAt } : {}),
    ...(data.cancelledAt ? { cancelledAt: data.cancelledAt } : {}),
    ...(existing.cancelReason ? { cancelReason: existing.cancelReason } : {}),
    ...(data.cancelReason ? { cancelReason: data.cancelReason } : {}),
    ...(existing.completedAt ? { completedAt: existing.completedAt } : {}),
    ...(data.completedAt ? { completedAt: data.completedAt } : {}),
  };

  fs.writeFileSync(contextPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

/**
 * Guarda o actualiza la exploración de una fase en context.json de forma acumulativa.
 */
function saveFeatureExploration(featureDir, phase, explorationData = {}, cwd = process.cwd()) {
  const contextPath = path.join(featureDir, 'context.json');
  const existing = readJsonSafe(contextPath);

  const existingPhase = (existing.phases && existing.phases[phase]) || {};
  const existingExploration = existingPhase.exploration || {};

  const mergedExploration = {
    ...existingExploration,
    ...explorationData,
    completedAt: explorationData.completedAt || new Date().toISOString(),
  };

  const gitRoot = getGitRoot(cwd) || getGitRoot(featureDir);
  if (gitRoot && hasGitCommits(gitRoot) && !mergedExploration.baseCommit) {
    const stdout = execGit(['rev-parse', 'HEAD'], gitRoot, 1500);
    if (stdout) {
      mergedExploration.baseCommit = stdout.trim();
    }
  }

  return saveFeatureContext(
    featureDir,
    {
      phases: {
        [phase]: {
          ...existingPhase,
          status: existingPhase.status || 'en-progreso',
          exploration: mergedExploration,
        },
      },
    },
    cwd
  );
}

/**
 * Obtiene la exploración guardada para una fase en context.json.
 */
function getFeatureExploration(featureDir, phase) {
  const contextPath = path.join(featureDir, 'context.json');
  if (!fs.existsSync(contextPath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    if (data.phases && data.phases[phase] && data.phases[phase].exploration) {
      return data.phases[phase].exploration;
    }
  } catch (err) {
    return null;
  }
  return null;
}

/**
 * Guarda o actualiza el borrador de intake en docs/sdd/vsdd/.draft-intake.json.
 */
function saveIntakeDraft(draftData = {}, cwd = process.cwd()) {
  const vsddRoot = path.join(cwd, 'docs', 'sdd', 'vsdd');
  if (!fs.existsSync(vsddRoot)) {
    fs.mkdirSync(vsddRoot, { recursive: true });
  }
  const draftPath = getIntakeDraftPath(cwd);
  const existing = readJsonSafe(draftPath);

  const existingExploration = existing.exploration || {};
  const newExploration = draftData.exploration || {};
  const existingInterview = existing.interview || {};
  const newInterview = draftData.interview || {};

  const updated = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    version: '1.0',
    isDraft: true,
    ideaSummary: draftData.ideaSummary || existing.ideaSummary || '',
    updatedAt: new Date().toISOString(),
    exploration: {
      ...existingExploration,
      ...newExploration,
      completedAt: newExploration.completedAt || existingExploration.completedAt || new Date().toISOString(),
    },
    interview: {
      ...existingInterview,
      ...newInterview,
      questions: newInterview.questions || existingInterview.questions || [],
      updatedAt: newInterview.updatedAt || existingInterview.updatedAt || new Date().toISOString(),
    },
    ...(draftData.extra || {}),
  };

  const gitRoot = getGitRoot(cwd);
  if (gitRoot && hasGitCommits(gitRoot) && !updated.exploration.baseCommit) {
    const stdout = execGit(['rev-parse', 'HEAD'], gitRoot, 1500);
    if (stdout) {
      updated.exploration.baseCommit = stdout.trim();
    }
  }

  fs.writeFileSync(draftPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

/**
 * Obtiene el borrador de intake si existe.
 */
function getIntakeDraft(cwd = process.cwd()) {
  const draftPath = getIntakeDraftPath(cwd);
  if (!fs.existsSync(draftPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  } catch (err) {
    return null;
  }
}

/**
 * Elimina el borrador de intake si el usuario lo descarta.
 */
function clearIntakeDraft(cwd = process.cwd()) {
  const draftPath = getIntakeDraftPath(cwd);
  if (fs.existsSync(draftPath)) {
    try {
      fs.unlinkSync(draftPath);
      return true;
    } catch (err) {
      return false;
    }
  }
  return false;
}

/**
 * Promueve el borrador de intake a context.json en la carpeta definitiva de la funcionalidad.
 */
function promoteIntakeDraft(featureDir, cwd = process.cwd()) {
  const draft = getIntakeDraft(cwd);
  if (!draft) {
    return null;
  }

  const updatedContext = saveFeatureContext(
    featureDir,
    {
      phases: {
        intake: {
          status: 'completado',
          completedAt: new Date().toISOString(),
          exploration: draft.exploration || {},
          interview: draft.interview || { questions: [] },
        },
      },
    },
    cwd
  );

  clearIntakeDraft(cwd);
  return updatedContext;
}

/**
 * Inserta o actualiza una pregunta de entrevista manteniendo el orden por índice.
 */
function upsertInterviewQuestions(existingQuestions, questionData) {
  const questions = Array.isArray(existingQuestions) ? [...existingQuestions] : [];
  if (questionData && (questionData.question || questionData.answer)) {
    const qIndex = questionData.index || questionData.q || (questions.length + 1);
    const entry = {
      index: qIndex,
      topic: questionData.topic || '',
      question: questionData.question || '',
      answer: questionData.answer || '',
      recordedAt: questionData.recordedAt || new Date().toISOString(),
    };
    const existingPos = questions.findIndex((q) => q.index === qIndex);
    if (existingPos !== -1) {
      questions[existingPos] = { ...questions[existingPos], ...entry };
    } else {
      questions.push(entry);
    }
  }
  questions.sort((a, b) => (a.index || 0) - (b.index || 0));
  return questions;
}

/**
 * Guarda o actualiza una respuesta consensuada de la entrevista en context.json.
 */
function saveInterviewAnswer(featureDir, phase, questionData = {}, cwd = process.cwd()) {
  const contextPath = path.join(featureDir, 'context.json');
  const existing = readJsonSafe(contextPath);
  const existingPhase = (existing.phases && existing.phases[phase]) || {};
  const existingInterview = existingPhase.interview || {};
  const questions = upsertInterviewQuestions(existingInterview.questions, questionData);

  return saveFeatureContext(
    featureDir,
    {
      phases: {
        [phase]: {
          ...existingPhase,
          status: existingPhase.status || 'en-progreso',
          interview: {
            ...existingInterview,
            maxQuestions: questionData.maxQuestions || existingInterview.maxQuestions || 0,
            updatedAt: new Date().toISOString(),
            questions,
          },
        },
      },
    },
    cwd
  );
}

/**
 * Obtiene el progreso de la entrevista de una fase.
 */
function getInterviewProgress(featureDir, phase) {
  const contextPath = path.join(featureDir, 'context.json');
  if (!fs.existsSync(contextPath)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    if (data.phases && data.phases[phase] && data.phases[phase].interview) {
      return data.phases[phase].interview;
    }
  } catch (err) {
    return null;
  }
  return null;
}

/**
 * Reinicia las preguntas de la entrevista de una fase sin borrar la exploración previa.
 */
function clearInterviewProgress(featureDir, phase, cwd = process.cwd()) {
  const contextPath = path.join(featureDir, 'context.json');
  const existing = readJsonSafe(contextPath);
  const existingPhase = (existing.phases && existing.phases[phase]) || {};

  return saveFeatureContext(
    featureDir,
    {
      phases: {
        [phase]: {
          ...existingPhase,
          interview: {
            questions: [],
            updatedAt: new Date().toISOString(),
          },
        },
      },
    },
    cwd
  );
}

/**
 * Guarda o actualiza una respuesta en el borrador de intake.
 */
function saveIntakeInterviewAnswer(questionData = {}, cwd = process.cwd()) {
  const draft = getIntakeDraft(cwd) || {};
  const existingInterview = draft.interview || {};
  const questions = upsertInterviewQuestions(existingInterview.questions, questionData);

  return saveIntakeDraft(
    {
      ...draft,
      interview: {
        ...existingInterview,
        updatedAt: new Date().toISOString(),
        questions,
      },
    },
    cwd
  );
}

module.exports = {
  hydrateHarnessState,
  saveFeatureContext,
  saveFeatureExploration,
  getFeatureExploration,
  saveIntakeDraft,
  getIntakeDraft,
  clearIntakeDraft,
  promoteIntakeDraft,
  saveInterviewAnswer,
  getInterviewProgress,
  clearInterviewProgress,
  saveIntakeInterviewAnswer,
};
