#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

  let entries = [];
  try {
    entries = fs.readdirSync(vsddRoot, { withFileTypes: true });
  } catch (error) {
    return [];
  }

  const featureDirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  const features = [];

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

  const hasIdea = fs.existsSync(ideaPath);
  const hasSpec = fs.existsSync(specPath);
  const hasPlan = fs.existsSync(planPath);
  const hasTasks = fs.existsSync(tasksPath);

  if (!hasIdea && !hasSpec && !hasPlan && !hasTasks) {
    return null;
  }

  const ideaContent = hasIdea ? readFileSafe(ideaPath) : '';
  const specContent = hasSpec ? readFileSafe(specPath) : '';
  const planContent = hasPlan ? readFileSafe(planPath) : '';
  const tasksContent = hasTasks ? readFileSafe(tasksPath) : '';

  const ideaState = extractHeaderState(ideaContent);
  const specState = extractHeaderState(specContent);
  const planState = extractHeaderState(planContent);
  const tasksState = extractHeaderState(tasksContent);

  // Extraer resumen del objetivo
  const objective = extractObjective(ideaContent, specContent, dirName);

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

  // Determinar fase actual y estado
  let phase = 'intake';
  let phaseDescription = 'Idea inicial';
  let nextCommand = 'vsdd intake';
  let isCompleted = false;

  if (tasksState === 'completado') {
    phase = 'completado';
    phaseDescription = 'Completada y cerrada';
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
    isCompleted,
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
    },
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

// -------------------------------------------------------------
// Extracción de archivos y Manifiesto de Contexto
// -------------------------------------------------------------

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
  const trackedFiles = [];
  const content = planContent || (hasPlan ? readFileSafe(planPath) : '');

  if (content) {
    const treeSectionMatch = content.match(/## Árbol de cambios\s+([\s\S]*?)(?=\n##|$)/i);
    if (treeSectionMatch) {
      const lines = treeSectionMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*[-*]?\s*([+~-])\s+`?([^`\r\n]+)`?/);
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
  }

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
        source,
      },
    };
  }

  // 2. CHEQUEO DE HISTORIAL GIT (DIFF UPSTREAM)
  const currentBranch = getCurrentBranch(gitRoot);
  const branchMismatch = Boolean(originalBranch && currentBranch && originalBranch !== currentBranch);

  const filePathsForGit = trackedFiles.map((f) => f.path);

  let commitsBehind = 0;
  const modifiedUpstream = [];

  const hasValidBase = baseCommit && isCommitInTree(gitRoot, baseCommit);

  if (hasValidBase) {
    const countOutput = execGit(['rev-list', '--count', `${baseCommit}..HEAD`], gitRoot, 2000);
    commitsBehind = countOutput ? parseInt(countOutput.trim(), 10) || 0 : 0;

    if (commitsBehind > 0 && filePathsForGit.length > 0) {
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
            modifiedUpstream.push({
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
  if (modifiedUpstream.length > 0) {
    return {
      status: 'YELLOW',
      label: `🟡 ${modifiedUpstream.length} archivo(s) con cambios en upstream (+${commitsBehind} commits)`,
      reason: 'MODIFIED_UPSTREAM',
      details: {
        commitsBehind,
        modifiedFiles: modifiedUpstream.map((m) => m.path),
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
        commitsBehind,
        dirtyLocalFiles,
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
      label: '🟢 Al día (en sincronía con repo)',
      reason: 'SYNCED',
      details: {
        commitsBehind,
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

  const updated = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    version: '1.0',
    featureId: path.basename(featureDir),
    git: {
      branch: branch || (existing.git && existing.git.branch) || '',
      baseCommit: baseCommit || (existing.git && existing.git.baseCommit) || '',
      capturedAt: new Date().toISOString(),
    },
    trackedFiles: data.trackedFiles || existing.trackedFiles || [],
    phases: {
      ...(existing.phases || {}),
      ...(data.phases || {}),
    },
  };

  fs.writeFileSync(contextPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  return updated;
}

// -------------------------------------------------------------
// Funciones de formateo y visualización
// -------------------------------------------------------------

function extractHeaderState(content) {
  if (!content) return '';
  const match = content.match(/Estado:\s*([^\r\n]+)/i);
  return match ? match[1].trim().toLowerCase() : '';
}

function extractObjective(ideaContent, specContent, dirName) {
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
function formatHubMenu(features) {
  const pending = features.filter((f) => !f.isCompleted);

  if (pending.length === 0) {
    return `╭────────────────────────────────────────────────────────╮
│  VSDD  ·  Panel de Funcionalidades                      │
╰────────────────────────────────────────────────────────╯

ℹ No se encontraron funcionalidades pendientes en este proyecto.
Puedes iniciar una nueva funcionalidad escribiendo: vsdd intake
`;
  }

  let output = `╭────────────────────────────────────────────────────────╮
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

  output += `[N] Iniciar una nueva funcionalidad desde cero (vsdd intake)\n\n`;
  output += `👉 Selecciona una opción para retomar [1-${pending.length}/N]: `;

  return output;
}

// Punto de entrada CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const cwd = process.cwd();
  const features = scanFeatures(cwd);

  if (args.includes('--json')) {
    console.log(JSON.stringify(features, null, 2));
  } else {
    process.stdout.write(formatHubMenu(features));
  }
}

module.exports = {
  scanFeatures,
  parseFeatureDirectory,
  formatHubMenu,
  calculateFeatureDrift,
  extractTrackedFiles,
  saveFeatureContext,
  getGitRoot,
  hasGitCommits,
  isCommitInTree,
  getCurrentBranch,
};
