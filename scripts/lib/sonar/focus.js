'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DEFAULT_TIMEOUT_MS } = require('./constants');
const { resolveSafePath, resolveRepoRoot, listFiles } = require('./fs');
const { findTestCandidates } = require('./heuristics');

/**
 * Parsea el log de git y extrae archivos co-modificados junto al archivo target.
 * Omite commits que toquen más de maxFilesPerCommit (commits masivos de formato/renombre).
 * @param {string} logOutput
 * @param {string} target
 * @param {object} options
 * @returns {object}
 */
function parseCoChanges(logOutput, target, options = {}) {
  const maxFilesPerCommit = options.maxFilesPerCommit || 50;
  const top = options.top || 5;

  const normalizedTarget = path.normalize(target).replace(/\\/g, '/');
  const lines = (logOutput || '').split('\n');

  let commitsAnalyzed = 0;
  let skippedLarge = 0;
  const coCounts = {};

  let currentCommitFiles = [];

  function processCommit() {
    if (currentCommitFiles.length === 0) return;
    if (currentCommitFiles.length > maxFilesPerCommit) {
      skippedLarge++;
    } else {
      commitsAnalyzed++;
      for (const f of currentCommitFiles) {
        if (f !== normalizedTarget) {
          coCounts[f] = (coCounts[f] || 0) + 1;
        }
      }
    }
    currentCommitFiles = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@@')) {
      processCommit();
    } else {
      currentCommitFiles.push(path.normalize(trimmed).replace(/\\/g, '/'));
    }
  }
  processCommit();

  const sortedFiles = Object.entries(coCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([p, count]) => ({ path: p, count }));

  return {
    commitsAnalyzed,
    skippedLarge,
    files: sortedFiles,
  };
}

/**
 * Busca archivos que referencian el archivo target en el repositorio.
 * @param {string} root
 * @param {string} target
 * @param {string[]} allFiles
 * @param {object} options
 * @returns {object}
 */
function findReferences(root, target, allFiles, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseName = path.basename(target);
  const normalizedTarget = path.normalize(target).replace(/\\/g, '/');

  let matchedFiles = [];

  // Intento 1: git grep
  try {
    const out = execFileSync('git', ['grep', '-l', '-I', '-F', '--', baseName], {
      cwd: root,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (typeof out === 'string') {
      matchedFiles = out
        .split('\n')
        .map((l) => l.trim().replace(/\\/g, '/'))
        .filter(Boolean);
    }
  } catch (err) {
    if (err && err.status === 1) {
      // Exit code 1 en git grep significa 0 coincidencias encontradas, no error de git
      matchedFiles = [];
    } else if (Array.isArray(allFiles)) {
      // Fallback a escaneo simple sobre allFiles si no hay git
      const fallbackStart = Date.now();
      for (const f of allFiles) {
        if (Date.now() - fallbackStart > timeoutMs) break;
        if (f === normalizedTarget) continue;
        try {
          const fullPath = path.join(root, f);
          const stat = fs.statSync(fullPath);
          if (stat.size > 1024 * 1024) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes(baseName)) {
            matchedFiles.push(f);
          }
        } catch (_) {}
      }
    }
  }

  const filtered = matchedFiles.filter((f) => f !== normalizedTarget);
  const total = filtered.length;
  const isAmbiguous = total > 15;

  return {
    files: filtered.slice(0, 15),
    total,
    ambiguous: isAmbiguous,
  };
}

/**
 * Ejecuta la radiografía de foco sobre un archivo específico.
 * @param {string} cwd Directorio de trabajo
 * @param {string} targetFile Archivo a enfocar
 * @param {object} options
 * @returns {object}
 */
function runSonarFocus(cwd = process.cwd(), targetFile, options = {}) {
  const root = resolveRepoRoot(cwd);
  const safeTargetAbs = resolveSafePath(root, targetFile);

  if (!fs.existsSync(safeTargetAbs)) {
    throw new Error(`El archivo '${targetFile}' no existe en el repositorio.`);
  }

  const targetRel = path.relative(root, safeTargetAbs).replace(/\\/g, '/');
  const listResult = listFiles(root, options);
  const testCandidates = findTestCandidates(listResult.files, targetRel, options);
  const referencedBy = findReferences(root, targetRel, listResult.files, options);

  let coChanged = { commitsAnalyzed: 0, skippedLarge: 0, files: [] };
  try {
    const logOut = execFileSync(
      'git',
      [
        'log',
        '-n',
        '30',
        '--full-diff',
        '--name-only',
        '--format=tformat:@@%h',
        '--',
        targetRel,
      ],
      {
        cwd: root,
        timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    if (logOut) {
      coChanged = parseCoChanges(logOut, targetRel, options);
    }
  } catch (_) {
    // Repo sin commits o error de git
  }

  return {
    target: targetRel,
    referencedBy,
    coChanged,
    testCandidates,
  };
}

module.exports = {
  parseCoChanges,
  findReferences,
  runSonarFocus,
};
