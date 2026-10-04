/**
 * VSDD Oracle - Sanitizers
 * Funciones de sanitización y formateo léxico de strings para stubs de test multilingües.
 */

'use strict';

/**
 * Sanitiza un string para usar como identificador en nombres de tests o funciones.
 * @param {string} str
 * @returns {string}
 */
function toIdentifier(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'caso';
}

/**
 * Sanitiza un string reemplazando saltos de línea por espacios en blanco y recortando extremos.
 * @param {string} str
 * @returns {string}
 */
function sanitizeOneLine(str) {
  return (str || '').replace(/\r?\n/g, ' ').trim();
}

/**
 * Escapa strings para literales en comillas simples (TypeScript / JavaScript).
 * @param {string} str
 * @returns {string}
 */
function escapeJsString(str) {
  return sanitizeOneLine(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

/**
 * Escapa strings para literales en comillas dobles (C# / Go).
 * @param {string} str
 * @returns {string}
 */
function escapeDoubleQuoteString(str) {
  return sanitizeOneLine(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * Sanitiza contenido para docstrings en Python evitando que comillas triples o barras
 * invertidas finales provoquen SyntaxError.
 * @param {string} str
 * @returns {string}
 */
function sanitizePythonDocstring(str) {
  let cleaned = (str || '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const match = cleaned.match(/\\+$/);
  if (match && match[0].length % 2 !== 0) {
    cleaned += '\\';
  }
  return cleaned;
}

/**
 * Limpia prefijos comunes de salida en criterios y ejemplos de Example Mapping.
 * @param {string} str
 * @returns {string}
 */
function cleanExpected(str) {
  return (str || '')
    .trim()
    .replace(/^[*_]*(?:resultado(?:\s+(?:observable|esperado))?|salida(?:\s+esperada)?):?[*_]*\s*/i, '')
    .trim();
}

/**
 * Limpia prefijos comunes de entrada en criterios y ejemplos de Example Mapping.
 * @param {string} str
 * @returns {string}
 */
function cleanInput(str) {
  return (str || '')
    .trim()
    .replace(/^[*_]*entrada:?[*_]*\s*/i, '')
    .trim();
}

module.exports = {
  toIdentifier,
  sanitizeOneLine,
  escapeJsString,
  escapeDoubleQuoteString,
  sanitizePythonDocstring,
  cleanExpected,
  cleanInput,
};
