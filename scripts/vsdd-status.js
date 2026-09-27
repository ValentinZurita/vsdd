#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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
    const feature = parseFeatureDirectory(dirName, dirPath);
    if (feature) {
      features.push(feature);
    }
  }

  return features;
}

/**
 * Parsea el contenido de una carpeta de funcionalidad.
 */
function parseFeatureDirectory(dirName, dirPath) {
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

  return {
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
  };
}

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
};
