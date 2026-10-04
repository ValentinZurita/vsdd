#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execSync } = require('child_process');

/**
 * Resuelve la ruta absoluta del archivo de referencia de una fase para JIT context.
 * @param {string} phase Nombre de la fase
 * @param {string} cwd Directorio de trabajo
 * @returns {string} Ruta absoluta al archivo de referencia o cadena vacía
 */
function resolveReferenceFile(phase, cwd = process.cwd()) {
  if (!phase || phase === 'cancelado' || phase === 'completado') {
    return '';
  }

  const phaseFile = `${phase}.md`;
  const candidates = [
    path.resolve(__dirname, '..', 'references', phaseFile),
    path.join(cwd, '.agents', 'skills', 'vsdd', 'references', phaseFile),
    path.join(os.homedir(), '.gemini', 'config', 'skills', 'vsdd', 'references', phaseFile),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  return '';
}

/**
 * Resuelve la ruta absoluta del artefacto objetivo según la fase.
 * @param {string} featureDir Directorio de la funcionalidad
 * @param {string} phase Fase actual
 * @returns {string} Ruta absoluta al artefacto
 */
function resolveTargetFile(featureDir, phase) {
  if (!featureDir) return '';
  switch (phase) {
    case 'intake':
      return path.join(featureDir, 'idea.md');
    case 'spec':
      return path.join(featureDir, 'spec.md');
    case 'plan':
      return path.join(featureDir, 'plan.md');
    case 'tasks':
    case 'apply':
      return path.join(featureDir, 'tasks.md');
    case 'verify':
      return path.join(featureDir, 'resumen.md');
    default:
      return '';
  }
}

/**
 * Escanea el directorio docs/sdd/vsdd en busca de funcionalidades y su estado.
 * @param {string} cwd Directorio raíz del proyecto
 * @returns {Array<Object>} Lista de funcionalidades con su metadata y estado
 */
function scanFeatures(cwd = process.cwd()) {
  const vsddRoot = path.join(cwd, 'docs', 'sdd', 'vsdd');
  if (!fs.existsSync(vsddRoot)) {
    return [];
  }

  const features = [];

  // Detectar si hay un borrador de intake en curso
  const intakeDraft = getIntakeDraft(cwd);
  if (intakeDraft) {
    features.push({
      id: '[Borrador] Intake en progreso',
      rawId: '.draft-intake',
      isDraft: true,
      path: getIntakeDraftPath(cwd),
      phase: 'intake',
      phaseDescription: 'Intake (borrador en progreso)',
      nextCommand: 'vsdd intake',
      referenceFile: resolveReferenceFile('intake', cwd),
      targetFile: getIntakeDraftPath(cwd),
      isCompleted: false,
      objective: intakeDraft.ideaSummary || 'Idea en proceso de exploración',
      totalTasks: 0,
      completedTasks: 0,
      pendingTasks: 0,
      nextTaskTitle: '',
      states: {
        idea: 'borrador',
        spec: '',
        plan: '',
        tasks: '',
      },
      drift: null,
      draftData: intakeDraft,
    });
  }

  let entries = [];
  try {
    entries = fs.readdirSync(vsddRoot, { withFileTypes: true });
  } catch (error) {
    return features;
  }

  const featureDirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  for (const dirName of featureDirs) {
    const dirPath = path.join(vsddRoot, dirName);
    const feature = parseFeatureDirectory(dirName, dirPath, cwd);
    if (feature) {
      features.push(feature);
    }
  }

  return features;
}

/**
 * Parsea el contenido de una carpeta de funcionalidad.
 */
function parseFeatureDirectory(dirName, dirPath, cwd = process.cwd()) {
  const ideaPath = path.join(dirPath, 'idea.md');
  const specPath = path.join(dirPath, 'spec.md');
  const planPath = path.join(dirPath, 'plan.md');
  const tasksPath = path.join(dirPath, 'tasks.md');
  const resumenPath = path.join(dirPath, 'resumen.md');

  const hasIdea = fs.existsSync(ideaPath);
  const hasSpec = fs.existsSync(specPath);
  const hasPlan = fs.existsSync(planPath);
  const hasTasks = fs.existsSync(tasksPath);
  const hasResumen = fs.existsSync(resumenPath);

  if (!hasIdea && !hasSpec && !hasPlan && !hasTasks && !hasResumen) {
    return null;
  }

  const ideaContent = hasIdea ? readFileSafe(ideaPath) : '';
  const specContent = hasSpec ? readFileSafe(specPath) : '';
  const planContent = hasPlan ? readFileSafe(planPath) : '';
  const tasksContent = hasTasks ? readFileSafe(tasksPath) : '';
  const resumenContent = hasResumen ? readFileSafe(resumenPath) : '';

  const ideaState = extractHeaderState(ideaContent);
  const specState = extractHeaderState(specContent);
  const planState = extractHeaderState(planContent);
  const tasksState = extractHeaderState(tasksContent);
  const resumenState = extractHeaderState(resumenContent);

  // Extraer resumen del objetivo
  const objective = extractObjective(ideaContent, specContent, dirName, resumenContent);

  // Analizar tareas si existen
  let totalTasks = 0;
  let completedTasks = 0;
  let pendingTasks = 0;
  let nextTaskTitle = '';

  if (hasTasks) {
    const taskLines = tasksContent.split('\n');
    for (const line of taskLines) {
      const isTaskCompleted = /^\s*[-*]\s*\[\s*[xX]\s*\]\s*\*\*TASK-(\d+)/.test(line);
      const isTaskPending = /^\s*[-*]\s*\[\s*\]\s*\*\*TASK-(\d+)/.test(line);

      if (isTaskCompleted) {
        totalTasks++;
        completedTasks++;
      } else if (isTaskPending) {
        totalTasks++;
        pendingTasks++;
        if (!nextTaskTitle) {
          const match = line.match(/\*\*TASK-\d+:\s*([^*]+)\*\*/);
          nextTaskTitle = match ? match[1].trim() : 'Siguiente tarea';
        }
      }
    }
  }

  const contextPath = path.join(dirPath, 'context.json');
  let contextData = null;
  if (fs.existsSync(contextPath)) {
    try {
      contextData = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (e) {}
  }

  const isCancelled =
    ideaState === 'cancelado' ||
    specState === 'cancelado' ||
    planState === 'cancelado' ||
    tasksState === 'cancelado' ||
    resumenState === 'cancelado' ||
    Boolean(contextData && contextData.status === 'cancelado');

  // Determinar fase actual y estado
  let phase = 'intake';
  let phaseDescription = 'Idea inicial';
  let nextCommand = 'vsdd intake';
  let isCompleted = false;

  if (isCancelled) {
    phase = 'cancelado';
    phaseDescription = 'Funcionalidad cancelada';
    nextCommand = '';
    isCompleted = false;
  } else if (tasksState === 'completado' || resumenState === 'completado') {
    phase = 'completado';
    phaseDescription = hasResumen ? 'Completada y cerrada con resumen' : 'Completada y cerrada';
    nextCommand = '';
    isCompleted = true;
  } else if (hasTasks) {
    if (tasksState === 'listo-para-verify' || (totalTasks > 0 && pendingTasks === 0)) {
      phase = 'verify';
      phaseDescription = 'Implementación finalizada';
      nextCommand = 'vsdd verify';
    } else {
      phase = 'apply';
      phaseDescription = totalTasks > 0
        ? `Implementación en progreso (${completedTasks}/${totalTasks} tareas)`
        : 'Tareas listas para implementar';
      nextCommand = 'vsdd apply';
    }
  } else if (hasPlan) {
    if (planState === 'listo-para-tareas') {
      phase = 'tasks';
      phaseDescription = 'Plan técnico aprobado';
      nextCommand = 'vsdd tasks';
    } else {
      phase = 'plan';
      phaseDescription = 'Plan técnico en revisión';
      nextCommand = 'vsdd plan';
    }
  } else if (hasSpec) {
    if (specState === 'listo-para-plan') {
      phase = 'plan';
      phaseDescription = 'Especificación funcional aprobada';
      nextCommand = 'vsdd plan';
    } else {
      phase = 'spec';
      phaseDescription = 'Especificación en revisión';
      nextCommand = 'vsdd spec';
    }
  } else if (hasIdea) {
    phase = 'spec';
    phaseDescription = 'Idea aprobada';
    nextCommand = 'vsdd spec';
  }

  const feature = {
    id: dirName,
    path: dirPath,
    phase,
    phaseDescription,
    nextCommand,
    referenceFile: resolveReferenceFile(phase, cwd),
    targetFile: resolveTargetFile(dirPath, phase),
    isCompleted,
    isCancelled,
    objective,
    totalTasks,
    completedTasks,
    pendingTasks,
    nextTaskTitle,
    states: {
      idea: ideaState,
      spec: specState,
      plan: planState,
      tasks: tasksState,
      resumen: resumenState || (hasResumen ? 'presente' : 'no-generado'),
    },
    hasResumen,
    resumenContent,
    planContent,
  };

  // Calcular salud del repositorio y detección de desfase (Drift Sentinel)
  feature.drift = calculateFeatureDrift(dirPath, feature, cwd);

  return feature;
}

// -------------------------------------------------------------
// Utilidades de Git robustas y seguras
// -------------------------------------------------------------

function execGit(args, cwd, timeout = 3000) {
  try {
    return execFileSync('git', args, {
      cwd,
      timeout,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return null;
  }
}

function getGitRoot(cwd = process.cwd()) {
  const stdout = execGit(['rev-parse', '--show-toplevel'], cwd, 1500);
  return stdout ? stdout.trim() : null;
}

function hasGitCommits(gitRoot) {
  if (!gitRoot) return false;
  const stdout = execGit(['rev-parse', '--verify', 'HEAD'], gitRoot, 1000);
  return stdout !== null;
}

function isCommitInTree(gitRoot, commitSha) {
  if (!gitRoot || !commitSha) return false;
  const stdout = execGit(['cat-file', '-e', `${commitSha}^{commit}`], gitRoot, 1000);
  return stdout !== null;
}

function getCurrentBranch(gitRoot) {
  if (!gitRoot) return '';
  const stdout = execGit(['branch', '--show-current'], gitRoot, 1000);
  return stdout ? stdout.trim() : '';
}

function getRepositoryBranches(gitRoot) {
  if (!gitRoot) return [];
  const out = execGit(['branch', '--format=%(refname:short)'], gitRoot, 1000);
  if (!out) return [];
  return out.split('\n').map((b) => b.trim()).filter(Boolean);
}

function getDefaultBranch(gitRoot) {
  if (!gitRoot) return 'main';
  const originHead = execGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], gitRoot, 1000);
  if (originHead) {
    return originHead.replace(/^origin\//, '').trim();
  }
  const branches = getRepositoryBranches(gitRoot);
  for (const trunk of ['main', 'master', 'develop', 'dev', 'trunk']) {
    if (branches.includes(trunk)) return trunk;
  }
  if (branches.length === 1) {
    return branches[0];
  }
  return 'main';
}

// -------------------------------------------------------------
// Extracción de archivos y Manifiesto de Contexto
// -------------------------------------------------------------

function parseTrackedFilesFromPlanContent(content) {
  const trackedFiles = [];
  if (!content) return trackedFiles;

  const treeSectionMatch = content.match(/##\s+(?:[0-9]+\.\s*)?Árbol de cambios\s+([\s\S]*?)(?=\n##|$)/i);
  if (treeSectionMatch) {
    const lines = treeSectionMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*[-*]?\s*[`'"]?([+~*–-])[\s`'"]+`?([^`'"\r\n]+)`?/);
      if (match) {
        const symbol = match[1];
        const rawPath = match[2].trim();
        let action = 'modify';
        if (symbol === '+') action = 'create';
        else if (symbol === '-') action = 'delete';

        trackedFiles.push({
          path: rawPath,
          action,
        });
      }
    }
  }
  return trackedFiles;
}

function extractTrackedFiles(featureDir, planContent = '') {
  const contextPath = path.join(featureDir, 'context.json');
  const planPath = path.join(featureDir, 'plan.md');

  const hasContext = fs.existsSync(contextPath);
  const hasPlan = fs.existsSync(planPath);

  let contextData = null;
  if (hasContext) {
    try {
      contextData = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {
      contextData = null;
    }
  }

  // Comprobar si plan.md es más reciente que context.json para auto-sincronizar
  let isPlanNewer = false;
  if (hasContext && hasPlan) {
    try {
      const planMtime = fs.statSync(planPath).mtimeMs;
      const contextMtime = fs.statSync(contextPath).mtimeMs;
      if (planMtime > contextMtime) {
        isPlanNewer = true;
      }
    } catch (err) {}
  }

  if (contextData && !isPlanNewer && Array.isArray(contextData.trackedFiles) && contextData.trackedFiles.length > 0) {
    return {
      source: 'context.json',
      baseCommit: contextData.git ? contextData.git.baseCommit : '',
      originalBranch: contextData.git ? contextData.git.branch : '',
      trackedFiles: contextData.trackedFiles,
    };
  }

  // Extracción dinámica desde el Árbol de Cambios de plan.md
  const content = planContent || (hasPlan ? readFileSafe(planPath) : '');
  const trackedFiles = parseTrackedFilesFromPlanContent(content);

  return {
    source: hasContext ? 'context.json (synced from plan)' : 'plan.md',
    baseCommit: contextData && contextData.git ? contextData.git.baseCommit : '',
    originalBranch: contextData && contextData.git ? contextData.git.branch : '',
    trackedFiles,
  };
}

/**
 * Calcula el desfase de contexto (Drift Sentinel) de una funcionalidad.
 */
function calculateFeatureDrift(featureDir, feature, cwd = process.cwd()) {
  const gitRoot = getGitRoot(cwd) || getGitRoot(featureDir);

  if (!gitRoot || !hasGitCommits(gitRoot)) {
    return {
      status: 'UNKNOWN',
      label: '⚪ Sin Git / Repositorio sin commits',
      reason: 'NO_GIT_OR_NO_COMMITS',
      details: {},
    };
  }

  const { trackedFiles, baseCommit, originalBranch, source } = extractTrackedFiles(
    featureDir,
    feature ? feature.planContent : ''
  );

  if (!trackedFiles || trackedFiles.length === 0) {
    return {
      status: 'UNKNOWN',
      label: '⚪ Sin archivos trackeados en plan',
      reason: 'NO_TRACKED_FILES',
      details: { source },
    };
  }

  // El baseline registra una rama de referencia; no representa la rama remota.
  const currentBranch = getCurrentBranch(gitRoot);
  const branchMismatch = Boolean(originalBranch && currentBranch && originalBranch !== currentBranch);

  // 1. CHEQUEO FÍSICO DE EXISTENCIA EN DISCO (Crítico Post-Judgment Day)
  // Solo se valida la existencia física de archivos a MODIFICAR (~).
  // Los archivos a CREAR (+) no existen todavía y NO deben generar falsa alarma roja.
  const missingModifiedFiles = [];
  for (const item of trackedFiles) {
    if (item.action === 'modify') {
      const fullPath = path.isAbsolute(item.path) ? item.path : path.join(gitRoot, item.path);
      if (!fs.existsSync(fullPath)) {
        missingModifiedFiles.push(item.path);
      }
    }
  }

  if (missingModifiedFiles.length > 0) {
    return {
      status: 'RED',
      label: `🔴 ${missingModifiedFiles.length} archivo(s) a modificar faltante(s) o renombrado(s)`,
      reason: 'MISSING_MODIFIED_FILE',
      details: {
        missingFiles: missingModifiedFiles,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  // 2. CHEQUEO DE HISTORIAL GIT (CAMBIOS DESDE EL BASELINE)

  const filePathsForGit = trackedFiles.map((f) => f.path);

  let commitsSinceBase = 0;
  const modifiedSinceBase = [];

  const hasValidBase = baseCommit && isCommitInTree(gitRoot, baseCommit);

  if (hasValidBase) {
    const countOutput = execGit(['rev-list', '--count', `${baseCommit}..HEAD`], gitRoot, 2000);
    commitsSinceBase = countOutput ? parseInt(countOutput.trim(), 10) || 0 : 0;

    if (commitsSinceBase > 0 && filePathsForGit.length > 0) {
      const diffOutput = execGit(
        ['diff', '--name-status', `${baseCommit}..HEAD`, '--', ...filePathsForGit],
        gitRoot,
        5000
      );

      if (diffOutput && diffOutput.trim()) {
        const lines = diffOutput.trim().split('\n');
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const statusCode = parts[0].trim();
            const changedPath = parts[1].trim();
            modifiedSinceBase.push({
              status: statusCode,
              path: changedPath,
            });
          }
        }
      }
    }
  }

  // 3. CHEQUEO DE ESTADO SUCIO LOCAL (UNCOMMITTED CHANGES)
  const dirtyLocalFiles = [];
  if (filePathsForGit.length > 0) {
    const statusOutput = execGit(
      ['status', '--porcelain', '--', ...filePathsForGit],
      gitRoot,
      5000
    );

    if (statusOutput) {
      const lines = statusOutput.split('\n');
      for (const line of lines) {
        if (!line || line.length < 4) continue;
        const rawPath = line.substring(3).trim();
        const cleanPath = rawPath.replace(/^"|"$/g, '');
        const finalPath = cleanPath.includes(' -> ') ? cleanPath.split(' -> ')[1].trim() : cleanPath;
        dirtyLocalFiles.push(finalPath);
      }
    }
  }

  // Clasificación final del semáforo
  if (modifiedSinceBase.length > 0) {
    return {
      status: 'YELLOW',
      label: `🟡 ${modifiedSinceBase.length} archivo(s) con cambios desde el baseline (+${commitsSinceBase} commits desde el baseline)`,
      // Se conserva el reason histórico para no romper consumidores del JSON.
      reason: 'MODIFIED_UPSTREAM',
      details: {
        commitsSinceBase,
        /** @deprecated Use commitsSinceBase; this count is not commits behind a remote. */
        commitsBehind: commitsSinceBase,
        modifiedFiles: modifiedSinceBase.map((m) => m.path),
        dirtyLocalFiles,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  if (dirtyLocalFiles.length > 0) {
    return {
      status: 'YELLOW',
      label: `🟡 ${dirtyLocalFiles.length} archivo(s) con cambios locales no commiteados`,
      reason: 'DIRTY_LOCAL',
      details: {
        commitsSinceBase,
        /** @deprecated Use commitsSinceBase; this count is not commits behind a remote. */
        commitsBehind: commitsSinceBase,
        dirtyLocalFiles,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  if (branchMismatch) {
    return {
      status: 'YELLOW',
      label: `🟡 Rama distinta al baseline (${originalBranch} → ${currentBranch})`,
      reason: 'BRANCH_MISMATCH',
      details: {
        ...(hasValidBase ? {
          commitsSinceBase,
          /** @deprecated Use commitsSinceBase; this count is not commits behind a remote. */
          commitsBehind: commitsSinceBase,
        } : {}),
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  if (hasValidBase) {
    return {
      status: 'GREEN',
      label: '🟢 Sin cambios en los archivos del plan desde el baseline',
      reason: 'SYNCED',
      details: {
        commitsSinceBase,
        /** @deprecated Use commitsSinceBase; this count is not commits behind a remote. */
        commitsBehind: commitsSinceBase,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  // Sin commit base pero sin cambios locales sucios
  return {
    status: 'GREEN',
    label: '🟢 Sin cambios locales detectados (sin commit base histórico)',
    reason: 'NO_BASE_COMMIT_CLEAN',
    details: {
      branchMismatch,
      originalBranch,
      currentBranch,
      source,
    },
  };
}

/**
 * Guarda o actualiza el archivo context.json de una funcionalidad.
 */
function saveFeatureContext(featureDir, data = {}, cwd = process.cwd()) {
  const gitRoot = getGitRoot(cwd) || getGitRoot(featureDir);
  let baseCommit = data.baseCommit || '';
  let branch = data.branch || '';

  if (gitRoot && hasGitCommits(gitRoot)) {
    if (!baseCommit) {
      const stdout = execGit(['rev-parse', 'HEAD'], gitRoot, 1500);
      if (stdout) {
        baseCommit = stdout.trim();
      }
    }
    if (!branch) {
      branch = getCurrentBranch(gitRoot);
    }
  }

  const contextPath = path.join(featureDir, 'context.json');
  let existing = {};
  if (fs.existsSync(contextPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {}
  }

  // Prevenir que context.json congele una lista obsoleta de trackedFiles si plan.md fue editado manualmente
  let trackedFilesToSave = data.trackedFiles;
  if (!trackedFilesToSave) {
    const planPath = path.join(featureDir, 'plan.md');
    if (fs.existsSync(planPath)) {
      const planContent = readFileSafe(planPath);
      const parsed = parseTrackedFilesFromPlanContent(planContent);
      if (parsed && parsed.length > 0) {
        trackedFilesToSave = parsed;
      }
    }
  }
  if (!trackedFilesToSave) {
    trackedFilesToSave = existing.trackedFiles || [];
  }

  const updated = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    version: '1.0',
    featureId: path.basename(featureDir),
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
  };

  fs.writeFileSync(contextPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

/**
 * Guarda o actualiza la exploración de una fase en context.json de forma acumulativa.
 */
function saveFeatureExploration(featureDir, phase, explorationData = {}, cwd = process.cwd()) {
  const contextPath = path.join(featureDir, 'context.json');
  let existing = {};
  if (fs.existsSync(contextPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {}
  }

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
 * Ruta del archivo borrador de intake.
 */
function getIntakeDraftPath(cwd = process.cwd()) {
  return path.join(cwd, 'docs', 'sdd', 'vsdd', '.draft-intake.json');
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
  let existing = {};
  if (fs.existsSync(draftPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    } catch (err) {}
  }

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
 * Guarda o actualiza una respuesta consensuada de la entrevista en context.json.
 */
function saveInterviewAnswer(featureDir, phase, questionData = {}, cwd = process.cwd()) {
  const contextPath = path.join(featureDir, 'context.json');
  let existing = {};
  if (fs.existsSync(contextPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {}
  }

  const existingPhase = (existing.phases && existing.phases[phase]) || {};
  const existingInterview = existingPhase.interview || {};
  const questions = Array.isArray(existingInterview.questions) ? [...existingInterview.questions] : [];

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
  let existing = {};
  if (fs.existsSync(contextPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {}
  }

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
  const questions = Array.isArray(existingInterview.questions) ? [...existingInterview.questions] : [];

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

// -------------------------------------------------------------
// Funciones de formateo y visualización
// -------------------------------------------------------------

function extractHeaderState(content) {
  if (!content) return '';
  const match = content.match(/Estado:\s*([^\r\n]+)/i);
  return match ? match[1].trim().toLowerCase() : '';
}

function extractObjective(ideaContent, specContent, dirName, resumenContent = '') {
  if (ideaContent) {
    const problemaMatch = ideaContent.match(/## Problema\s+([\s\S]*?)(?=\n##|$)/i);
    if (problemaMatch && problemaMatch[1].trim()) {
      return truncateText(problemaMatch[1].trim(), 120);
    }
    const queMatch = ideaContent.match(/## Qué vamos a hacer\s+([\s\S]*?)(?=\n##|$)/i);
    if (queMatch && queMatch[1].trim()) {
      return truncateText(queMatch[1].trim(), 120);
    }
  }
  if (specContent) {
    const contextoMatch = specContent.match(/## Contexto y objetivos\s+([\s\S]*?)(?=\n##|$)/i);
    if (contextoMatch && contextoMatch[1].trim()) {
      return truncateText(contextoMatch[1].trim(), 120);
    }
  }
  if (resumenContent) {
    const queSeHizoMatch = resumenContent.match(/## 1\.\s*Qué se hizo\s+([\s\S]*?)(?=\n##|$)/i);
    if (queSeHizoMatch && queSeHizoMatch[1].trim()) {
      return truncateText(queSeHizoMatch[1].trim(), 120);
    }
  }
  return `Funcionalidad ${dirName.replace(/^\d+-/, '').replace(/-/g, ' ')}`;
}

function truncateText(text, maxLen) {
  const clean = text.replace(/\n+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 3) + '...';
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return '';
  }
}

/**
 * Formatea el menú visual para terminal.
 */
function formatHubMenu(features, options = {}) {
  const pending = features.filter((f) => !f.isCompleted && !f.isCancelled);
  const completed = features.filter((f) => f && f.isCompleted && !f.isCancelled);

  let banner = '';
  if (options && options.mismatchInfo && options.mismatchInfo.mismatch) {
    banner += formatMismatchBanner(options.mismatchInfo.localVersion, options.mismatchInfo.globalVersion) + '\n\n';
  }
  if (options && options.updateInfo && options.updateInfo.updateAvailable) {
    banner += formatUpdateBanner(options.updateInfo.currentVersion, options.updateInfo.latestVersion) + '\n\n';
  }

  if (pending.length === 0) {
    if (completed.length === 0) {
      return `${banner}╭────────────────────────────────────────────────────────╮
│  VSDD  ·  Panel de Funcionalidades                      │
╰────────────────────────────────────────────────────────╯

ℹ No se encontraron funcionalidades en este proyecto.
Puedes iniciar tu primera funcionalidad escribiendo: vsdd intake
`;
    }

    const topCompleted = generateFeatureCatalog(null, 3, features);
    let output = `${banner}╭────────────────────────────────────────────────────────╮
│  VSDD  ·  Panel de Funcionalidades                      │
╰────────────────────────────────────────────────────────╯

ℹ No se encontraron funcionalidades pendientes en este proyecto.

Últimas funcionalidades completadas:
`;

    topCompleted.forEach((f) => {
      const filesStr =
        f.archivosClave && f.archivosClave.length > 0
          ? ` (Archivos clave: ${f.archivosClave.join(', ')})`
          : '';
      const objStr = f.objetivo ? ` - ${f.objetivo}` : '';
      output += `  ✔ ${f.id}${objStr}${filesStr}\n`;
    });

    output += `\nPara iniciar una nueva funcionalidad: vsdd intake\n`;
    return output;
  }

  let output = `${banner}╭────────────────────────────────────────────────────────╮
│  VSDD  ·  Panel de Funcionalidades Pendientes          │
╰────────────────────────────────────────────────────────╯

Se encontraron las siguientes funcionalidades en curso:
\n`;

  pending.forEach((f, idx) => {
    output += `[${idx + 1}] ${f.id}\n`;
    output += `    • Objetivo: ${f.objective}\n`;
    output += `    • Fase actual: ${f.phaseDescription}\n`;
    if (f.totalTasks > 0) {
      output += `    • Avance: ${f.completedTasks}/${f.totalTasks} tareas (${f.pendingTasks} pendientes)\n`;
      if (f.nextTaskTitle) {
        output += `    • Próxima tarea: ${f.nextTaskTitle}\n`;
      }
    }
    if (f.drift && f.drift.label) {
      output += `    • Salud del Repo: ${f.drift.label}\n`;
    }
    output += `    • Siguiente paso: ${f.nextCommand}\n\n`;
  });

  if (completed.length > 0) {
    output += `ℹ Hay ${completed.length} funcionalidad(es) completada(s) registradas (consulta el catálogo con: vsdd --catalog).\n\n`;
  }

  output += `[N] Iniciar una nueva funcionalidad desde cero (vsdd intake)\n`;
  output += `[C] Cancelar o descartar una funcionalidad en curso (vsdd abort)\n\n`;
  output += `👉 Selecciona una opción para retomar [1-${pending.length}/N/C]: `;

  return output;
}

/**
 * Detecta si una ruta corresponde a un utilitario genérico o infraestructura común.
 * @param {string} filePath Ruta del archivo
 * @returns {boolean} True si es utilitario o archivo comodín genérico
 */
function isGenericUtility(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  const clean = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    clean.includes('node_modules/') ||
    clean.includes('vendor/') ||
    clean.includes('.git/') ||
    clean.includes('utils/') ||
    clean.includes('util/') ||
    clean.includes('helpers/') ||
    clean.includes('types/') ||
    clean.endsWith('/index.js') ||
    clean.endsWith('/index.ts') ||
    clean.endsWith('readme.md') ||
    clean.endsWith('package.json')
  );
}

/**
 * Extrae de forma segura y defensiva hasta 3 rutas de archivos clave específicas.
 * @param {string} resumenContent Contenido de resumen.md
 * @param {string} planContent Contenido de plan.md
 * @returns {Array<string>} Lista de máximo 3 rutas clave
 */
function extractArchivosClaveSafe(resumenContent, planContent) {
  const files = [];
  try {
    if (resumenContent && typeof resumenContent === 'string') {
      const compMatch = resumenContent.match(/## 2\.\s*Componentes[\s\S]*?(?=\n##|$)/i);
      if (compMatch) {
        const lines = compMatch[0].split('\n');
        for (const line of lines) {
          const fileMatch = line.match(/[-*]\s*Archivos clave:\s*([^\r\n]+)/i);
          if (fileMatch?.[1]) {
            const rawPaths = fileMatch[1].match(/[`'"]?([a-zA-Z0-9_.\-\/]+)[`'"]?/g) || [];
            for (const rp of rawPaths) {
              const cleanPath = rp.replace(/[`'"]/g, '').trim();
              if (cleanPath && !isGenericUtility(cleanPath) && !files.includes(cleanPath)) {
                files.push(cleanPath);
              }
            }
          }
        }
      }
    }
    if (files.length === 0 && planContent && typeof planContent === 'string') {
      const tracked = parseTrackedFilesFromPlanContent(planContent);
      for (const item of tracked) {
        if (item?.path && !isGenericUtility(item.path) && !files.includes(item.path)) {
          files.push(item.path);
        }
      }
    }
  } catch (e) {
    // Falla defensiva y segura
  }
  return files.slice(0, 3);
}

/**
 * Genera el catálogo ultracompacto (Header Manifest) de features completadas.
 * @param {string} cwd Directorio raíz del proyecto
 * @param {number} limit Límite de features más recientes a exportar (por defecto 15)
 * @param {Array<Object>|null} preloadedFeatures Features previamente escaneadas para evitar I/O
 * @returns {Array<Object>} Catálogo condensado
 */
function generateFeatureCatalog(cwd = process.cwd(), limit = 15, preloadedFeatures = null) {
  const features = Array.isArray(preloadedFeatures) ? preloadedFeatures : scanFeatures(cwd);
  const completed = features.filter((f) => f && f.isCompleted);

  // Ordenar de más reciente a más antigua (por ID numérico descendente)
  completed.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));

  const slice = completed.slice(0, limit);

  return slice.map((f) => {
    const objetivo = f.objective ? truncateText(f.objective, 80) : '';
    const archivosClave = extractArchivosClaveSafe(f.resumenContent, f.planContent);
    return {
      id: f.id,
      objetivo,
      archivosClave,
    };
  });
}

/**
 * Cancela y aborta una funcionalidad o borrador de forma limpia y segura.
 * @param {string} featureId Slug o ID de la funcionalidad, o 'draft'
 * @param {Object} options Opciones { reason, deleteBranch }
 * @param {string} cwd Directorio raíz del proyecto
 * @returns {Object} Resultado de la operación
 */
function abortFeature(featureId, options = {}, cwd = process.cwd()) {
  const reason = options.reason || 'Cancelado por el usuario';
  const deleteBranch = Boolean(options.deleteBranch);

  // 1. Manejo de borrador de Intake (.draft-intake.json)
  const isDraftTarget =
    featureId === 'draft' ||
    featureId === '.draft-intake' ||
    featureId === 'draft-intake' ||
    featureId === '[Borrador] Intake en progreso';

  const intakeDraft = getIntakeDraft(cwd);
  if (isDraftTarget || (intakeDraft && intakeDraft.featureId === featureId)) {
    clearIntakeDraft(cwd);
    return {
      success: true,
      featureId: 'draft',
      isDraft: true,
      message: 'Borrador de Intake descartado con éxito.',
    };
  }

  // 2. Localizar carpeta de la funcionalidad en docs/sdd/vsdd/<featureId>
  const vsddRoot = path.join(cwd, 'docs', 'sdd', 'vsdd');
  const featDir = path.isAbsolute(featureId)
    ? featureId
    : path.join(vsddRoot, featureId);

  if (!fs.existsSync(featDir)) {
    return {
      success: false,
      featureId,
      message: `No se encontró la funcionalidad '${featureId}' en ${vsddRoot}.`,
    };
  }

  const gitRoot = getGitRoot(cwd) || cwd;

  // 3. Verificación de Seguridad Git: Árbol limpio
  if (hasGitCommits(gitRoot)) {
    const statusOutput = execGit(['status', '--porcelain'], gitRoot, 3000);
    if (statusOutput && statusOutput.trim().length > 0) {
      return {
        success: false,
        dirty: true,
        featureId: path.basename(featDir),
        message:
          'Se detectaron cambios locales sin guardar en el repositorio Git. Guarda o descarta tus cambios (con git stash o commit) antes de cancelar la funcionalidad.',
      };
    }
  }

  // 4. Leer context.json para conocer la rama asociada
  const contextPath = path.join(featDir, 'context.json');
  let contextData = {};
  if (fs.existsSync(contextPath)) {
    try {
      contextData = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (e) {
      contextData = {};
    }
  }

  const repoBranches = getRepositoryBranches(gitRoot);
  const detectedDefaultBranch = getDefaultBranch(gitRoot);
  const featureBranch = (contextData.git && contextData.git.branch) || '';
  const baseBranch = (contextData.git && contextData.git.baseBranch) || detectedDefaultBranch;
  const currentBranch = getCurrentBranch(gitRoot);

  // Helper interno para estampar cancelación en los markdown de un directorio
  function stampCancellationInDir(targetDir) {
    if (!fs.existsSync(targetDir)) return;
    const mdFiles = ['idea.md', 'spec.md', 'plan.md', 'tasks.md'];
    for (const file of mdFiles) {
      const filePath = path.join(targetDir, file);
      if (fs.existsSync(filePath)) {
        try {
          let content = fs.readFileSync(filePath, 'utf8');
          if (/^\s*Estado:\s*[^\r\n]+/mi.test(content)) {
            content = content.replace(
              /^\s*Estado:\s*[^\r\n]+/mi,
              `Estado: cancelado\nMotivo de cancelación: ${reason}`
            );
          } else {
            content = `Estado: cancelado\nMotivo de cancelación: ${reason}\n\n` + content;
          }
          fs.writeFileSync(filePath, content, 'utf8');
        } catch (e) {}
      }
    }

    // Actualizar context.json en targetDir
    const ctxPath = path.join(targetDir, 'context.json');
    let ctx = {};
    if (fs.existsSync(ctxPath)) {
      try {
        ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      } catch (e) {}
    }
    ctx.status = 'cancelado';
    ctx.cancelledAt = new Date().toISOString();
    ctx.cancelReason = reason;
    try {
      fs.writeFileSync(ctxPath, JSON.stringify(ctx, null, 2), 'utf8');
    } catch (e) {}
  }

  // 5. Estampar cancelación en la rama actual primero
  stampCancellationInDir(featDir);
  if (hasGitCommits(gitRoot) && fs.existsSync(featDir)) {
    execGit(['add', featDir], gitRoot);
    execGit(['commit', '-m', `docs(sdd): cancelar funcionalidad ${path.basename(featDir)}`], gitRoot);
  }

  let switchedBranch = false;
  let branchDeleted = false;

  let targetBranch = featureBranch;
  if (!targetBranch && currentBranch && currentBranch.includes(path.basename(featDir))) {
    targetBranch = currentBranch;
  }

  const isCurrentlyOnFeatureBranch = currentBranch && targetBranch && currentBranch === targetBranch;
  const protectedBranches = ['main', 'master', 'develop', 'dev', 'trunk', baseBranch];
  if (repoBranches.length === 1 && !protectedBranches.includes(repoBranches[0])) {
    protectedBranches.push(repoBranches[0]);
  }

  // 6. Si estamos parados en la rama de la feature y no es una rama protegida, cambiar a baseBranch
  if (isCurrentlyOnFeatureBranch && currentBranch !== baseBranch && !protectedBranches.includes(targetBranch)) {
    const checkoutRes = execGit(
      deleteBranch ? ['checkout', '-f', baseBranch] : ['checkout', baseBranch],
      gitRoot
    ) || execGit(['checkout', '-f', baseBranch], gitRoot);

    if (checkoutRes !== null) {
      switchedBranch = true;
    }

    // 7. Sincronizar cancelación en baseBranch si la carpeta existe allí
    if (fs.existsSync(featDir)) {
      stampCancellationInDir(featDir);
      if (hasGitCommits(gitRoot)) {
        execGit(['add', featDir], gitRoot);
        execGit(['commit', '-m', `docs(sdd): cancelar funcionalidad ${path.basename(featDir)}`], gitRoot);
      }
    }
  }

  const postCheckoutCurrentBranch = getCurrentBranch(gitRoot);
  if (
    deleteBranch &&
    targetBranch &&
    targetBranch !== postCheckoutCurrentBranch &&
    !protectedBranches.includes(targetBranch)
  ) {
    const delRes = execGit(['branch', '-D', targetBranch], gitRoot);
    if (delRes !== null) {
      branchDeleted = true;
    }
  }

  return {
    success: true,
    featureId: path.basename(featDir),
    switchedBranch,
    branchDeleted,
    targetBranch,
    baseBranch,
    message: `Funcionalidad '${path.basename(featDir)}' cancelada y excluida de pendientes con éxito.`,
  };
}

/**
 * Compara dos versiones semver (v1 y v2).
 * Devuelve 1 si latest > current, 0 si son iguales, -1 si current > latest.
 */
function compareSemver(current, latest) {
  const parse = (v) => (v || '').replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p1 = parse(current);
  const p2 = parse(latest);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i += 1) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num2 > num1) return 1;
    if (num2 < num1) return -1;
  }
  return 0;
}

/**
 * Obtiene la versión actual local de VSDD desde package.json.
 */
function getLocalVsddVersion(cwd = __dirname) {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) return pkg.version;
    }
  } catch (e) {}
  return '0.43.0';
}

/**
 * Formatea el banner de actualización en 40 columnas visuales con el trueno ⚡.
 */
function formatUpdateBanner(currentVersion, latestVersion) {
  const versionStr = `${currentVersion} -> ${latestVersion}`;
  const prefix = `╭── ⚡ [UPDATE] ${versionStr} `;
  const remaining = 38 - [...prefix].length;
  const topBorder = prefix + '─'.repeat(Math.max(1, remaining)) + '╮';
  const line2 = `│ Nueva versión de VSDD disponible     │`;
  const line3 = `│ Ejecuta: vsdd update                 │`;
  const botBorder = `╰──────────────────────────────────────╯`;
  return `${topBorder}\n${line2}\n${line3}\n${botBorder}`;
}

/**
 * Formatea el banner de advertencia de desincronización dual en 40 columnas visuales.
 */
function formatMismatchBanner(localVersion, globalVersion) {
  function padBox(line, width = 40) {
    const padding = Math.max(0, width - 1 - line.length);
    return line + ' '.repeat(padding) + '│';
  }

  const prefix = '╭── ⚡ [AVISO] Copia local antigua ';
  const remaining = 38 - [...prefix].length;
  const line1 = prefix + '─'.repeat(Math.max(1, remaining)) + '╮';
  const line2 = padBox('│ Tienes una skill local en el repo');
  const line3 = padBox(`│ Local: v${localVersion}  ·  Global: v${globalVersion}`);
  const line4 = padBox('│ Tu agente usará la versión local.');
  const line5 = padBox('│ Actualiza con: vsdd update');
  const line6 = '╰──────────────────────────────────────╯';
  return `${line1}\n${line2}\n${line3}\n${line4}\n${line5}\n${line6}`;
}

/**
 * Detecta si existe una instalación local de la skill en el proyecto que está
 * desactualizada respecto a una instalación global más reciente.
 * @param {string} cwd Directorio de trabajo del proyecto
 * @param {string} homeDir Directorio home del usuario
 * @returns {Object} { mismatch: boolean, localVersion?, globalVersion?, localPath?, globalPath?, reason? }
 */
function detectDualInstallationMismatch(cwd = process.cwd(), homeDir = os.homedir()) {
  const localCandidates = [
    path.join(cwd, '.agents', 'skills', 'vsdd'),
    path.join(cwd, '.claude', 'skills', 'vsdd'),
  ];

  let localSkillDir = null;
  let localVersion = null;

  for (const cand of localCandidates) {
    const skillFile = path.join(cand, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      localSkillDir = cand;
      const content = fs.readFileSync(skillFile, 'utf8');
      const vMatch = content.match(/version:\s*['"]?([0-9.]+)['"]?/i);
      if (vMatch && vMatch[1]) {
        localVersion = vMatch[1];
      }
      break;
    }
  }

  if (!localSkillDir || !localVersion) {
    return { mismatch: false };
  }

  // Si cwd es el propio repositorio de desarrollo de VSDD, no alertar sobre sí mismo
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name === 'vsdd') {
        return { mismatch: false };
      }
    }
  } catch (e) {}

  // Buscar instalación global
  const globalCandidates = [
    path.join(homeDir, '.gemini', 'config', 'skills', 'vsdd'),
    path.join(homeDir, '.claude', 'skills', 'vsdd'),
    path.join(homeDir, '.agents', 'skills', 'vsdd'),
  ];

  let globalSkillDir = null;
  let globalVersion = null;

  for (const cand of globalCandidates) {
    const skillFile = path.join(cand, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      globalSkillDir = cand;
      const content = fs.readFileSync(skillFile, 'utf8');
      const vMatch = content.match(/version:\s*['"]?([0-9.]+)['"]?/i);
      if (vMatch && vMatch[1]) {
        globalVersion = vMatch[1];
        break;
      }
    }
  }

  // Si no hay versión en SKILL.md global, usar getLocalVsddVersion()
  if (!globalVersion) {
    globalVersion = getLocalVsddVersion(__dirname);
  }

  if (globalVersion && compareSemver(localVersion, globalVersion) > 0) {
    return {
      mismatch: true,
      localVersion,
      globalVersion,
      localPath: localSkillDir,
      globalPath: globalSkillDir || 'global',
      reason: 'local_outdated',
    };
  }

  return { mismatch: false };
}

/**
 * Chequea si hay una nueva versión disponible en GitHub (con caché de 24h y timeout de red).
 */
async function checkVersionUpdate(currentVersion = getLocalVsddVersion(), options = {}) {
  const cacheDir = options.cacheDir || path.join(os.homedir(), '.vsdd');
  const cacheFile = path.join(cacheDir, 'version-cache.json');
  const interval = options.checkIntervalMs || 24 * 60 * 60 * 1000;
  const timeoutMs = options.timeoutMs || 1500;

  // 1. Revisar caché si aún está vigente
  if (!options.force && fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached.lastCheck && Date.now() - cached.lastCheck < interval) {
        return {
          updateAvailable: Boolean(cached.updateAvailable),
          latestVersion: cached.latestVersion || currentVersion,
          currentVersion,
          cached: true,
        };
      }
    } catch (e) {}
  }

  // 2. Fetch remoto (inyectable para tests o nativo con fetch)
  const fetcher =
    options.fetchRemote ||
    (async (url, ms) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    });

  try {
    const remotePkg = await fetcher(
      'https://raw.githubusercontent.com/ValentinZurita/vsdd/main/package.json',
      timeoutMs
    );
    const latestVersion = remotePkg.version || currentVersion;
    const updateAvailable = compareSemver(currentVersion, latestVersion) > 0;

    // Guardar en caché
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(
        cacheFile,
        JSON.stringify(
          {
            lastCheck: Date.now(),
            latestVersion,
            updateAvailable,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (e) {}

    return {
      updateAvailable,
      latestVersion,
      currentVersion,
      cached: false,
    };
  } catch (err) {
    return {
      updateAvailable: false,
      latestVersion: currentVersion,
      currentVersion,
      cached: false,
      error: err.message,
    };
  }
}

/**
 * Ejecuta la actualización de VSDD.
 */
function performVsddUpdate(cwd = process.cwd(), options = {}) {
  const runner = options.execCommand || ((cmd, opts) => execSync(cmd, opts));
  const isVsddRepo =
    fs.existsSync(path.join(cwd, 'SKILL.md')) &&
    fs.existsSync(path.join(cwd, 'package.json')) &&
    (() => {
      try {
        return require(path.join(cwd, 'package.json')).name === 'vsdd';
      } catch (e) {
        return false;
      }
    })();

  if (isVsddRepo) {
    try {
      const pullOut = runner('git pull origin main', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const installScript = path.join(cwd, 'scripts', 'install-skill.js');
      const installOut = runner(`node "${installScript}" --scope global --hosts all --apply --update`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return {
        success: true,
        isRepo: true,
        message: 'VSDD actualizado con éxito desde el repositorio local y sincronizado globalmente.',
        output: `${pullOut || ''}\n${installOut || ''}`.trim(),
      };
    } catch (err) {
      return {
        success: false,
        isRepo: true,
        message: `Error al actualizar VSDD desde repositorio: ${err.message}`,
        error: err.message,
      };
    }
  }

  // Ejecución en proyecto consumidor o instalación global
  try {
    const cmd = 'curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash -s -- -y';
    const updateOut = runner(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return {
      success: true,
      isRepo: false,
      message: 'VSDD actualizado con éxito a la última versión desde GitHub.',
      output: (updateOut || '').trim(),
    };
  } catch (err) {
    return {
      success: false,
      isRepo: false,
      message: `Error al ejecutar la actualización remota de VSDD: ${err.message}`,
      error: err.message,
    };
  }
}

// Punto de entrada CLI
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const cwd = process.cwd();

    function getCliDir(cliArgs, commandFlag, workingDir) {
      const dirIdx = cliArgs.indexOf(commandFlag);
      if (dirIdx !== -1 && cliArgs[dirIdx + 1] && !cliArgs[dirIdx + 1].startsWith('--')) {
        return path.resolve(workingDir, cliArgs[dirIdx + 1]);
      }
      const explicitDirIdx = cliArgs.indexOf('--dir');
      if (explicitDirIdx !== -1 && cliArgs[explicitDirIdx + 1] && !cliArgs[explicitDirIdx + 1].startsWith('--')) {
        return path.resolve(workingDir, cliArgs[explicitDirIdx + 1]);
      }
      return '';
    }

    function getCliPhase(cliArgs) {
      const phaseIdx = cliArgs.indexOf('--phase');
      if (phaseIdx !== -1 && cliArgs[phaseIdx + 1] && !cliArgs[phaseIdx + 1].startsWith('--')) {
        return cliArgs[phaseIdx + 1];
      }
      return '';
    }

    if (args.includes('--version') || args.includes('-v')) {
      const version = getLocalVsddVersion(cwd);
      if (args.includes('--json')) {
        console.log(JSON.stringify({ version }));
      } else {
        console.log(`⚡ VSDD v${version}`);
      }
      return;
    }

    if (args.includes('update') || args.includes('--update')) {
      const isJson = args.includes('--json');
      if (!isJson) {
        console.log(`╭── ⚡ ACTUALIZACIÓN DE VSDD ──────────╮\n│ Buscando e instalando última versión │\n╰──────────────────────────────────────╯\n`);
      }
      const result = performVsddUpdate(cwd);
      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(`✔ [✓ OK] ${result.message}`);
        } else {
          console.error(`✖ [✕ FAIL] ${result.message}`);
          process.exit(1);
        }
      }
    } else if (args.includes('--abort')) {
    const abortIdx = args.indexOf('--abort');
    const featureId = args[abortIdx + 1];
    if (!featureId || featureId.startsWith('--')) {
      console.error(JSON.stringify({ error: 'Debe especificar el ID de la funcionalidad a cancelar tras --abort.' }));
      process.exit(1);
    }
    const reasonIdx = args.indexOf('--reason');
    const reason = reasonIdx !== -1 && args[reasonIdx + 1] ? args[reasonIdx + 1] : '';
    const deleteBranch = args.includes('--delete-branch');
    const result = abortFeature(featureId, { reason, deleteBranch }, cwd);
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.success) {
        console.log(`✔ ${result.message}`);
        if (result.switchedBranch) {
          console.log(`  • Retornado a la rama base '${result.baseBranch || 'main'}' con éxito.`);
        }
        if (result.branchDeleted) {
          console.log(`  ⚠️ ADVERTENCIA DESTRUCTIVA: Rama de trabajo '${result.targetBranch}' eliminada permanentemente.`);
          console.log(`    Todos los cambios y commits exclusivos de esta funcionalidad fueron descartados de Git.`);
          console.log(`    (Si fue una equivocación involuntaria, puedes recuperar los commits temporalmente con: git reflog)`);
        } else if (result.targetBranch) {
          console.log(`  ℹ Rama de trabajo '${result.targetBranch}' y código preservados en Git.`);
          console.log(`    (Para descartar la rama y todo su código en el futuro, ejecuta: vsdd --abort ${result.featureId} --delete-branch)`);
        }
      } else {
        console.error(`▲ ${result.message}`);
        process.exit(1);
      }
    }
  } else if (args.includes('--catalog')) {
    const catalog = generateFeatureCatalog(cwd);
    console.log(JSON.stringify(catalog, null, 2));
  } else if (args.includes('--json')) {
    const features = scanFeatures(cwd);
    console.log(JSON.stringify(features, null, 2));
  } else if (args.includes('--intake-draft')) {
    const draft = getIntakeDraft(cwd);
    console.log(JSON.stringify(draft, null, 2));
  } else if (args.includes('--clear-intake-draft')) {
    const success = clearIntakeDraft(cwd);
    console.log(JSON.stringify({ cleared: success }, null, 2));
  } else if (args.includes('--save-intake-draft')) {
    const dataIdx = args.indexOf('--data');
    const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
    let data = {};
    try {
      data = JSON.parse(dataRaw);
    } catch (e) {
      data = { ideaSummary: dataRaw };
    }
    const result = saveIntakeDraft(data, cwd);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--promote-intake-draft')) {
    const featureDir = getCliDir(args, '--promote-intake-draft', cwd);
    if (!featureDir) {
      console.error(JSON.stringify({ error: 'Directorio de funcionalidad requerido para --promote-intake-draft' }));
      process.exit(1);
    }
    const result = promoteIntakeDraft(featureDir, cwd);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--save-exploration')) {
    const featureDir = getCliDir(args, '--save-exploration', cwd);
    const phase = getCliPhase(args);
    if (!featureDir || !phase) {
      console.error(JSON.stringify({ error: 'Parámetros requeridos: --save-exploration <dir> --phase <phase>' }));
      process.exit(1);
    }
    const dataIdx = args.indexOf('--data');
    const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
    let data = {};
    try {
      data = JSON.parse(dataRaw);
    } catch (e) {
      data = { raw: dataRaw };
    }
    const result = saveFeatureExploration(featureDir, phase, data, cwd);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--get-exploration')) {
    const featureDir = getCliDir(args, '--get-exploration', cwd);
    const phase = getCliPhase(args);
    if (!featureDir || !phase) {
      console.error(JSON.stringify({ error: 'Parámetros requeridos: --get-exploration <dir> --phase <phase>' }));
      process.exit(1);
    }
    const result = getFeatureExploration(featureDir, phase);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--save-interview')) {
    const featureDir = getCliDir(args, '--save-interview', cwd);
    const phase = getCliPhase(args);
    if (!featureDir || !phase) {
      console.error(JSON.stringify({ error: 'Parámetros requeridos: --save-interview <dir> --phase <phase>' }));
      process.exit(1);
    }
    const dataIdx = args.indexOf('--data');
    const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
    let data = {};
    try {
      data = JSON.parse(dataRaw);
    } catch (e) {
      data = { answer: dataRaw };
    }
    const result = saveInterviewAnswer(featureDir, phase, data, cwd);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--get-interview')) {
    const featureDir = getCliDir(args, '--get-interview', cwd);
    const phase = getCliPhase(args);
    if (!featureDir || !phase) {
      console.error(JSON.stringify({ error: 'Parámetros requeridos: --get-interview <dir> --phase <phase>' }));
      process.exit(1);
    }
    const result = getInterviewProgress(featureDir, phase);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--clear-interview')) {
    const featureDir = getCliDir(args, '--clear-interview', cwd);
    const phase = getCliPhase(args);
    if (!featureDir || !phase) {
      console.error(JSON.stringify({ error: 'Parámetros requeridos: --clear-interview <dir> --phase <phase>' }));
      process.exit(1);
    }
    const result = clearInterviewProgress(featureDir, phase, cwd);
    console.log(JSON.stringify(result, null, 2));
  } else if (args.includes('--save-intake-interview')) {
    const dataIdx = args.indexOf('--data');
    const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
    let data = {};
    try {
      data = JSON.parse(dataRaw);
    } catch (e) {
      data = { answer: dataRaw };
    }
    const result = saveIntakeInterviewAnswer(data, cwd);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const features = scanFeatures(cwd);
    let updateInfo = null;
    try {
      updateInfo = await checkVersionUpdate(getLocalVsddVersion(cwd), { timeoutMs: 1500 });
    } catch (e) {}
    const mismatchInfo = detectDualInstallationMismatch(cwd);
    process.stdout.write(formatHubMenu(features, { updateInfo, mismatchInfo }));
  }
  })();
}

module.exports = {
  scanFeatures,
  parseFeatureDirectory,
  resolveReferenceFile,
  resolveTargetFile,
  formatHubMenu,
  calculateFeatureDrift,
  extractTrackedFiles,
  parseTrackedFilesFromPlanContent,
  saveFeatureContext,
  saveFeatureExploration,
  getFeatureExploration,
  getIntakeDraftPath,
  saveIntakeDraft,
  getIntakeDraft,
  clearIntakeDraft,
  promoteIntakeDraft,
  saveInterviewAnswer,
  getInterviewProgress,
  clearInterviewProgress,
  saveIntakeInterviewAnswer,
  isGenericUtility,
  extractArchivosClaveSafe,
  generateFeatureCatalog,
  abortFeature,
  getGitRoot,
  hasGitCommits,
  isCommitInTree,
  getCurrentBranch,
  compareSemver,
  getLocalVsddVersion,
  formatUpdateBanner,
  formatMismatchBanner,
  detectDualInstallationMismatch,
  checkVersionUpdate,
  performVsddUpdate,
};
