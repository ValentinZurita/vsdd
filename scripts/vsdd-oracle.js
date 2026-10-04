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
const { resolveSpecPath, resolveAutoTestTarget, isTestFilePath } = require('./lib/oracle/paths');

/**
 * Muestra el mensaje de ayuda de uso del oráculo VSDD.
 */
function printOracleHelp() {
  console.log(`
Uso: vsdd oracle [id-funcionalidad] [opciones]
     vsdd scaffold-tests [id-funcionalidad] [opciones]

Genera un oráculo de pruebas independiente y agnóstico a partir de la especificación (spec.md).
Si no se especifica --target, intenta auto-detectar el archivo de pruebas nuevo (+) en plan.md.

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
      if (!targetPath) {
        const err = {
          error: "La opción '--target' requiere especificar la ruta del archivo destino.",
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
    } else if (arg.startsWith('-t=')) {
      targetPath = arg.slice('-t='.length);
      if (!targetPath) {
        const err = {
          error: "La opción '-t' requiere especificar la ruta del archivo destino.",
          hint: 'Uso: vsdd oracle [id-funcionalidad] -t <ruta>',
        };
        if (isJson || args.includes('--json')) {
          console.error(JSON.stringify(err, null, 2));
        } else {
          console.error(`✖ Error: ${err.error}\n  ${err.hint}`);
        }
        process.exitCode = 1;
        return;
      }
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

  // Intentar auto-detección segura desde plan.md si no se pasó --target
  let autoResolved = false;
  let autoAmbiguous = false;
  let autoCandidates = [];

  if (!targetPath) {
    const autoResult = resolveAutoTestTarget(featureArg, cwd);
    if (autoResult.targetPath) {
      targetPath = autoResult.targetPath;
      autoResolved = true;
    } else if (autoResult.ambiguous) {
      autoAmbiguous = true;
      autoCandidates = autoResult.candidates;
    }
  }

  const requirements = extractAcceptanceOracle(specContent);
  const featureId = path.basename(path.dirname(specPath));
  const meta = {
    featureId,
    source: path.relative(cwd, specPath),
    targetPath: targetPath || null,
    autoResolved,
    ambiguousCandidates: autoAmbiguous ? autoCandidates : undefined,
  };

  if (isJson) {
    console.log(JSON.stringify({ meta, requirements }, null, 2));
    return;
  }

  if (autoAmbiguous && !targetPath) {
    console.error(`▲ [Aviso] Se detectaron múltiples archivos de prueba nuevos en plan.md:`);
    for (const cand of autoCandidates) {
      console.error(`    - ${cand}`);
    }
    console.error(`  Especifica cuál usar con: vsdd oracle ${featureArg || ''} --target <ruta> (emitiendo a stdout por defecto).\n`);
  }

  const formattedOutput = formatOracle(requirements, targetPath, meta);
  const resolvedTarget = targetPath ? path.resolve(cwd, targetPath) : null;
  const targetDir = resolvedTarget ? path.dirname(resolvedTarget) : null;

  // Validación de seguridad contra Directory Traversal (incluyendo resolución de symlinks)
  if (resolvedTarget) {
    let realCwd = cwd;
    try {
      realCwd = fs.realpathSync(cwd);
    } catch (_) {}

    let targetToCheck = resolvedTarget;
    let curr = path.dirname(resolvedTarget);
    while (curr && curr !== path.dirname(curr) && !fs.existsSync(curr)) {
      curr = path.dirname(curr);
    }
    try {
      if (fs.existsSync(curr)) {
        const realParent = fs.realpathSync(curr);
        targetToCheck = path.join(realParent, path.relative(curr, resolvedTarget));
      }
    } catch (_) {}

    const relFromCwd = path.relative(realCwd, targetToCheck);
    const escapesCwd =
      relFromCwd === '..' ||
      relFromCwd.startsWith('..' + path.sep) ||
      path.isAbsolute(relFromCwd);

    if (escapesCwd) {
      console.error(`✖ Error de seguridad: El destino '${targetPath}' intenta escribir fuera del workspace del proyecto.`);
      process.exitCode = 1;
      return;
    }
  }

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

  // Escritura en archivo destino con salvaguardas
  if (fs.existsSync(resolvedTarget) && !force) {
    if (autoResolved) {
      console.error(`▲ [Aviso] El archivo destino '${targetPath}' detectado desde plan.md ya existe en disco.`);
      console.error(`  Para actualizarlo usa: vsdd oracle ${featureArg || ''} --force o especifica --target <ruta>.`);
    } else {
      console.error(`▲ [Aviso] El archivo destino '${targetPath}' ya existe.`);
      console.error(`  Para no pisar código accidentalmente, usa --force para sobrescribir o --dry-run para previsualizar.`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(resolvedTarget, formattedOutput, 'utf8');
    const autoNote = autoResolved ? ' (auto-detectado desde plan.md)' : '';
    console.log(`✔ Oráculo de aceptación generado exitosamente en: ${targetPath}${autoNote}`);
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
  resolveAutoTestTarget,
  isTestFilePath,
  runOracle,
};
