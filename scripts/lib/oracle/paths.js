/**
 * VSDD Oracle - Paths
 * Resolución de rutas y localización de especificaciones (spec.md) en docs/sdd/vsdd.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Localiza la ruta del spec.md a partir de un identificador de feature o búsqueda en docs/sdd/vsdd.
 * @param {string} [featureArg]
 * @param {string} [cwd=process.cwd()]
 * @returns {string|null}
 */
function resolveSpecPath(featureArg, cwd = process.cwd()) {
  // 1. Si se pasó una ruta directa existente
  if (featureArg && fs.existsSync(path.resolve(cwd, featureArg))) {
    const resolved = path.resolve(cwd, featureArg);
    if (fs.statSync(resolved).isDirectory()) {
      const candidate = path.join(resolved, 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return resolved;
    }
  }

  // 2. Si se pasó un identificador (ej: 001 o 001-galeria)
  const baseDir = path.join(cwd, 'docs', 'sdd', 'vsdd');
  if (featureArg && fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir);
    const match = entries.find((e) => e === featureArg || e.startsWith(featureArg + '-'));
    if (match) {
      const candidate = path.join(baseDir, match, 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  if (featureArg) {
    return null;
  }

  // 3. Autodetectar si hay una sola feature en docs/sdd/vsdd (solo si no se pasó featureArg)
  if (fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir).filter((e) => {
      const full = path.join(baseDir, e);
      return fs.statSync(full).isDirectory() && !e.startsWith('.');
    });
    if (entries.length === 1) {
      const candidate = path.join(baseDir, entries[0], 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    }
    // Si hay varias, tomar la última ordenada numéricamente
    if (entries.length > 1) {
      entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
      for (const e of entries) {
        const candidate = path.join(baseDir, e, 'spec.md');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

module.exports = {
  resolveSpecPath,
};
