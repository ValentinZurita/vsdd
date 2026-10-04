#!/usr/bin/env node

/**
 * VSDD Sonar - Topographic & Forensic Analysis CLI
 * Thin facade delegating to modular implementations in scripts/lib/sonar/
 */

const {
  testPatternOf,
  detectTestLayout,
  findTestCandidates,
} = require('./lib/sonar/heuristics');
const { summarizeTree } = require('./lib/sonar/tree');
const {
  listFiles,
  resolveSafePath,
  resolveRepoRoot,
} = require('./lib/sonar/fs');
const { runSonarMap } = require('./lib/sonar/map');
const {
  parseCoChanges,
  findReferences,
  runSonarFocus,
} = require('./lib/sonar/focus');
const {
  evaluateMemoryEntry,
  loadMemory,
  rememberEntry,
  forgetEntry,
} = require('./lib/sonar/memory');
const {
  printSonarMapText,
  printSonarFocusText,
} = require('./lib/sonar/formatters');

function main() {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const cwd = process.cwd();

  // Flag --remember
  const remIdx = args.indexOf('--remember');
  if (remIdx !== -1) {
    const hypothesis = args[remIdx + 1];
    const ancIdx = args.indexOf('--anchor');
    const anchor = ancIdx !== -1 ? args[ancIdx + 1] : null;
    const conIdx = args.indexOf('--contains');
    const contains = conIdx !== -1 ? args[conIdx + 1] : null;

    try {
      const entry = rememberEntry(cwd, { hypothesis, anchor, contains });
      if (isJson) {
        console.log(JSON.stringify({ ok: true, entry }, null, 2));
      } else {
        console.log(`✔ Memoria guardada [${entry.id}]: ${entry.hypothesis} (ancla: ${entry.anchor})`);
      }
      process.exit(0);
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`✖ Error al guardar memoria: ${err.message}`);
      }
      process.exit(1);
    }
  }

  // Flag --forget
  const forIdx = args.indexOf('--forget');
  if (forIdx !== -1) {
    const id = args[forIdx + 1];
    try {
      forgetEntry(cwd, id);
      if (isJson) {
        console.log(JSON.stringify({ ok: true, forgotten: id }, null, 2));
      } else {
        console.log(`✔ Memoria eliminada: ${id}`);
      }
      process.exit(0);
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`✖ Error: ${err.message}`);
      }
      process.exit(1);
    }
  }

  // Flag --focus
  const focIdx = args.indexOf('--focus');
  if (focIdx !== -1) {
    const targetFile = args[focIdx + 1];
    if (!targetFile) {
      console.error('✖ Error: Debe especificar un archivo para --focus <archivo>');
      process.exit(1);
    }
    try {
      const focus = runSonarFocus(cwd, targetFile);
      if (isJson) {
        console.log(JSON.stringify(focus, null, 2));
      } else {
        printSonarFocusText(focus);
      }
      process.exit(0);
    } catch (err) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`✖ Error en foco: ${err.message}`);
      }
      process.exit(1);
    }
  }

  // Mapa por defecto
  let pathArg = '.';
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && args[pathIdx + 1]) {
    pathArg = args[pathIdx + 1];
  }

  let depthArg = 2;
  const depthIdx = args.indexOf('--depth');
  if (depthIdx !== -1 && args[depthIdx + 1]) {
    depthArg = Number(args[depthIdx + 1]);
  }

  try {
    const map = runSonarMap(cwd, { path: pathArg, depth: depthArg });
    if (isJson) {
      console.log(JSON.stringify(map, null, 2));
    } else {
      printSonarMapText(map);
    }
    process.exit(0);
  } catch (err) {
    if (isJson) {
      console.error(JSON.stringify({ error: err.message }));
    } else {
      console.error(`✖ Error al ejecutar sonar: ${err.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  testPatternOf,
  summarizeTree,
  detectTestLayout,
  listFiles,
  resolveSafePath,
  resolveRepoRoot,
  runSonarMap,
  parseCoChanges,
  findReferences,
  findTestCandidates,
  runSonarFocus,
  evaluateMemoryEntry,
  loadMemory,
  rememberEntry,
  forgetEntry,
  printSonarMapText,
  printSonarFocusText,
  main,
};
