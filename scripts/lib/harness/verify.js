'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readFileSafe } = require('../utils');
const { hasGitCommits } = require('../git');
const { saveFeatureContext } = require('../state');
const { parseTasksFromMarkdown } = require('./brief');
const { inspectTestPurity, inspectProductionCode } = require('./analyzer');
const { computeFileSha256, detectTestCommand, defaultRunner } = require('./seal');

/**
 * Lee context.json de la funcionalidad o retorna un objeto vacío.
 */
function readContextOrEmpty(featureDir) {
  const ctxPath = path.join(featureDir, 'context.json');
  if (!fs.existsSync(ctxPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
  } catch (err) {
    return {};
  }
}

/**
 * Extrae las rutas de archivos autorizados para una tarea desde tasks.md (inline o sub-viñetas).
 */
function extractTaskFiles(featureDir, taskId) {
  const tasksContent = readFileSafe(path.join(featureDir, 'tasks.md')) || '';
  const allTasks = parseTasksFromMarkdown(tasksContent);
  const target = allTasks.find((t) => t.id === String(taskId || '').toUpperCase());
  if (!target) {
    return [];
  }

  const idx = target.lines.findIndex((l) => /\barchivos\b/i.test(l));
  if (idx === -1) {
    return [];
  }
  const inlinePart = target.lines[idx].replace(/^.*?\barchivos\b\s*:?\s*\*?\*?\s*/i, '');
  const rawChunks = [inlinePart];
  for (let i = idx + 1; i < target.lines.length; i += 1) {
    const line = target.lines[i].trim();
    if (!line || /^[-*]\s*(?:\*\*|\[\s*[xX ]\s*\])/.test(line)) {
      break;
    }
    rawChunks.push(line.replace(/^[-*]\s*/, ''));
  }
  return rawChunks
    .join(',')
    .split(/[,;]/)
    .map((item) => item.replace(/[`*]/g, '').replace(/^[~+-]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Filtra únicamente los archivos de código de producción excluyendo tests y documentación.
 */
function filterProductionFiles(fileList, sealsMap = {}) {
  return fileList.filter((relPath) => {
    const norm = relPath.replace(/\\/g, '/');
    if (sealsMap[norm]) {
      return false;
    }
    if (/^tests?\//i.test(norm) || /\.(?:test|spec)\.[^.]+$/i.test(norm)) {
      return false;
    }
    if (/^docs\//i.test(norm) || /\.md$/i.test(norm)) {
      return false;
    }
    return true;
  });
}

/**
 * Comprueba que los archivos de prueba sellados mantengan su SHA-256 y pureza intactos.
 */
function checkSealedIntegrity(sealsMap, taskId, cwd) {
  const entries = Object.entries(sealsMap || {}).filter(
    ([, seal]) => seal && seal.status === 'locked' && (!seal.taskId || seal.taskId === taskId)
  );
  const literals = [];

  for (const [relPath, seal] of entries) {
    const absPath = path.resolve(cwd, relPath);
    if (!fs.existsSync(absPath)) {
      return {
        valid: false,
        errors: [`Archivo de prueba sellado desaparecido: ${relPath}`],
      };
    }
    const currentHash = computeFileSha256(absPath);
    const content = fs.readFileSync(absPath, 'utf8');
    const purity = inspectTestPurity(content);
    if (currentHash !== seal.sha256 || !purity.valid) {
      return {
        valid: false,
        errors: [`Violación de candado criptográfico en test sellado: ${relPath}`],
      };
    }
    if (Array.isArray(seal.literals)) {
      literals.push(...seal.literals);
    }
  }
  return { valid: true, literals };
}

/**
 * Restaura en Git exclusivamente los archivos de producción autorizados de la tarea.
 */
function restoreTaskProductionFiles(prodFiles, cwd, gitFn) {
  if (!prodFiles || prodFiles.length === 0) {
    return false;
  }
  if (typeof gitFn === 'function') {
    gitFn(prodFiles, cwd);
    return true;
  }
  if (!hasGitCommits(cwd)) {
    return false;
  }

  for (const relFile of prodFiles) {
    const checkHead = spawnSync('git', ['cat-file', '-e', `HEAD:${relFile}`], { cwd });
    if (checkHead.status === 0) {
      spawnSync('git', ['checkout', '--', relFile], { cwd });
    } else if (fs.existsSync(path.resolve(cwd, relFile))) {
      fs.unlinkSync(path.resolve(cwd, relFile));
    }
  }
  return true;
}

/**
 * Construye la ficha didáctica del Analista (máximo 12 líneas y <= 80 columnas).
 */
function buildAnalystDiagnostic(taskId, reason) {
  return [
    `🔎 Analista VSDD: Pausa de seguridad en ${taskId} (${reason})`,
    'Es como intentar abrir una cerradura forzando tres veces la misma',
    'llave doblada: seguir empujando solo rompería el cilindro.',
    '✔ Estado Git: Código productivo de la tarea restaurado a limpio.',
    'Opciones para destrabar:',
    '  1. Ajustar regla o ejemplo en spec.md si el requisito cambió.',
    '  2. Instruir al agente con una pista técnica concreta.',
    '  3. Escalar la tarea a un modelo de mayor capacidad.',
  ].join('\n');
}

/**
 * Inspecciona la higiene estructural de los archivos de producción autorizados.
 */
function inspectAuthorizedFiles(prodFiles, literals, cwd, options) {
  const allViolations = [];
  for (const relFile of prodFiles) {
    const absFile = path.resolve(cwd, relFile);
    if (!fs.existsSync(absFile)) {
      continue;
    }
    const content = fs.readFileSync(absFile, 'utf8');
    const report = inspectProductionCode(content, literals, options);
    if (!report.valid) {
      allViolations.push(
        ...report.violations.map((v) => ({ ...v, file: relFile }))
      );
    }
  }
  return {
    valid: allViolations.length === 0,
    violations: allViolations,
    errors: allViolations.map((v) => `${v.file}: ${v.message}`),
  };
}

/**
 * Persiste el estado actualizado de un intento fallido en context.json.
 */
function persistFailedAttempt(featureDir, taskId, prevTask, update, cwd) {
  const history = Array.isArray(prevTask.history) ? [...prevTask.history] : [];
  history.push({
    attempt: update.attempt,
    result: 'fail',
    reason: update.reason,
    summary: update.summary,
    restored: update.rollbackExecuted,
  });

  saveFeatureContext(
    featureDir,
    {
      harness: {
        tasks: {
          [taskId]: {
            ...prevTask,
            attempts: update.attempt,
            maxAttempts: prevTask.maxAttempts || 3,
            status: update.status,
            rollbackExecuted: update.rollbackExecuted,
            analystRequired: update.analystRequired,
            history,
          },
        },
      },
    },
    cwd
  );
}

/**
 * Registra un intento fallido y aplica el cortacircuitos 2+1 cuando corresponde.
 */
function handleVerificationFailure(featureDir, taskId, failure, prodFiles, options) {
  const cwd = options.cwd || process.cwd();
  const existing = readContextOrEmpty(featureDir);
  const tasksMap = (existing.harness && existing.harness.tasks) || {};
  const prevTask = tasksMap[taskId] || {};
  const attempt = (prevTask.attempts || 0) + 1;

  const rollbackExecuted =
    attempt >= 2 ? restoreTaskProductionFiles(prodFiles, cwd, options.gitFn) : false;
  const analystRequired = attempt >= 3;
  const status =
    attempt === 1
      ? 'retrying'
      : attempt === 2
        ? 'clean_retry_required'
        : 'blocked_analyst';

  persistFailedAttempt(
    featureDir,
    taskId,
    prevTask,
    {
      attempt,
      status,
      rollbackExecuted,
      analystRequired,
      reason: failure.reason,
      summary: (failure.errors && failure.errors[0]) || failure.reason,
    },
    cwd
  );

  return {
    ok: false,
    valid: false,
    reason: failure.reason,
    attempt,
    status,
    rollbackExecuted,
    restored: rollbackExecuted,
    analystRequired,
    violations: failure.violations || [],
    errors: failure.errors || [failure.reason],
    diagnostic: analystRequired ? buildAnalystDiagnostic(taskId, failure.reason) : '',
  };
}

/**
 * Registra el estado verificado en verde para la tarea en context.json.
 */
function markTaskVerified(featureDir, normTaskId, prevTask, cwd) {
  saveFeatureContext(
    featureDir,
    {
      harness: {
        tasks: {
          [normTaskId]: { ...prevTask, status: 'verified', analystRequired: false },
        },
      },
    },
    cwd
  );
  return {
    ok: true,
    valid: true,
    reason: 'VERIFIED',
    status: 'verified',
    attempt: prevTask.attempts || 0,
    rollbackExecuted: false,
    restored: false,
    analystRequired: false,
    violations: [],
    errors: [],
    diagnostic: '',
  };
}

/**
 * Verifica integridad SHA-256, ejecución en Verde, higiene de código y cortacircuitos 2+1.
 */
function verifyTask(featureDir, taskId, options = {}) {
  const cwd = options.cwd || process.cwd();
  const normTaskId = String(taskId || '').trim().toUpperCase();
  const existing = readContextOrEmpty(featureDir);
  const sealsMap = (existing.harness && existing.harness.seals) || {};

  const integrity = checkSealedIntegrity(sealsMap, normTaskId, cwd);
  if (!integrity.valid) {
    return {
      ok: false,
      valid: false,
      reason: 'INTEGRITY_VIOLATION',
      errors: integrity.errors,
      violations: [],
    };
  }

  const savedCmd = existing.harness && existing.harness.testCommand;
  const testCommand = detectTestCommand(cwd, options.cmd || savedCmd || '');
  const runner = typeof options.runnerFn === 'function' ? options.runnerFn : defaultRunner;
  const runRes = runner(testCommand, { cwd, timeoutMs: options.timeoutMs || 30000 });
  const exitCode = runRes.exitCode !== undefined ? runRes.exitCode : runRes.status;
  const prodFiles = filterProductionFiles(extractTaskFiles(featureDir, normTaskId), sealsMap);

  if (runRes.timedOut || exitCode !== 0) {
    const errMsg = [runRes.stderr || 'Las pruebas no pasaron en Verde.'];
    return handleVerificationFailure(
      featureDir,
      normTaskId,
      { reason: 'TEST_FAILED', errors: errMsg },
      prodFiles,
      options
    );
  }

  const hygiene = inspectAuthorizedFiles(prodFiles, integrity.literals, cwd, options);
  if (!hygiene.valid) {
    return handleVerificationFailure(
      featureDir,
      normTaskId,
      { reason: 'HYGIENE_VIOLATION', violations: hygiene.violations, errors: hygiene.errors },
      prodFiles,
      options
    );
  }

  const prevTask = (existing.harness && existing.harness.tasks && existing.harness.tasks[normTaskId]) || {};
  return markTaskVerified(featureDir, normTaskId, prevTask, cwd);
}

module.exports = {
  verifyTask,
  verifyTaskHarness: verifyTask,
  restoreTaskProductionFiles,
  buildAnalystDiagnostic,
};
