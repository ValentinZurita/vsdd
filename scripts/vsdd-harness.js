#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assembleBrief } = require('./lib/harness/brief');
const { sealTestFile } = require('./lib/harness/seal');

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

  if (parsed.subcommand === 'brief') {
    return handleBriefCommand(parsed, baseCwd);
  }
  if (parsed.subcommand === 'seal') {
    return handleSealCommand(parsed, baseCwd, options);
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
  runHarness,
};
