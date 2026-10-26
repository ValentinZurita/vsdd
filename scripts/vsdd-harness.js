#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assembleBrief } = require('./lib/harness/brief');
const { sealTestFile } = require('./lib/harness/seal');
const { verifyTask } = require('./lib/harness/verify');
const { manageAppeal } = require('./lib/harness/appeal');

/**
 * Devuelve el texto de ayuda del comando vsdd harness respetando el ancho de 80 columnas.
 */
function getHarnessHelpText() {
  return [
    '╭──────────────────────────────────────────────────────────────╮',
    '│  🛡️  VSDD HARNESS · CONTEXTO, CANDADO SHA-256 Y TRIBUNAL     │',
    '╰──────────────────────────────────────────────────────────────╯',
    '',
    'Uso:',
    '  vsdd harness brief <task-id> [--feature <id>] [--json]',
    '  vsdd harness seal <ruta-test> [--task <id>] [--cmd "<cmd>"] [--json]',
    '  vsdd harness verify <task-id> [--cmd "<cmd>"] [--feature <id>] [--json]',
    '  vsdd harness appeal --task <id> --reason "<motivo>" [--resolve <r>]',
    '',
    'Opciones:',
    '  --feature <id|dir>  Carpeta o identificador de la funcionalidad',
    '  --task <task-id>    Identificador de la tarea (ej. TASK-01)',
    '  --cmd "<comando>"   Comando explícito para ejecutar pruebas',
    '  --json              Emite la respuesta en formato JSON estructurado',
    '  --help | -h         Muestra esta ayuda',
  ].join('\n');
}

/**
 * Parsea un par bandera-valor dentro de los argumentos del CLI.
 */
function consumeFlagValue(argv, index, parsed) {
  const flagMap = {
    '--feature': 'feature',
    '-f': 'feature',
    '--task': 'taskId',
    '--test': 'testPath',
    '--cmd': 'cmd',
    '--reason': 'reason',
    '--resolve': 'resolve',
    '--status': 'status',
    '--cwd': 'cwd',
  };
  const key = flagMap[argv[index]];
  if (!key) {
    return false;
  }
  parsed[key] = argv[index + 1] || '';
  return true;
}

/**
 * Parsea los argumentos de línea de comandos para vsdd harness.
 */
function parseHarnessArgs(argv = []) {
  const parsed = {
    subcommand: '',
    positionals: [],
    feature: '',
    taskId: '',
    testPath: '',
    cmd: '',
    reason: '',
    resolve: '',
    status: '',
    cwd: '',
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h' || token === 'help') {
      parsed.help = true;
    } else if (token === '--json') {
      parsed.json = true;
    } else if (consumeFlagValue(argv, i, parsed)) {
      i += 1;
    } else if (!token.startsWith('-') && !parsed.subcommand) {
      parsed.subcommand = token;
    } else if (!token.startsWith('-')) {
      parsed.positionals.push(token);
    }
  }
  return parsed;
}

/**
 * Busca la funcionalidad activa dentro de docs/sdd/vsdd.
 */
function discoverActiveFeatureDir(vsddRoot) {
  if (!fs.existsSync(vsddRoot)) {
    return null;
  }
  try {
    const entries = fs
      .readdirSync(vsddRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();
    const withTasks = entries.filter((name) =>
      fs.existsSync(path.join(vsddRoot, name, 'tasks.md'))
    );
    const chosen = withTasks.length > 0 ? withTasks[withTasks.length - 1] : entries[entries.length - 1];
    return chosen ? path.join(vsddRoot, chosen) : null;
  } catch (err) {
    return null;
  }
}

/**
 * Resuelve la ruta absoluta de la carpeta de la funcionalidad activa o indicada.
 */
function resolveFeatureDir(featureArg, cwd = process.cwd()) {
  const vsddRoot = path.join(cwd, 'docs', 'sdd', 'vsdd');
  if (!featureArg) {
    return discoverActiveFeatureDir(vsddRoot);
  }

  const directPath = path.resolve(cwd, featureArg);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
    return directPath;
  }

  const namedPath = path.join(vsddRoot, featureArg);
  if (fs.existsSync(namedPath) && fs.statSync(namedPath).isDirectory()) {
    return namedPath;
  }

  if (fs.existsSync(vsddRoot)) {
    const match = fs
      .readdirSync(vsddRoot)
      .find((name) => name === featureArg || name.startsWith(`${featureArg}-`));
    if (match) {
      return path.join(vsddRoot, match);
    }
  }
  return null;
}

/**
 * Formatea la cabecera compacta (<= 80 columnas) para el briefing de una tarea.
 */
