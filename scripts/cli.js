#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { getLocalVsddVersion } = require('./lib/version');

function getVersion(baseDir) {
  return getLocalVsddVersion(baseDir);
}

function printHelp(version) {
  console.log(`╭────────────────────────────────────────────────────────╮
│  ⚡ VSDD (Valentin Spec-Driven Development) v${(version + '       ').slice(0, 10)}│
╰────────────────────────────────────────────────────────╯

Uso:
  vsdd                              Abre el panel interactivo de funcionalidades
  vsdd validate <ruta> [--json]     Valida la estructura y formato de un artefacto VSDD
  vsdd status [--json|--catalog]    Inspecciona estado, drift y catálogo de funcionalidades
  vsdd abort <id> [--delete-branch] Cancela y excluye una funcionalidad en curso
  vsdd oracle [id] [--target <r>]   Genera el oráculo de pruebas universal desde spec.md
  vsdd sonar [opciones]             Exploración determinista y memoria del repositorio
  vsdd harness <cmd> [opciones]     Test Harness antifraude, contexto y candado SHA-256
  vsdd update [--json]              Actualiza VSDD a la última versión
  vsdd install [opciones]           Instala o actualiza la skill en tus agentes
  vsdd --version | -v               Muestra la versión instalada
  vsdd --help | -h                  Muestra esta ayuda

Comandos directos del agente:
  vsdd oracle <id> [--target <ruta>] [--dry-run|--json]
  vsdd sonar [--path <d>] [--focus <f>] [--remember <t>] [--forget <id>] [--json]
  vsdd harness brief <task-id> [--feature <id>] [--json]
  vsdd validate docs/sdd/vsdd/<slug>/idea.md
  vsdd validate docs/sdd/vsdd/<slug>/spec.md
  vsdd validate docs/sdd/vsdd/<slug>/plan.md
  vsdd validate docs/sdd/vsdd/<slug>/tasks.md
`);
}

function resolveKnownSubcommand(first, restArgs, baseDir) {
  const simpleMap = {
    validate: 'vsdd-validate.js',
    status: 'vsdd-status.js',
    install: 'install-skill.js',
    oracle: 'vsdd-oracle.js',
    'scaffold-tests': 'vsdd-oracle.js',
    scaffold: 'vsdd-oracle.js',
    sonar: 'vsdd-sonar.js',
  };

  if (simpleMap[first]) {
    return { script: path.join(baseDir, simpleMap[first]), args: restArgs };
  }
  if (first === 'abort') {
    return { script: path.join(baseDir, 'vsdd-status.js'), args: ['--abort', ...restArgs] };
  }
  if (first === 'update') {
    return { script: path.join(baseDir, 'vsdd-status.js'), args: ['update', ...restArgs] };
  }
  if (first === 'harness') {
    return { action: 'run', script: path.join(baseDir, 'vsdd-harness.js'), args: restArgs };
  }
  return null;
}

function parseCliCommand(args = [], baseDir = __dirname) {
  const version = getVersion(baseDir);
  const first = args[0];

  if (!first) {
    return { script: path.join(baseDir, 'vsdd-status.js'), args: [] };
  }
  if (first === '--version' || first === '-v') {
    return { action: 'version', version, isJson: args.includes('--json') };
  }
  if (first === '--help' || first === '-h' || first === 'help') {
    return { action: 'help', version };
  }

  const routed = resolveKnownSubcommand(first, args.slice(1), baseDir);
  if (routed) {
    return routed;
  }

  // Si comienza con bandera (ej: --json, --catalog, --abort, etc.), delegar a vsdd-status
  if (first.startsWith('-')) {
    return { script: path.join(baseDir, 'vsdd-status.js'), args: args };
  }

  // Comando no reconocido
  return { action: 'unknown', command: first, version };
}

function main() {
  const baseDir = path.dirname(fs.realpathSync(__filename));
  const rawArgs = process.argv.slice(2);
  const parsed = parseCliCommand(rawArgs, baseDir);

  if (parsed.action === 'version') {
    if (parsed.isJson) {
      console.log(JSON.stringify({ version: parsed.version }));
    } else {
      console.log(`⚡ VSDD v${parsed.version}`);
    }
    process.exit(0);
  }

  if (parsed.action === 'help') {
    printHelp(parsed.version);
    process.exit(0);
  }

  if (parsed.action === 'unknown') {
    console.error(`✖ Error: Subcomando '${parsed.command}' no reconocido.\n`);
    printHelp(parsed.version);
    process.exit(1);
  }

  const child = spawnSync(process.execPath, [parsed.script, ...parsed.args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (child.error) {
    console.error(`✖ Error al ejecutar ${path.basename(parsed.script)}:`, child.error.message);
    process.exit(1);
  }

  const exitCode = child.status !== null ? child.status : (child.signal ? 1 : 0);
  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  getVersion,
  parseCliCommand,
  printHelp,
};
