/**
 * VSDD Sonar - Formatters
 * Presentación legible en terminal para el mapa y el foco de Sonar.
 */

/**
 * Imprime el mapa de orientación en formato texto legible.
 * @param {object} map
 */
function printSonarMapText(map) {
  console.log(`╭────────────────────────────────────────────────────────╮
│  🛰️  VSDD Sonar: Mapa de Orientación                   │
╰────────────────────────────────────────────────────────╯`);
  console.log(`Raíz: ${map.root} (origen: ${map.source}, ${map.files} archivos, ${map.elapsedMs} ms)`);
  if (map.scope !== '.') {
    console.log(`Ámbito (--path): ${map.scope}`);
  }
  if (map.rootFiles.length > 0) {
    const omittedStr = map.omittedRootFiles > 0 ? ` (+${map.omittedRootFiles} más)` : '';
    console.log(`Archivos raíz: ${map.rootFiles.join(', ')}${omittedStr}`);
  }
  const extList = Object.entries(map.extensions)
    .map(([e, c]) => `${e} (${c})`)
    .join(', ');
  if (extList) {
    console.log(`Extensiones dominantes: ${extList}`);
  }

  if (map.tree.length > 0) {
    console.log('\nÁrbol de directorios:');
    for (const node of map.tree) {
      const top = node.top.length > 0 ? ` [${node.top.join(', ')}]` : '';
      console.log(`  • ${node.dir} (${node.files} archivos${top})`);
    }
    if (map.omittedDirs > 0) {
      console.log(`  (... ${map.omittedDirs} carpetas adicionales no mostradas)`);
    }
  }

  if (map.tests && map.tests.files > 0) {
    console.log(`\nLayout de tests (${map.tests.files} archivos detectados):`);
    const patList = Object.entries(map.tests.patterns)
      .map(([p, c]) => `${p} (${c})`)
      .join(', ');
    console.log(`  Patrones: ${patList}`);
    if (map.tests.dirs.length > 0) {
      console.log(`  Carpetas: ${map.tests.dirs.join(', ')}`);
    }
  }

  if (map.memory && map.memory.length > 0) {
    console.log(`\nMemoria del repositorio (${map.memory.length} entrada${map.memory.length > 1 ? 's' : ''}):`);
    for (const m of map.memory) {
      const mark = m.status === 'vigente' ? '✔ vigente' : `▲ ${m.status}: ${m.reason}`;
      console.log(`  [${mark}] ${m.id}: ${m.hypothesis} (ancla: ${m.anchor})`);
    }
  }
}

/**
 * Imprime la radiografía de foco en formato texto legible.
 * @param {object} focus
 */
function printSonarFocusText(focus) {
  console.log(`╭────────────────────────────────────────────────────────╮
│  🎯 VSDD Sonar: Foco en ${focus.target.padEnd(31).slice(0, 31)}│
╰────────────────────────────────────────────────────────╯`);
  if (focus.referencedBy.total > 0) {
    const ambig = focus.referencedBy.ambiguous ? ' (ambiguo, >15 referencias)' : '';
    console.log(`Referenciado por (${focus.referencedBy.total} archivo${focus.referencedBy.total > 1 ? 's' : ''}${ambig}):`);
    for (const f of focus.referencedBy.files) {
      console.log(`  • ${f}`);
    }
  } else {
    console.log('Referenciado por: Ninguno detectado');
  }

  if (focus.coChanged.commitsAnalyzed > 0) {
    console.log(`\nCo-cambios de Git (${focus.coChanged.commitsAnalyzed} commits analizados):`);
    for (const co of focus.coChanged.files) {
      console.log(`  • ${co.path} (${co.count} veces)`);
    }
  }

  if (focus.testCandidates.length > 0) {
    console.log('\nCandidatos de test:');
    for (const t of focus.testCandidates) {
      console.log(`  • ${t}`);
    }
  }
}

module.exports = {
  printSonarMapText,
  printSonarFocusText,
};
