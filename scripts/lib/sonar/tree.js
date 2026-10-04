'use strict';

const path = require('path');
const { MAX_NODES_DEFAULT } = require('./constants');

/**
 * Agrupa y resume el árbol de archivos por directorios hasta cierta profundidad.
 * @param {string[]} files Lista de rutas relativas
 * @param {object} options
 * @returns {object}
 */
function summarizeTree(files, options = {}) {
  const scope = options.scope || '.';
  const rawDepth = options.depth !== undefined ? Number(options.depth) : 2;
  const maxDepth = Math.min(Math.max(Number.isFinite(rawDepth) ? rawDepth : 2, 1), 4);
  const maxNodes = Number(options.maxNodes) || MAX_NODES_DEFAULT;

  const rootFiles = [];
  const extCounts = {};
  const dirMap = new Map();
  const normalizedScope = scope !== '.' ? path.normalize(scope).replace(/\\/g, '/') : '.';

  for (const rawFile of files) {
    let rel = path.normalize(rawFile).replace(/\\/g, '/');
    if (normalizedScope !== '.') {
      if (rel.startsWith(normalizedScope + '/')) {
        rel = rel.slice(normalizedScope.length + 1);
      } else if (rel === normalizedScope) {
        continue;
      } else {
        continue;
      }
    }

    const ext = path.extname(rel).toLowerCase();
    if (ext) {
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }

    const parts = rel.split('/');
    if (parts.length === 1) {
      rootFiles.push(parts[0]);
    } else {
      const cappedParts = parts.slice(0, Math.min(parts.length - 1, maxDepth));
      const dirPath = cappedParts.join('/');

      let dData = dirMap.get(dirPath);
      if (!dData) {
        dData = { files: 0, exts: {} };
        dirMap.set(dirPath, dData);
      }
      dData.files += 1;
      if (ext) {
        dData.exts[ext] = (dData.exts[ext] || 0) + 1;
      }
    }
  }

  // Top 8 extensiones globales
  const sortedExts = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topExtensions = {};
  for (const [k, v] of sortedExts) {
    topExtensions[k] = v;
  }

  // Ordenar directorios por conteo descendente, luego alfabético
  const allDirs = Array.from(dirMap.entries())
    .map(([dir, data]) => {
      const topExt = Object.entries(data.exts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([e]) => e);
      return {
        dir,
        files: data.files,
        top: topExt,
      };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));

  const tree = allDirs.slice(0, maxNodes);
  const omittedDirs = Math.max(0, allDirs.length - maxNodes);

  rootFiles.sort();
  const maxRootFiles = Number(options.maxRootFiles) || 15;
  const cappedRootFiles = rootFiles.slice(0, maxRootFiles);
  const omittedRootFiles = Math.max(0, rootFiles.length - maxRootFiles);

  return {
    rootFiles: cappedRootFiles,
    omittedRootFiles,
    extensions: topExtensions,
    tree,
    omittedDirs,
  };
}

module.exports = {
  summarizeTree,
};
