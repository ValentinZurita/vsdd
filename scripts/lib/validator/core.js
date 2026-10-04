'use strict';

const fs = require('fs');
const path = require('path');
const { parseMarkdownLines } = require('./lexer');
const { validateUniversalHygiene } = require('./hygiene');
const {
  validateIdea,
  validateSpec,
  validatePlan,
  validateTasks,
} = require('./rules');

/**
 * Detecta el tipo de artefacto a partir del nombre o contenido
 */
function detectArtifactType(filePath, content) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'idea.md') return 'idea';
  if (base === 'spec.md') return 'spec';
  if (base === 'plan.md') return 'plan';
  if (base === 'tasks.md') return 'tasks';

  if (/^#\s+Idea\b/im.test(content)) return 'idea';
  if (/^#\s+Spec\b/im.test(content)) return 'spec';
  if (/^#\s+Plan\b/im.test(content)) return 'plan';
  if (/^#\s+(Tareas|Tasks)\b/im.test(content)) return 'tasks';

  return 'unknown';
}

/**
 * Valida un archivo individual de VSDD
 */
function validateFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return {
      filePath,
      valid: false,
      type: 'unknown',
      errors: [
        {
          line: 1,
          rule: 'archivo-no-encontrado',
          message: `El archivo '${filePath}' no existe en disco.`,
        },
      ],
      warnings: [],
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return validateContent(content, filePath, options);
}

/**
 * Valida el contenido de un artefacto en memoria
 */
function validateContent(content, filePath = 'document.md', options = {}) {
  const type = options.type || detectArtifactType(filePath, content);
  const errors = [];
  const warnings = [];

  const parsed = parseMarkdownLines(content);

  // 1. Higiene universal
  validateUniversalHygiene(parsed, errors);

  // 2. Validación de contrato según tipo
  switch (type) {
    case 'idea':
      validateIdea(parsed, errors, warnings);
      break;
    case 'spec':
      validateSpec(parsed, errors, warnings);
      break;
    case 'plan':
      validatePlan(parsed, errors, warnings);
      break;
    case 'tasks':
      validateTasks(parsed, errors, warnings, filePath, options);
      break;
    default:
      errors.push({
        line: 1,
        rule: 'tipo-artefacto-desconocido',
        message: `No se pudo determinar el tipo de artefacto VSDD para '${filePath}'. Nombres esperados: idea.md, spec.md, plan.md, tasks.md.`,
        expected: 'idea.md | spec.md | plan.md | tasks.md',
        found: path.basename(filePath),
      });
  }

  return {
    filePath,
    type,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida una carpeta de funcionalidad (e.g. docs/sdd/vsdd/001-login)
 */
function validateFeatureDir(dirPath, options = {}) {
  const results = [];
  const filesToCheck = ['idea.md', 'spec.md', 'plan.md', 'tasks.md'];

  for (const fileName of filesToCheck) {
    const fullPath = path.join(dirPath, fileName);
    if (fs.existsSync(fullPath)) {
      results.push(validateFile(fullPath, options));
    }
  }

  return results;
}

module.exports = {
  detectArtifactType,
  validateFile,
  validateContent,
  validateFeatureDir,
};
