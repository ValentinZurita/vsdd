'use strict';

const { generateFeatureCatalog } = require('./features');

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

module.exports = {
  formatUpdateBanner,
  formatMismatchBanner,
  formatHubMenu,
};
