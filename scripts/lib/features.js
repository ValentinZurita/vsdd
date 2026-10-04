'use strict';

const fs = require('fs');
const path = require('path');
const { getIntakeDraft } = require('./state');
const { getIntakeDraftPath, resolveReferenceFile, resolveTargetFile } = require('./paths');
const { readFileSafe, truncateText, isGenericUtility } = require('./utils');
const { calculateFeatureDrift, parseTrackedFilesFromPlanContent } = require('./drift');

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

/**
 * Extrae de forma segura y defensiva hasta 3 rutas de archivos clave específicas.
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

  feature.drift = calculateFeatureDrift(dirPath, feature, cwd);
  return feature;
}

/**
 * Escanea el directorio docs/sdd/vsdd en busca de funcionalidades y su estado.
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
 * Genera el catálogo ultracompacto (Header Manifest) de features completadas.
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

module.exports = {
  extractHeaderState,
  extractObjective,
  extractArchivosClaveSafe,
  parseFeatureDirectory,
  scanFeatures,
  generateFeatureCatalog,
};
