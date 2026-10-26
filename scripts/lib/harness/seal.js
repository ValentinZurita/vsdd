'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { saveFeatureContext } = require('../state');
const { inspectTestPurity, extractTestLiterals } = require('./analyzer');

/**
 * Calcula el hash SHA-256 en formato hexadecimal para un archivo en disco.
 */
function computeFileSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Lee el comando de pruebas desde package.json si existe y es válido.
 */
function readPackageTestCommand(pkgPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const script = pkg.scripts && pkg.scripts.test;
    if (script && !script.includes('no test specified')) {
      return script;
    }
    return 'npm test';
  } catch (err) {
    return 'npm test';
  }
}

/**
 * Autodetecta el comando de pruebas inspeccionando manifiestos o usando el override explícito.
 */
function detectTestCommand(cwd = process.cwd(), explicitCmd = '') {
  if (explicitCmd && String(explicitCmd).trim()) {
    return String(explicitCmd).trim();
  }

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    return readPackageTestCommand(pkgPath);
  }
  if (fs.existsSync(path.join(cwd, 'pyproject.toml')) || fs.existsSync(path.join(cwd, 'pytest.ini'))) {
    return 'pytest';
  }
  if (fs.existsSync(path.join(cwd, 'go.mod'))) {
    return 'go test ./...';
  }
  if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) {
    return 'cargo test';
  }

  throw new Error(
    'No se encontró manifiesto de pruebas (package.json, pyproject.toml, go.mod, Cargo.toml). Especifique --cmd "<comando>".'
  );
}

/**
 * Ejecuta un comando de pruebas mediante spawnSync con timeout estricto de 30 segundos.
 */
function defaultRunner(command, runnerOptions = {}) {
  const cwd = runnerOptions.cwd || process.cwd();
  const timeout = runnerOptions.timeoutMs || 30000;
  const child = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    timeout,
  });

  const timedOut = Boolean(child.error && child.error.code === 'ETIMEDOUT');
  const exitCode = child.status !== null ? child.status : timedOut ? null : 1;

  return {
    exitCode,
    status: child.status,
    timedOut,
    stdout: child.stdout || '',
    stderr: child.stderr || '',
    error: child.error || null,
  };
}

/**
 * Lee el objeto context.json actual de una funcionalidad si existe.
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
 * Registra el sello criptográfico y vincula la tarea en context.json.
 */
function persistSealInContext(featureDir, payload, cwd) {
  const existing = readContextOrEmpty(featureDir);
  const existingTasks = (existing.harness && existing.harness.tasks) || {};
  const nextTasks = { ...existingTasks };

  if (payload.taskId) {
    const prevTask = existingTasks[payload.taskId] || {};
    nextTasks[payload.taskId] = {
      attempts: prevTask.attempts || 0,
      maxAttempts: prevTask.maxAttempts || 3,
      status: prevTask.status || 'in-progress',
      testFile: payload.sealKey,
      history: Array.isArray(prevTask.history) ? prevTask.history : [],
      analystRequired: Boolean(prevTask.analystRequired),
    };
  }

  saveFeatureContext(
    featureDir,
    {
      harness: {
        testCommand: payload.testCommand,
        seals: {
          [payload.sealKey]: {
            sha256: payload.sha256,
            sealedAt: payload.sealedAt,
            redExitCode: payload.redExitCode,
            taskId: payload.taskId || null,
            status: 'locked',
            literals: payload.literals,
          },
        },
        tasks: nextTasks,
      },
    },
    cwd
  );
}

/**
 * Resuelve el comando de pruebas combinando opciones, context.json o autodetección.
 */
function resolveEffectiveTestCommand(featureDir, cwd, explicitCmd) {
  if (explicitCmd && String(explicitCmd).trim()) {
    return String(explicitCmd).trim();
  }
  const existing = readContextOrEmpty(featureDir);
  const savedCmd = existing.harness && existing.harness.testCommand;
  return detectTestCommand(cwd, savedCmd || '');
}

/**
 * Ejecuta la compuerta en Rojo (Red Gate) verificando que las pruebas fallen sin timeout.
 */
function executeRedGate(testCommand, cwd, absTestPath, sealKey, options) {
  const runner = typeof options.runnerFn === 'function' ? options.runnerFn : defaultRunner;
  const runRes = runner(testCommand, {
    cwd,
    testFilePath: absTestPath,
    relTestPath: sealKey,
    timeoutMs: options.timeoutMs || 30000,
  });

  if (runRes.timedOut || (runRes.error && runRes.error.code === 'ETIMEDOUT')) {
    return {
      ok: false,
      valid: false,
      redVerified: false,
      timedOut: true,
      errors: ['Timeout de 30s excedido al ejecutar las pruebas en estado Rojo.'],
    };
  }

  const exitCode = runRes.exitCode !== undefined ? runRes.exitCode : runRes.status;
  if (exitCode === 0) {
    return {
      ok: false,
      valid: false,
      redVerified: false,
      errors: ['Red Gate fallido: el test pasa en verde antes de implementar (falso positivo).'],
    };
  }

  return { ok: true, exitCode };
}

/**
 * Verifica que un archivo de pruebas sea puro, falle en Rojo y sella su hash SHA-256 en context.json.
 */
function sealTestFile(featureDir, testFilePath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const absTestPath = path.resolve(cwd, String(testFilePath || ''));
  if (!testFilePath || !fs.existsSync(absTestPath)) {
    return {
      ok: false,
      valid: false,
      redVerified: false,
      errors: [`El archivo de pruebas no existe: ${testFilePath || '(vacío)'}`],
    };
  }

  const testContent = fs.readFileSync(absTestPath, 'utf8');
  const purity = inspectTestPurity(testContent);
  if (!purity.valid) {
    return {
      ok: false,
      valid: false,
      redVerified: false,
      violations: purity.violations,
      errors: purity.errors,
    };
  }

  let testCommand = '';
  try {
    testCommand = resolveEffectiveTestCommand(featureDir, cwd, options.cmd);
  } catch (err) {
    return { ok: false, valid: false, redVerified: false, errors: [err.message] };
  }

  const sealKey = path.relative(cwd, absTestPath).replace(/\\/g, '/');
  const redGate = executeRedGate(testCommand, cwd, absTestPath, sealKey, options);
  if (!redGate.ok) {
    return redGate;
  }

  const sha256 = computeFileSha256(absTestPath);
  const literals = extractTestLiterals(testContent);
  const sealedAt = new Date().toISOString();
  persistSealInContext(
    featureDir,
    { sealKey, sha256, sealedAt, redExitCode: redGate.exitCode, taskId: options.taskId, literals, testCommand },
    cwd
  );

  return {
    ok: true,
    valid: true,
    hash: sha256,
    sha256,
    sealKey,
    redVerified: true,
    redExitCode: redGate.exitCode,
    taskId: options.taskId || null,
    literals,
    testCommand,
    errors: [],
  };
}

module.exports = {
  computeFileSha256,
  detectTestCommand,
  defaultRunner,
  sealTestFile,
  sealTest: sealTestFile,
};
