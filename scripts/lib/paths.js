'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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
    path.resolve(__dirname, '..', '..', 'references', phaseFile),
    path.resolve(__dirname, '..', 'references', phaseFile),
    path.join(cwd, '.agents', 'skills', 'vsdd', 'references', phaseFile),
    path.join(cwd, '.claude', 'skills', 'vsdd', 'references', phaseFile),
    path.join(os.homedir(), '.gemini', 'config', 'skills', 'vsdd', 'references', phaseFile),
    path.join(os.homedir(), '.claude', 'skills', 'vsdd', 'references', phaseFile),
    path.join(os.homedir(), '.agents', 'skills', 'vsdd', 'references', phaseFile),
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
 * Ruta del archivo borrador de intake.
 * @param {string} cwd Directorio de trabajo
 * @returns {string} Ruta absoluta o relativa al borrador
 */
function getIntakeDraftPath(cwd = process.cwd()) {
  return path.join(cwd, 'docs', 'sdd', 'vsdd', '.draft-intake.json');
}

module.exports = {
  resolveReferenceFile,
  resolveTargetFile,
  getIntakeDraftPath,
};
