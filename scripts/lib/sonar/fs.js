'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DEFAULT_TIMEOUT_MS, MAX_FS_FILES, IGNORED_FS_DIRS } = require('./constants');

/**
 * Lista los archivos del repositorio de forma agnóstica y veloz.
 * Intenta `git ls-files` primero (incluye staged y untracked respetando .gitignore).
 * Si no hay Git o falla, recurre a escaneo de FS con saltos a carpetas ignoradas comunes.
 * @param {string} root
 * @param {object} options
 * @returns {object}
 */
function listFiles(root, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();

  try {
    const gitOut = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      {
        cwd: root,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    if (typeof gitOut === 'string') {
      const files = gitOut
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      return {
        files,
        source: 'git',
        partial: false,
        elapsedMs: Date.now() - startTime,
      };
    }
  } catch (err) {
    // Si falló por timeout
    if (err && (err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM')) {
      return {
        files: [],
        source: 'git',
        partial: true,
        reason: 'timeout',
        elapsedMs: Date.now() - startTime,
      };
    }
  }

  // Fallback a recorrido de sistema de archivos
  const files = [];
  let partial = false;
  let reason = null;

  function walk(currentDir, currentDepth) {
    if (partial) return;
    if (Date.now() - startTime > timeoutMs) {
      partial = true;
      reason = 'timeout';
      return;
    }
    if (files.length >= MAX_FS_FILES) {
      partial = true;
      reason = 'max_files_exceeded';
      return;
    }
    if (currentDepth > 6) return;

    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (entry.isDirectory()) {
        if (IGNORED_FS_DIRS.has(entry.name)) continue;
        walk(path.join(currentDir, entry.name), currentDepth + 1);
      } else if (entry.isFile()) {
        const full = path.join(currentDir, entry.name);
        const rel = path.relative(root, full).replace(/\\/g, '/');
        files.push(rel);
      }
    }
  }

  walk(root, 0);

  return {
    files,
    source: 'fs',
    partial,
    reason,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Confinamiento de seguridad: valida que targetPath resuelva estrictamente dentro de repoRoot.
 * Lanza error si intenta escapar o si es una ruta absoluta exterior.
 * @param {string} repoRoot
 * @param {string} targetPath
 * @returns {string} Ruta absoluta canónica dentro del repositorio
 */
function resolveSafePath(repoRoot, targetPath) {
  if (!targetPath) return repoRoot;
  const absRoot = path.resolve(repoRoot);
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(absRoot, targetPath);

  const rel = path.relative(absRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Acceso denegado: la ruta '${targetPath}' intenta escapar fuera de la raíz del repositorio.`
    );
  }

  // Comprobación de symlinks físicos si existen en disco
  try {
    let realRoot = absRoot;
    if (fs.existsSync(absRoot)) {
      realRoot = fs.realpathSync(absRoot);
    }
    if (fs.existsSync(resolved)) {
      const realResolved = fs.realpathSync(resolved);
      const relReal = path.relative(realRoot, realResolved);
      if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
        throw new Error(
          `Acceso denegado: el symlink '${targetPath}' apunta fuera de la raíz del repositorio.`
        );
      }
    }
  } catch (err) {
    if (err.message && err.message.startsWith('Acceso denegado:')) throw err;
  }

  return resolved;
}

/**
 * Obtiene la raíz del repositorio Git o la carpeta actual.
 * @param {string} cwd
 * @returns {string}
 */
function resolveRepoRoot(cwd = process.cwd()) {
  try {
    const stdout = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      timeout: 1000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (stdout && stdout.trim()) {
      return stdout.trim();
    }
  } catch (_) {}
  return path.resolve(cwd);
}

module.exports = {
  listFiles,
  resolveSafePath,
  resolveRepoRoot,
};
