#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// -------------------------------------------------------------
// Importación modular desde scripts/lib/validator/
// -------------------------------------------------------------
const {
  normalizeText,
  parseMarkdownLines,
} = require('./lib/validator/lexer');

const {
  SECTION_ALIASES,
  validateUniversalHygiene,
  findHeadingByAlias,
} = require('./lib/validator/hygiene');

const {
  validateCrossArtifactTraceability,
} = require('./lib/validator/traceability');

const {
  validateIdea,
  validateSpec,
  validatePlan,
  validateTasks,
} = require('./lib/validator/rules');

const {
  detectArtifactType,
  validateFile,
  validateContent,
  validateFeatureDir,
} = require('./lib/validator/core');

const {
  formatReport,
} = require('./lib/validator/report');

// -------------------------------------------------------------
// Ejecución CLI si se invoca directamente
// -------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const targetPath = args.find((a) => !a.startsWith('--')) || 'docs/sdd/vsdd';

  const resolvedPath = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(resolvedPath)) {
    if (isJson) {
      console.log(
        JSON.stringify({
          valid: false,
          error: `Ruta no encontrada: ${targetPath}`,
        })
      );
    } else {
      console.error(`Error: La ruta '${targetPath}' no existe en disco.`);
    }
    process.exit(2);
  }

  const stat = fs.statSync(resolvedPath);
  let results = [];

  if (stat.isFile()) {
    results.push(validateFile(resolvedPath));
  } else {
    // Si es un directorio, verificar si contiene artefactos directamente o si contiene carpetas de features
    const directResults = validateFeatureDir(resolvedPath);
    if (directResults.length > 0) {
      results = directResults;
    } else {
      // Escaneo recursivo de carpetas hijas
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subDir = path.join(resolvedPath, entry.name);
          const subResults = validateFeatureDir(subDir);
          results.push(...subResults);
        }
      }
    }
  }

  if (results.length === 0) {
    const message = `No se encontraron artefactos VSDD para validar en '${targetPath}'.`;
    if (isJson) {
      console.log(JSON.stringify({ valid: false, results: [], message }));
    } else {
      console.log(message);
    }
    process.exit(1);
  }

  const hasErrors = results.some((r) => r.errors.length > 0);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          valid: !hasErrors,
          results,
        },
        null,
        2
      )
    );
  } else {
    const report = formatReport(results);
    console.log(report.output);
  }

  process.exit(hasErrors ? 1 : 0);
}

// -------------------------------------------------------------
// Exports canónicos (100% retrocompatibles con la suite de tests)
// -------------------------------------------------------------
module.exports = {
  validateFile,
  validateContent,
  validateFeatureDir,
  validateCrossArtifactTraceability,
  parseMarkdownLines,
  formatReport,
  SECTION_ALIASES,
};
