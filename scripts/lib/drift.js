'use strict';

const fs = require('fs');
const path = require('path');
const { getGitRoot, hasGitCommits, isCommitInTree, getCurrentBranch, execGit } = require('./git');
const { readFileSafe } = require('./utils');

function parseTrackedFilesFromPlanContent(content) {
  const trackedFiles = [];
  if (!content) return trackedFiles;

  const treeSectionMatch = content.match(/##\s+(?:[0-9]+\.\s*)?[ÁáAa]rbol de cambios\s+([\s\S]*?)(?=\n##|$)/i);
  if (treeSectionMatch) {
    const lines = treeSectionMatch[1].split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*[-*]?\s*[`'"]?([+~*–-])[\s`'"]+`?([^`'"\r\n]+)`?/);
      if (match) {
        const symbol = match[1];
        const rawPath = match[2].trim();
        let action = 'modify';
        if (symbol === '+') action = 'create';
        else if (symbol === '-') action = 'delete';

        trackedFiles.push({
          path: rawPath,
          action,
        });
      }
    }
  }
  return trackedFiles;
}

function extractTrackedFiles(featureDir, planContent = '') {
  const contextPath = path.join(featureDir, 'context.json');
  const planPath = path.join(featureDir, 'plan.md');

  const hasContext = fs.existsSync(contextPath);
  const hasPlan = fs.existsSync(planPath);

  let contextData = null;
  if (hasContext) {
    try {
      contextData = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (err) {
      contextData = null;
    }
  }

  // Comprobar si plan.md es más reciente que context.json para auto-sincronizar
  let isPlanNewer = false;
  if (hasContext && hasPlan) {
    try {
      const planMtime = fs.statSync(planPath).mtimeMs;
      const contextMtime = fs.statSync(contextPath).mtimeMs;
      if (planMtime > contextMtime) {
        isPlanNewer = true;
      }
    } catch (err) {}
  }

  if (contextData && !isPlanNewer && Array.isArray(contextData.trackedFiles) && contextData.trackedFiles.length > 0) {
    return {
      source: 'context.json',
      baseCommit: contextData.git ? contextData.git.baseCommit : '',
      originalBranch: contextData.git ? contextData.git.branch : '',
      trackedFiles: contextData.trackedFiles,
    };
  }

  // Extracción dinámica desde el Árbol de Cambios de plan.md
  const content = planContent || (hasPlan ? readFileSafe(planPath) : '');
  const trackedFiles = parseTrackedFilesFromPlanContent(content);

  return {
    source: hasContext ? 'context.json (synced from plan)' : 'plan.md',
    baseCommit: contextData && contextData.git ? contextData.git.baseCommit : '',
    originalBranch: contextData && contextData.git ? contextData.git.branch : '',
    trackedFiles,
  };
}

/**
 * Calcula el desfase de contexto (Drift Sentinel) de una funcionalidad.
 */
function calculateFeatureDrift(featureDir, feature, cwd = process.cwd()) {
  const gitRoot = getGitRoot(cwd) || getGitRoot(featureDir);

  if (!gitRoot || !hasGitCommits(gitRoot)) {
    return {
      status: 'UNKNOWN',
      label: '⚪ Sin Git / Repositorio sin commits',
      reason: 'NO_GIT_OR_NO_COMMITS',
      details: {},
    };
  }

  const { trackedFiles, baseCommit, originalBranch, source } = extractTrackedFiles(
    featureDir,
    feature ? feature.planContent : ''
  );

  if (!trackedFiles || trackedFiles.length === 0) {
    return {
      status: 'UNKNOWN',
      label: '⚪ Sin archivos trackeados en plan',
      reason: 'NO_TRACKED_FILES',
      details: { source },
    };
  }

  const currentBranch = getCurrentBranch(gitRoot);
  const branchMismatch = Boolean(originalBranch && currentBranch && originalBranch !== currentBranch);

  // 1. CHEQUEO FÍSICO DE EXISTENCIA EN DISCO
  const missingModifiedFiles = [];
  for (const item of trackedFiles) {
    if (item.action === 'modify') {
      const fullPath = path.isAbsolute(item.path) ? item.path : path.join(gitRoot, item.path);
      if (!fs.existsSync(fullPath)) {
        missingModifiedFiles.push(item.path);
      }
    }
  }

  if (missingModifiedFiles.length > 0) {
    return {
      status: 'RED',
      label: `🔴 ${missingModifiedFiles.length} archivo(s) a modificar faltante(s) o renombrado(s)`,
      reason: 'MISSING_MODIFIED_FILE',
      details: {
        missingFiles: missingModifiedFiles,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  // 2. CHEQUEO DE HISTORIAL GIT (CAMBIOS DESDE EL BASELINE)
  const filePathsForGit = trackedFiles.map((f) => f.path);
  let commitsSinceBase = 0;
  const modifiedSinceBase = [];
  const hasValidBase = baseCommit && isCommitInTree(gitRoot, baseCommit);

  if (hasValidBase) {
    const countOutput = execGit(['rev-list', '--count', `${baseCommit}..HEAD`], gitRoot, 2000);
    commitsSinceBase = countOutput ? parseInt(countOutput.trim(), 10) || 0 : 0;

    if (commitsSinceBase > 0 && filePathsForGit.length > 0) {
      const diffOutput = execGit(
        ['diff', '--name-status', `${baseCommit}..HEAD`, '--', ...filePathsForGit],
        gitRoot,
        5000
      );

      if (diffOutput && diffOutput.trim()) {
        const lines = diffOutput.trim().split('\n');
        for (const line of lines) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const statusCode = parts[0].trim();
            const changedPath = parts[1].trim();
            modifiedSinceBase.push({
              status: statusCode,
              path: changedPath,
            });
          }
        }
      }
    }
  }

  // 3. CHEQUEO DE ESTADO SUCIO LOCAL (UNCOMMITTED CHANGES)
  const dirtyLocalFiles = [];
  if (filePathsForGit.length > 0) {
    const statusOutput = execGit(
      ['status', '--porcelain', '--', ...filePathsForGit],
      gitRoot,
      5000
    );

    if (statusOutput) {
      const lines = statusOutput.split('\n');
      for (const line of lines) {
        if (!line || line.length < 4) continue;
        const rawPath = line.substring(3).trim();
        const cleanPath = rawPath.replace(/^"|"$/g, '');
        const finalPath = cleanPath.includes(' -> ') ? cleanPath.split(' -> ')[1].trim() : cleanPath;
        dirtyLocalFiles.push(finalPath);
      }
    }
  }

  // Clasificación final del semáforo
  if (modifiedSinceBase.length > 0) {
    return {
      status: 'YELLOW',
      label: `🟡 ${modifiedSinceBase.length} archivo(s) con cambios desde el baseline (+${commitsSinceBase} commits desde el baseline)`,
      reason: 'MODIFIED_UPSTREAM',
      details: {
        commitsSinceBase,
        commitsBehind: commitsSinceBase,
        modifiedFiles: modifiedSinceBase.map((m) => m.path),
        dirtyLocalFiles,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  if (dirtyLocalFiles.length > 0) {
    return {
      status: 'YELLOW',
      label: `🟡 ${dirtyLocalFiles.length} archivo(s) con cambios locales no commiteados`,
      reason: 'DIRTY_LOCAL',
      details: {
        commitsSinceBase,
        commitsBehind: commitsSinceBase,
        dirtyLocalFiles,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  if (branchMismatch) {
    return {
      status: 'YELLOW',
      label: `🟡 Rama distinta al baseline (${originalBranch} → ${currentBranch})`,
      reason: 'BRANCH_MISMATCH',
      details: {
        ...(hasValidBase ? {
          commitsSinceBase,
          commitsBehind: commitsSinceBase,
        } : {}),
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  if (hasValidBase) {
    return {
      status: 'GREEN',
      label: '🟢 Sin cambios en los archivos del plan desde el baseline',
      reason: 'SYNCED',
      details: {
        commitsSinceBase,
        commitsBehind: commitsSinceBase,
        branchMismatch,
        originalBranch,
        currentBranch,
        source,
      },
    };
  }

  return {
    status: 'GREEN',
    label: '🟢 Sin cambios locales detectados (sin commit base histórico)',
    reason: 'NO_BASE_COMMIT_CLEAN',
    details: {
      branchMismatch,
      originalBranch,
      currentBranch,
      source,
    },
  };
}

module.exports = {
  parseTrackedFilesFromPlanContent,
  extractTrackedFiles,
  calculateFeatureDrift,
};
