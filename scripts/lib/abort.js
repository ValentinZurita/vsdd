'use strict';

const fs = require('fs');
const path = require('path');
const { getIntakeDraft, clearIntakeDraft } = require('./state');
const {
  getGitRoot,
  hasGitCommits,
  execGit,
  getRepositoryBranches,
  getDefaultBranch,
  getCurrentBranch,
} = require('./git');

/**
 * Cancela y aborta una funcionalidad o borrador de forma limpia y segura.
 */
function abortFeature(featureId, options = {}, cwd = process.cwd()) {
  const reason = options.reason || 'Cancelado por el usuario';
  const deleteBranch = Boolean(options.deleteBranch);

  // 1. Manejo de borrador de Intake (.draft-intake.json)
  const isDraftTarget =
    featureId === 'draft' ||
    featureId === '.draft-intake' ||
    featureId === 'draft-intake' ||
    featureId === '[Borrador] Intake en progreso';

  const intakeDraft = getIntakeDraft(cwd);
  if (isDraftTarget || (intakeDraft && intakeDraft.featureId === featureId)) {
    clearIntakeDraft(cwd);
    return {
      success: true,
      featureId: 'draft',
      isDraft: true,
      message: 'Borrador de Intake descartado con éxito.',
    };
  }

  // 2. Localizar carpeta de la funcionalidad en docs/sdd/vsdd/<featureId>
  const vsddRoot = path.join(cwd, 'docs', 'sdd', 'vsdd');
  const featDir = path.isAbsolute(featureId)
    ? featureId
    : path.join(vsddRoot, featureId);

  if (!fs.existsSync(featDir)) {
    return {
      success: false,
      featureId,
      message: `No se encontró la funcionalidad '${featureId}' en ${vsddRoot}.`,
    };
  }

  const gitRoot = getGitRoot(cwd) || cwd;

  // 3. Verificación de Seguridad Git: Árbol limpio
  if (hasGitCommits(gitRoot)) {
    const statusOutput = execGit(['status', '--porcelain'], gitRoot, 3000);
    if (statusOutput && statusOutput.trim().length > 0) {
      return {
        success: false,
        dirty: true,
        featureId: path.basename(featDir),
        message:
          'Se detectaron cambios locales sin guardar en el repositorio Git. Guarda o descarta tus cambios (con git stash o commit) antes de cancelar la funcionalidad.',
      };
    }
  }

  // 4. Leer context.json para conocer la rama asociada
  const contextPath = path.join(featDir, 'context.json');
  let contextData = {};
  if (fs.existsSync(contextPath)) {
    try {
      contextData = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
    } catch (e) {
      contextData = {};
    }
  }

  const repoBranches = getRepositoryBranches(gitRoot);
  const detectedDefaultBranch = getDefaultBranch(gitRoot);
  const featureBranch = (contextData.git && contextData.git.branch) || '';
  const baseBranch = (contextData.git && contextData.git.baseBranch) || detectedDefaultBranch;
  const currentBranch = getCurrentBranch(gitRoot);

  // Helper interno para estampar cancelación en los markdown de un directorio
  function stampCancellationInDir(targetDir) {
    if (!fs.existsSync(targetDir)) return;
    const mdFiles = ['idea.md', 'spec.md', 'plan.md', 'tasks.md'];
    for (const file of mdFiles) {
      const filePath = path.join(targetDir, file);
      if (fs.existsSync(filePath)) {
        try {
          let content = fs.readFileSync(filePath, 'utf8');
          if (/^\s*Estado:\s*[^\r\n]+/mi.test(content)) {
            content = content.replace(
              /^\s*Estado:\s*[^\r\n]+/mi,
              `Estado: cancelado\nMotivo de cancelación: ${reason}`
            );
          } else {
            content = `Estado: cancelado\nMotivo de cancelación: ${reason}\n\n` + content;
          }
          fs.writeFileSync(filePath, content, 'utf8');
        } catch (e) {}
      }
    }

    const ctxPath = path.join(targetDir, 'context.json');
    let ctx = {};
    if (fs.existsSync(ctxPath)) {
      try {
        ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      } catch (e) {}
    }
    ctx.status = 'cancelado';
    ctx.cancelledAt = new Date().toISOString();
    ctx.cancelReason = reason;
    try {
      fs.writeFileSync(ctxPath, JSON.stringify(ctx, null, 2), 'utf8');
    } catch (e) {}
  }

  // 5. Estampar cancelación en la rama actual primero
  stampCancellationInDir(featDir);
  if (hasGitCommits(gitRoot) && fs.existsSync(featDir)) {
    execGit(['add', featDir], gitRoot);
    execGit(['commit', '-m', `docs(sdd): cancelar funcionalidad ${path.basename(featDir)}`], gitRoot);
  }

  let switchedBranch = false;
  let branchDeleted = false;

  let targetBranch = featureBranch;
  if (!targetBranch && currentBranch && currentBranch.includes(path.basename(featDir))) {
    targetBranch = currentBranch;
  }

  const isCurrentlyOnFeatureBranch = currentBranch && targetBranch && currentBranch === targetBranch;
  const protectedBranches = ['main', 'master', 'develop', 'dev', 'trunk', baseBranch];
  if (repoBranches.length === 1 && !protectedBranches.includes(repoBranches[0])) {
    protectedBranches.push(repoBranches[0]);
  }

  // 6. Si estamos parados en la rama de la feature y no es una rama protegida, cambiar a baseBranch
  if (isCurrentlyOnFeatureBranch && currentBranch !== baseBranch && !protectedBranches.includes(targetBranch)) {
    const checkoutRes = execGit(
      deleteBranch ? ['checkout', '-f', baseBranch] : ['checkout', baseBranch],
      gitRoot
    ) || execGit(['checkout', '-f', baseBranch], gitRoot);

    if (checkoutRes !== null) {
      switchedBranch = true;
    }

    // 7. Sincronizar cancelación en baseBranch si la carpeta existe allí
    if (fs.existsSync(featDir)) {
      stampCancellationInDir(featDir);
      if (hasGitCommits(gitRoot)) {
        execGit(['add', featDir], gitRoot);
        execGit(['commit', '-m', `docs(sdd): cancelar funcionalidad ${path.basename(featDir)}`], gitRoot);
      }
    }
  }

  const postCheckoutCurrentBranch = getCurrentBranch(gitRoot);
  if (
    deleteBranch &&
    targetBranch &&
    targetBranch !== postCheckoutCurrentBranch &&
    !protectedBranches.includes(targetBranch)
  ) {
    const delRes = execGit(['branch', '-D', targetBranch], gitRoot);
    if (delRes !== null) {
      branchDeleted = true;
    }
  }

  return {
    success: true,
    featureId: path.basename(featDir),
    switchedBranch,
    branchDeleted,
    targetBranch,
    baseBranch,
    message: `Funcionalidad '${path.basename(featDir)}' cancelada y excluida de pendientes con éxito.`,
  };
}

module.exports = {
  abortFeature,
};
