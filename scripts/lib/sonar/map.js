/**
 * VSDD Sonar - Map
 * Orquestación del mapa de orientación topográfica del repositorio.
 */

const path = require('path');
const { MAX_NODES_DEFAULT } = require('./constants');
const { resolveRepoRoot, resolveSafePath, listFiles } = require('./fs');
const { summarizeTree } = require('./tree');
const { detectTestLayout } = require('./heuristics');
const { loadMemory } = require('./memory');

/**
 * Ejecuta el mapa de orientación del Sonar.
 * @param {string} cwd Directorio de trabajo
 * @param {object} options
 * @returns {object}
 */
function runSonarMap(cwd = process.cwd(), options = {}) {
  const root = resolveRepoRoot(cwd);
  const rawPath = options.path || '.';
  const safeScopeAbs = resolveSafePath(root, rawPath);
  const scopeRel = path.relative(root, safeScopeAbs).replace(/\\/g, '/') || '.';

  const listResult = listFiles(root, options);

  const summary = summarizeTree(listResult.files, {
    scope: scopeRel,
    depth: options.depth || 2,
    maxNodes: options.maxNodes || MAX_NODES_DEFAULT,
  });

  const tests = detectTestLayout(listResult.files);
  let memory = [];
  try {
    memory = loadMemory(root);
  } catch (err) {
    memory = [
      {
        id: 'corrupt',
        hypothesis: err.message,
        anchor: 'docs/sdd/vsdd/repo-memory.json',
        status: 'rota',
        reason: 'archivo corrupto o JSON inválido',
      },
    ];
  }

  return {
    root,
    scope: scopeRel,
    source: listResult.source,
    partial: listResult.partial,
    reason: listResult.reason || null,
    elapsedMs: listResult.elapsedMs,
    files: listResult.files.length,
    rootFiles: summary.rootFiles,
    omittedRootFiles: summary.omittedRootFiles || 0,
    extensions: summary.extensions,
    tree: summary.tree,
    omittedDirs: summary.omittedDirs,
    tests,
    memory,
  };
}

module.exports = {
  runSonarMap,
};
