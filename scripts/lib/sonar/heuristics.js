'use strict';

const path = require('path');

/**
 * Deriva el patrón canónico de test a partir del nombre base del archivo.
 * Rechaza falsos positivos léxicos (palabras como latest, contest, protest).
 * @param {string} basename
 * @returns {string|null}
 */
function testPatternOf(basename) {
  if (!basename || typeof basename !== 'string') return null;

  // 1. Prefijo test: test_foo.py, test-foo.js, test.foo.ts
  const prefixMatch = basename.match(/^test([._-])(.+)\.([a-zA-Z0-9]+)$/i);
  if (prefixMatch) {
    const sep = prefixMatch[1];
    const ext = prefixMatch[3];
    return `test${sep}*.${ext}`;
  }

  // 2. Sufijo con separador antes de test/spec: foo_test.go, foo.test.ts, foo-test.js
  const suffixMatch = basename.match(/^(.+)([._-])(test|spec)\.([a-zA-Z0-9]+)$/i);
  if (suffixMatch) {
    const sep = suffixMatch[2];
    const kind = suffixMatch[3].toLowerCase();
    const ext = suffixMatch[4];
    return `*${sep}${kind}.${ext}`;
  }

  // 3. Sufijo CamelCase / PascalCase: FooTest.java, FooSpec.rb
  const pascalMatch = basename.match(/^(.+[a-z0-9])(Test|Spec)\.([a-zA-Z0-9]+)$/);
  if (pascalMatch) {
    const kind = pascalMatch[2];
    const ext = pascalMatch[3];
    return `*${kind}.${ext}`;
  }

  return null;
}

/**
 * Detecta convenciones y distribución de tests en la lista de archivos.
 * @param {string[]} files
 * @returns {object}
 */
function detectTestLayout(files) {
  let count = 0;
  const patterns = {};
  const dirs = new Set();

  for (const f of files) {
    const base = path.basename(f);
    const pat = testPatternOf(base);
    if (pat) {
      count++;
      patterns[pat] = (patterns[pat] || 0) + 1;
      const d = path.dirname(f).replace(/\\/g, '/');
      if (d && d !== '.') {
        dirs.add(d);
      }
    }
  }

  const allDirs = Array.from(dirs).sort();

  return {
    files: count,
    patterns,
    dirs: allDirs.slice(0, 10),
  };
}

/**
 * Encuentra posibles archivos de test candidatos asociados a un archivo objetivo.
 * @param {string[]} allFiles
 * @param {string} target
 * @param {object} options
 * @returns {string[]}
 */
function findTestCandidates(allFiles, target, options = {}) {
  const maxCandidates = options.maxCandidates || 10;
  const baseName = path.basename(target);
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;

  const results = [];
  for (const f of allFiles) {
    const fBase = path.basename(f);
    const pat = testPatternOf(fBase);
    if (pat && fBase.toLowerCase().includes(stem.toLowerCase())) {
      results.push(f);
    }
  }
  return results.sort().slice(0, maxCandidates);
}

module.exports = {
  testPatternOf,
  detectTestLayout,
  findTestCandidates,
};