function formatBriefHeader(briefResult) {
  const taskId = (briefResult.meta && briefResult.meta.taskId) || 'TASK';
  const cacheLabel = briefResult.cacheHit ? 'HIT (0 tokens)' : 'MISS (regenerado)';
  const covered = ((briefResult.meta && briefResult.meta.coveredIds) || []).join(', ') || 'N/A';
  const statusLine = `✔ Tarea: ${taskId} | Caché: ${cacheLabel} | Cubre: ${covered}`.slice(0, 78);

  return [
    '╭──────────────────────────────────────────────────────────────╮',
    '│  🛡️  VSDD HARNESS · BRIEFING INTELIGENTE POR TRAZABILIDAD    │',
    '╰──────────────────────────────────────────────────────────────╯',
    statusLine,
    '────────────────────────────────────────────────────────────────',
  ].join('\n');
}

/**
 * Ejecuta el subcomando brief devolviendo estructura { exitCode, stdout, stderr, data }.
 */
function handleBriefCommand(parsed, baseCwd) {
  const taskId = parsed.taskId || parsed.positionals[0] || '';
  if (!taskId) {
    const msg = '✖ Error: Debes indicar el ID de tarea (ej. vsdd harness brief TASK-01).';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  const featureDir = resolveFeatureDir(parsed.feature, baseCwd);
  if (!featureDir || !fs.existsSync(path.join(featureDir, 'tasks.md'))) {
    const msg = '✖ Error: No se encontró una funcionalidad activa con tasks.md.';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  try {
    const result = assembleBrief(featureDir, taskId);
    const out = parsed.json
      ? JSON.stringify(result, null, 2)
      : `${formatBriefHeader(result)}\n\n${result.fullText}`;
    return { exitCode: 0, stdout: out, stderr: '', data: result };
  } catch (err) {
    const errOut = parsed.json
      ? JSON.stringify({ ok: false, error: err.message })
      : `✖ Error: ${err.message}`;
    return { exitCode: 1, stdout: '', stderr: errOut, data: null };
  }
}

/**
 * Formatea la salida en terminal (<= 80 columnas) tras sellar un archivo de pruebas.
 */
function formatSealOutput(result) {
  const shortHash = String(result.sha256 || '').slice(0, 16);
  const fileLine = `✔ Archivo sellado en Rojo: ${result.sealKey}`.slice(0, 78);
  const hashLine = `● SHA-256: ${shortHash}... | ExitCode Rojo: ${result.redExitCode}`.slice(0, 78);
  return [
    '╭──────────────────────────────────────────────────────────────╮',
    '│  🔒 VSDD HARNESS · CANDADO CRIPTOGRÁFICO SHA-256 EN ROJO     │',
    '╰──────────────────────────────────────────────────────────────╯',
    fileLine,
    hashLine,
  ].join('\n');
}

/**
 * Ejecuta el subcomando seal devolviendo { exitCode, stdout, stderr, data }.
 */
function handleSealCommand(parsed, baseCwd, options = {}) {
  const testFile = parsed.testPath || parsed.positionals[0] || '';
  if (!testFile) {
    const msg = '✖ Error: Debes indicar la ruta del archivo de pruebas a sellar.';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  const featureDir = resolveFeatureDir(parsed.feature, baseCwd);
  if (!featureDir) {
    const msg = '✖ Error: No se encontró una funcionalidad activa para registrar el sello.';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  const res = sealTestFile(featureDir, testFile, {
    cwd: baseCwd,
    taskId: parsed.taskId || null,
    cmd: parsed.cmd || '',
    runnerFn: options.runnerFn,
  });

  if (!res.ok) {
    const errOut = parsed.json
      ? JSON.stringify(res, null, 2)
      : `✖ Error al sellar prueba: ${(res.errors || []).join(' ')}`;
    return { exitCode: 1, stdout: '', stderr: errOut, data: res };
  }

  const out = parsed.json ? JSON.stringify(res, null, 2) : formatSealOutput(res);
  return { exitCode: 0, stdout: out, stderr: '', data: res };
}

/**
 * Formatea la salida en terminal (<= 80 columnas) tras verificar una tarea.
 */
function formatVerifyOutput(taskId, result) {
  if (result.ok) {
    return [
      '╭──────────────────────────────────────────────────────────────╮',
      '│  ✔ VSDD HARNESS · VERIFICACIÓN EN VERDE E HIGIENE APROBADA   │',
      '╰──────────────────────────────────────────────────────────────╯',
      `✔ Tarea ${taskId} verificada: SHA-256 intacto y código limpio.`.slice(0, 78),
    ].join('\n');
  }

  const lines = [
    `✖ Verificación fallida en ${taskId}: ${result.reason}`.slice(0, 78),
    ...(result.errors || []).map((e) => `  • ${e}`.slice(0, 78)),
  ];
  if (result.rollbackExecuted) {
    lines.push('● Cortacircuitos 2+1: Código productivo revertido a limpio.');
  }
  if (result.diagnostic) {
    lines.push('', result.diagnostic);
  }
  return lines.join('\n');
}

/**
 * Ejecuta el subcomando verify devolviendo { exitCode, stdout, stderr, data }.
 */
function handleVerifyCommand(parsed, baseCwd, options = {}) {
  const taskId = parsed.taskId || parsed.positionals[0] || '';
  if (!taskId) {
    const msg = '✖ Error: Debes indicar el ID de tarea a verificar (ej. TASK-01).';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  const featureDir = resolveFeatureDir(parsed.feature, baseCwd);
  if (!featureDir) {
    const msg = '✖ Error: No se encontró una funcionalidad activa para verificar.';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  const res = verifyTask(featureDir, taskId, {
    cwd: baseCwd,
    cmd: parsed.cmd || '',
    runnerFn: options.runnerFn,
    gitFn: options.gitFn,
  });

  const formatted = parsed.json
    ? JSON.stringify(res, null, 2)
    : formatVerifyOutput(taskId.toUpperCase(), res);

  if (!res.ok) {
    return { exitCode: 1, stdout: '', stderr: formatted, data: res };
  }
  return { exitCode: 0, stdout: formatted, stderr: '', data: res };
}

/**
 * Formatea la salida en terminal (<= 80 columnas) tras registrar o resolver una apelación.
 */
function formatAppealOutput(result) {
  const ap = result.appeal || {};
  const headerLine = `✔ Apelación ${ap.id || 'APPEAL'} (${ap.taskId || 'TASK'}): ${ap.status}`.slice(0, 78);
  const sealLine = `● Estado del candado SHA-256: ${result.sealStatus || 'locked'}`.slice(0, 78);
  return [
    '╭──────────────────────────────────────────────────────────────╮',
    '│  ⚖️  VSDD HARNESS · REGISTRO Y ARBITRAJE DE APELACIONES      │',
    '╰──────────────────────────────────────────────────────────────╯',
    headerLine,
    sealLine,
  ].join('\n');
}

/**
 * Ejecuta el subcomando appeal devolviendo { exitCode, stdout, stderr, data }.
 */
function handleAppealCommand(parsed, baseCwd) {
  const taskId = parsed.taskId || parsed.positionals[0] || '';
  const featureDir = resolveFeatureDir(parsed.feature, baseCwd);
  if (!featureDir) {
    const msg = '✖ Error: No se encontró una funcionalidad activa para apelación.';
    return { exitCode: 1, stdout: '', stderr: msg, data: null };
  }

  const res = manageAppeal(featureDir, {
    cwd: baseCwd,
    taskId,
    testPath: parsed.testPath || '',
    reason: parsed.reason,
    resolve: parsed.resolve,
    status: parsed.status,
  });

  if (!res.ok) {
    const errOut = parsed.json
      ? JSON.stringify(res, null, 2)
      : `✖ Error en apelación: ${(res.errors || []).join(' ')}`;
    return { exitCode: 1, stdout: '', stderr: errOut, data: res };
  }

  const out = parsed.json ? JSON.stringify(res, null, 2) : formatAppealOutput(res);
  return { exitCode: 0, stdout: out, stderr: '', data: res };
}

/**
 * Ejecuta el comando vsdd harness y retorna { exitCode, stdout, stderr, data }.
 */
function runHarness(argv = [], options = {}) {
  const parsed = parseHarnessArgs(argv);
  const baseCwd = options.cwd || parsed.cwd || process.cwd();

  if (parsed.help) {
    return { exitCode: 0, stdout: getHarnessHelpText(), stderr: '', data: null };
  }

  if (!parsed.subcommand) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `✖ Error: Subcomando requerido en vsdd harness.\n\n${getHarnessHelpText()}`,
      data: null,
    };
  }

  const handlers = {
    brief: () => handleBriefCommand(parsed, baseCwd),
    seal: () => handleSealCommand(parsed, baseCwd, options),
    verify: () => handleVerifyCommand(parsed, baseCwd, options),
    appeal: () => handleAppealCommand(parsed, baseCwd),
  };

  if (handlers[parsed.subcommand]) {
    return handlers[parsed.subcommand]();
  }

  return {
    exitCode: 1,
    stdout: '',
    stderr: `✖ Error: Subcomando '${parsed.subcommand}' no reconocido en vsdd harness.`,
    data: null,
  };
}

/**
 * Punto de entrada CLI cuando se invoca scripts/vsdd-harness.js directamente.
 */
function main() {
  const res = runHarness(process.argv.slice(2));
  if (res.stdout) {
    console.log(res.stdout);
  }
  if (res.stderr) {
    console.error(res.stderr);
  }
  process.exit(res.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  getHarnessHelpText,
  parseHarnessArgs,
  resolveFeatureDir,
  formatBriefHeader,
  formatSealOutput,
  formatVerifyOutput,
  runHarness,
};
