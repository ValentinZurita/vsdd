#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getVersion(baseDir) {
  try {
    const pkgPath = path.join(baseDir, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || '0.43.0';
    }
  } catch (_) {}
  return '0.43.0';
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
  vsdd update [--json]              Actualiza VSDD a la última versión
  vsdd install [opciones]           Instala o actualiza la skill en tus agentes
  vsdd --version | -v               Muestra la versión instalada
  vsdd --help | -h                  Muestra esta ayuda

Comandos directos del agente:
  vsdd oracle <id> [--target <ruta>] [--dry-run|--json]
  vsdd validate docs/sdd/vsdd/<slug>/idea.md
  vsdd validate docs/sdd/vsdd/<slug>/spec.md
  vsdd validate docs/sdd/vsdd/<slug>/plan.md
  vsdd validate docs/sdd/vsdd/<slug>/tasks.md
`);
}

function parseCliCommand(args, baseDir) {
  const version = getVersion(baseDir);
  const first = args[0];

  if (!first) {
    return {
      script: path.join(baseDir, 'vsdd-status.js'),
      args: [],
    };
  }

  if (first === '--version' || first === '-v') {
    return { action: 'version', version, isJson: args.includes('--json') };
  }

  if (first === '--help' || first === '-h' || first === 'help') {
    return { action: 'help', version };
  }

  if (first === 'validate') {
    return {
      script: path.join(baseDir, 'vsdd-validate.js'),
      args: args.slice(1),
    };
  }

  if (first === 'status') {
    return {
      script: path.join(baseDir, 'vsdd-status.js'),
      args: args.slice(1),
    };
  }

  if (first === 'abort') {
    return {
      script: path.join(baseDir, 'vsdd-status.js'),
      args: ['--abort', ...args.slice(1)],
    };
  }

  if (first === 'update') {
    return {
      script: path.join(baseDir, 'vsdd-status.js'),
      args: ['update', ...args.slice(1)],
    };
  }

  if (first === 'install') {
    return {
      script: path.join(baseDir, 'install-skill.js'),
      args: args.slice(1),
    };
  }

  if (first === 'oracle' || first === 'scaffold-tests' || first === 'scaffold') {
    return {
      script: path.join(baseDir, 'vsdd-oracle.js'),
      args: args.slice(1),
    };
  }

  // Si comienza con bandera (ej: --json, --catalog, --abort, etc.), delegar a vsdd-status
  if (first.startsWith('-')) {
    return {
      script: path.join(baseDir, 'vsdd-status.js'),
      args: args,
    };
  }

  // Comando no reconocido
  return {
    action: 'unknown',
    command: first,
    version,
  };
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
