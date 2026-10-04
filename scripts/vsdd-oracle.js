#!/usr/bin/env node
'use strict';

/**
 * VSDD Oracle - Independent Acceptance Oracle Generator CLI
 * Thin facade delegating to modular implementations in scripts/lib/oracle/
 */

const fs = require('fs');
const path = require('path');
const { extractAcceptanceOracle } = require('./lib/oracle/extractor');
const {
  formatUniversalMarkdown,
  formatTypeScript,
  formatPython,
  formatGo,
  formatRust,
  formatCSharp,
  formatOracle,
} = require('./lib/oracle/generators');
const { resolveSpecPath } = require('./lib/oracle/paths');

/**
 * Muestra el mensaje de ayuda de uso del oráculo VSDD.
 */
function printOracleHelp() {
  console.log(`
Uso: vsdd oracle [id-funcionalidad] [opciones]
     vsdd scaffold-tests [id-funcionalidad] [opciones]

Genera un oráculo de pruebas independiente y agnóstico a partir de la especificación (spec.md).

Opciones:
  -t, --target <ruta>   Ruta del archivo de tests de destino (.ts, .py, .go, .rs, .cs, .md)
  --dry-run             Previsualiza el contenido generado sin escribir en disco
  --json                Emite el oráculo y metadatos en formato JSON
  --force               Sobrescribe el archivo de destino si ya existe
  -h, --help            Muestra esta ayuda de uso
`.trim());
}

/**
 * Ejecutor principal del oráculo CLI.
 */
function runOracle(args = process.argv.slice(2), cwd = process.cwd()) {
  let featureArg = null;
  let targetPath = null;
  let dryRun = false;
  let isJson = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printOracleHelp();
      process.exitCode = 0;
      return;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--json') {
      isJson = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--target=')) {
      targetPath = arg.slice('--target='.length);
    } else if (arg.startsWith('-t=')) {
      targetPath = arg.slice('-t='.length);
    } else if (arg === '--target' || arg === '-t') {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('-')) {
        const err = {
          error: `La opción '${arg}' requiere especificar la ruta del archivo destino.`,
          hint: 'Uso: vsdd oracle [id-funcionalidad] --target <ruta>',
        };
        if (isJson || args.includes('--json')) {
          console.error(JSON.stringify(err, null, 2));
        } else {
          console.error(`✖ Error: ${err.error}\n  ${err.hint}`);
        }
        process.exitCode = 1;
        return;
      }
      targetPath = args[++i];
    } else if (!arg.startsWith('-') && !featureArg) {
      featureArg = arg;
    }
  }

  const specPath = resolveSpecPath(featureArg, cwd);
  if (!specPath || !fs.existsSync(specPath)) {
    const err = {
      error: 'No se encontró el archivo spec.md para la funcionalidad especificada.',
      hint: 'Uso: vsdd oracle [id-funcionalidad] [--target <ruta>] [--dry-run|--json]',
    };
    if (isJson) {
      console.error(JSON.stringify(err, null, 2));
    } else {
      console.error(`✖ Error: ${err.error}\n  ${err.hint}`);
    }
    process.exitCode = 1;
    return;
  }

  let specContent;
  try {
    specContent = fs.readFileSync(specPath, 'utf8');
  } catch (err) {
    console.error(`✖ Error al leer '${specPath}': ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const requirements = extractAcceptanceOracle(specContent);
  const featureId = path.basename(path.dirname(specPath));
  const meta = {
    featureId,
    source: path.relative(cwd, specPath),
  };

  if (isJson) {
    console.log(JSON.stringify({ meta, requirements }, null, 2));
    return;
  }

  const formattedOutput = formatOracle(requirements, targetPath, meta);
  const resolvedTarget = targetPath ? path.resolve(cwd, targetPath) : null;
  const targetDir = resolvedTarget ? path.dirname(resolvedTarget) : null;

  if (dryRun || !targetPath) {
    if (dryRun && resolvedTarget && fs.existsSync(resolvedTarget)) {
      process.stderr.write(`▲ [Aviso] El archivo destino '${targetPath}' ya existe (previsualizando con --dry-run).\n`);
    }
    process.stdout.write(formattedOutput);
    return;
  }

  // Prevenir sobreescritura si target es un directorio
  if (fs.existsSync(resolvedTarget)) {
    try {
      if (fs.statSync(resolvedTarget).isDirectory()) {
        console.error(`✖ Error: El destino '${targetPath}' es un directorio existente. Especifica la ruta completa a un archivo.`);
        process.exitCode = 1;
        return;
      }
    } catch (_) {}
  }

  // Escritura en archivo destino
  if (fs.existsSync(resolvedTarget) && !force) {
    console.error(`▲ [Aviso] El archivo destino '${targetPath}' ya existe.`);
    console.error(`  Para no pisar código accidentalmente, usa --force para sobrescribir o --dry-run para previsualizar.`);
    process.exitCode = 1;
    return;
  }

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(resolvedTarget, formattedOutput, 'utf8');
    console.log(`✔ Oráculo de aceptación generado exitosamente en: ${targetPath}`);
  } catch (err) {
    console.error(`✖ Error al escribir en '${targetPath}': ${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runOracle();
}

module.exports = {
  extractAcceptanceOracle,
  formatUniversalMarkdown,
  formatTypeScript,
  formatPython,
  formatGo,
  formatRust,
  formatCSharp,
  formatOracle,
  resolveSpecPath,
  runOracle,
};
