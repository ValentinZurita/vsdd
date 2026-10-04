#!/usr/bin/env node
/**
 * VSDD Sonar: Motor de Exploración y Orientación en Cero Tokens
 * Principio Art. 7: Compute where it computes, Reason where it reasons.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 1500;
const MAX_FS_FILES = 20000;
const MAX_NODES_DEFAULT = 40;

const IGNORED_FS_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
  'vendor',
  '__pycache__',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
]);

/**
 * Deriva el patrón canónico de test a partir del nombre base del archivo.
 * Rechaza falsos positivos léxicos (palabras como latest, contest, protest).
 * @param {string} basename
 * @returns {string|null}
 */
function testPatternOf(basename) {
  if (!basename || typeof basename !== 'string') return null;

  // 1. Prefijo test: test_foo.py, test-foo.js, test.foo.ts
  const prefixMatch = basename.match(/^test([._-])(.+)\.([a-zA-Z0-9]+)$/i);
  if (prefixMatch) {
    const sep = prefixMatch[1];
    const ext = prefixMatch[3];
    return `test${sep}*.${ext}`;
  }

  // 2. Sufijo con separador antes de test/spec: foo_test.go, foo.test.ts, foo-test.js
  const suffixMatch = basename.match(/^(.+)([._-])(test|spec)\.([a-zA-Z0-9]+)$/i);
  if (suffixMatch) {
    const sep = suffixMatch[2];
    const kind = suffixMatch[3].toLowerCase();
    const ext = suffixMatch[4];
    return `*${sep}${kind}.${ext}`;
  }

  // 3. Sufijo CamelCase / PascalCase: FooTest.java, FooSpec.rb
  const pascalMatch = basename.match(/^(.+[a-z0-9])(Test|Spec)\.([a-zA-Z0-9]+)$/);
  if (pascalMatch) {
    const kind = pascalMatch[2];
    const ext = pascalMatch[3];
    return `*${kind}.${ext}`;
  }

  return null;
}

/**
 * Agrupa y resume el árbol de archivos por directorios hasta cierta profundidad.
 * @param {string[]} files Lista de rutas relativas
 * @param {object} options
 * @returns {object}
 */
function summarizeTree(files, options = {}) {
  const scope = options.scope || '.';
  const rawDepth = options.depth !== undefined ? Number(options.depth) : 2;
  const maxDepth = Math.min(Math.max(Number.isFinite(rawDepth) ? rawDepth : 2, 1), 4);
  const maxNodes = Number(options.maxNodes) || MAX_NODES_DEFAULT;

  const rootFiles = [];
  const extCounts = {};
  const dirMap = new Map();

  for (const rawFile of files) {
    let rel = path.normalize(rawFile).replace(/\\/g, '/');
    if (scope !== '.') {
      const normalizedScope = path.normalize(scope).replace(/\\/g, '/');
      if (rel.startsWith(normalizedScope + '/')) {
        rel = rel.slice(normalizedScope.length + 1);
      } else if (rel === normalizedScope) {
        continue;
      } else {
        continue;
      }
    }

    const ext = path.extname(rel).toLowerCase();
    if (ext) {
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }

    const parts = rel.split('/');
    if (parts.length === 1) {
      rootFiles.push(parts[0]);
    } else {
      const cappedParts = parts.slice(0, Math.min(parts.length - 1, maxDepth));
      const dirPath = cappedParts.join('/');

      let dData = dirMap.get(dirPath);
      if (!dData) {
        dData = { files: 0, exts: {} };
        dirMap.set(dirPath, dData);
      }
      dData.files += 1;
      if (ext) {
        dData.exts[ext] = (dData.exts[ext] || 0) + 1;
      }
    }
  }

  // Top 8 extensiones globales
  const sortedExts = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topExtensions = {};
  for (const [k, v] of sortedExts) {
    topExtensions[k] = v;
  }

  // Ordenar directorios por conteo descendente, luego alfabético
  const allDirs = Array.from(dirMap.entries())
    .map(([dir, data]) => {
      const topExt = Object.entries(data.exts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([e]) => e);
      return {
        dir,
        files: data.files,
        top: topExt,
      };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));

  const tree = allDirs.slice(0, maxNodes);
  const omittedDirs = Math.max(0, allDirs.length - maxNodes);

  return {
    rootFiles: rootFiles.sort(),
    extensions: topExtensions,
    tree,
    omittedDirs,
  };
}

/**
 * Detecta layout y patrones de pruebas en la lista de archivos.
 * @param {string[]} files
 * @returns {object}
 */
function detectTestLayout(files) {
  let count = 0;
  const patterns = {};
  const dirs = new Set();

  for (const f of files) {
    const base = path.basename(f);
    const pat = testPatternOf(base);
    if (pat) {
      count++;
      patterns[pat] = (patterns[pat] || 0) + 1;
      const d = path.dirname(f).replace(/\\/g, '/');
      if (d && d !== '.') {
        dirs.add(d);
      }
    }
  }

  const allDirs = Array.from(dirs).sort();

  return {
    files: count,
    patterns,
    dirs: allDirs.slice(0, 10),
  };
}

/**
 * Lista los archivos del repositorio de forma agnóstica y veloz.
 * Intenta `git ls-files` primero (incluye staged y untracked respetando .gitignore).
 * Si no hay Git o falla, recurre a escaneo de FS con saltos a carpetas ignoradas comunes.
 */
function listFiles(root, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const startTime = Date.now();

  try {
    const gitOut = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      {
        cwd: root,
        timeout: timeoutMs,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    if (typeof gitOut === 'string') {
      const files = gitOut
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      return {
        files,
        source: 'git',
        partial: false,
        elapsedMs: Date.now() - startTime,
      };
    }
  } catch (err) {
    // Si falló por timeout
    if (err && (err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM')) {
      return {
        files: [],
        source: 'git',
        partial: true,
        reason: 'timeout',
        elapsedMs: Date.now() - startTime,
      };
    }
  }

  // Fallback a recorrido de sistema de archivos
  const files = [];
  let partial = false;
  let reason = null;

  function walk(currentDir, currentDepth) {
    if (partial) return;
    if (Date.now() - startTime > timeoutMs) {
      partial = true;
      reason = 'timeout';
      return;
    }
    if (files.length >= MAX_FS_FILES) {
      partial = true;
      reason = 'max_files_exceeded';
      return;
    }
    if (currentDepth > 6) return;

    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      if (entry.isDirectory()) {
        if (IGNORED_FS_DIRS.has(entry.name)) continue;
        walk(path.join(currentDir, entry.name), currentDepth + 1);
      } else if (entry.isFile()) {
        const full = path.join(currentDir, entry.name);
        const rel = path.relative(root, full).replace(/\\/g, '/');
        files.push(rel);
      }
    }
  }

  walk(root, 0);

  return {
    files,
    source: 'fs',
    partial,
    reason,
    elapsedMs: Date.now() - startTime,
  };
}

/**
 * Confinamiento de seguridad: valida que targetPath resuelva estrictamente dentro de repoRoot.
 * Lanza error si intenta escapar o si es una ruta absoluta exterior.
 * @param {string} repoRoot
 * @param {string} targetPath
 * @returns {string} Ruta absoluta canónica dentro del repositorio
 */
function resolveSafePath(repoRoot, targetPath) {
  if (!targetPath) return repoRoot;
  const absRoot = path.resolve(repoRoot);
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(absRoot, targetPath);

  const rel = path.relative(absRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Acceso denegado: la ruta '${targetPath}' intenta escapar fuera de la raíz del repositorio.`
    );
  }

  return resolved;
}

/**
 * Obtiene la raíz del repositorio Git o la carpeta actual.
 */
function resolveRepoRoot(cwd = process.cwd()) {
  try {
    const stdout = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      timeout: 1000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (stdout && stdout.trim()) {
      return stdout.trim();
    }
  } catch (_) {}
  return path.resolve(cwd);
}

/**
 * Ruta del archivo de memoria del repositorio.
 */
function getMemoryPath(root) {
  return path.join(root, 'docs', 'sdd', 'vsdd', 'repo-memory.json');
}

/**
 * Evalúa el estado actual de una entrada de memoria contra el filesystem físico.
 */
function evaluateMemoryEntry(entry, root) {
  if (!entry || !entry.anchor) {
    return { ...entry, status: 'rota', reason: 'ancla no especificada' };
  }

  let absAnchor;
  try {
    absAnchor = resolveSafePath(root, entry.anchor);
  } catch (_) {
    return { ...entry, status: 'rota', reason: 'ancla fuera de la raíz' };
  }

  if (!fs.existsSync(absAnchor)) {
    return { ...entry, status: 'rota', reason: 'ancla inexistente' };
  }

  try {
    const stat = fs.statSync(absAnchor);
    if (stat.size > 1024 * 1024) {
      return { ...entry, status: 'no-verificable', reason: 'ancla excede 1MB' };
    }

    if (entry.contains) {
      const content = fs.readFileSync(absAnchor, 'utf8');
      if (!content.includes(entry.contains)) {
        return { ...entry, status: 'rota', reason: 'texto de ancla ausente' };
      }
    }
  } catch (_) {
    return { ...entry, status: 'no-verificable', reason: 'error de lectura' };
  }

  return { ...entry, status: 'vigente', reason: null };
}

/**
 * Carga las entradas sin evaluar desde repo-memory.json.
 */
function loadRawMemory(root) {
  const memPath = getMemoryPath(root);
  if (!fs.existsSync(memPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(memPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Carga y evalúa todas las entradas de memoria del repositorio.
 */
function loadMemory(root) {
  const raw = loadRawMemory(root);
  return raw.map((entry) => evaluateMemoryEntry(entry, root));
}

/**
 * Registra una nueva hipótesis con ancla verificable en la memoria del repositorio.
 */
function rememberEntry(cwd = process.cwd(), { hypothesis, anchor, contains } = {}) {
  const root = resolveRepoRoot(cwd);

  if (!hypothesis || typeof hypothesis !== 'string' || !hypothesis.trim()) {
    throw new Error('La hipótesis es requerida para registrar en memoria.');
  }
  if (hypothesis.trim().length > 160) {
    throw new Error('La hipótesis no debe superar los 160 caracteres.');
  }
  if (!anchor || typeof anchor !== 'string' || !anchor.trim()) {
    throw new Error('El ancla (--anchor) es requerida para verificar la memoria.');
  }

  const safeAnchorAbs = resolveSafePath(root, anchor.trim());
  if (!fs.existsSync(safeAnchorAbs)) {
    throw new Error(`El ancla '${anchor}' no existe en el repositorio.`);
  }

  const stat = fs.statSync(safeAnchorAbs);
  if (stat.size > 1024 * 1024) {
    throw new Error(`El ancla '${anchor}' supera el tamaño máximo permitido (1MB).`);
  }

  if (contains) {
    const content = fs.readFileSync(safeAnchorAbs, 'utf8');
    if (!content.includes(contains)) {
      throw new Error(`El texto indicado en --contains no se encuentra en el ancla '${anchor}'.`);
    }
  }

  const raw = loadRawMemory(root);
  if (raw.length >= 15) {
    throw new Error(
      'Límite de memoria alcanzado (máximo 15 entradas). Usa --forget para liberar espacio antes de agregar nuevas.'
    );
  }

  const maxNum = raw.reduce((acc, cur) => {
    const m = (cur.id || '').match(/^m-(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  const nextId = 'm-' + String(maxNum + 1).padStart(3, '0');

  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (_) {}

  const entry = {
    id: nextId,
    hypothesis: hypothesis.trim(),
    anchor: path.relative(root, safeAnchorAbs).replace(/\\/g, '/'),
    ...(contains ? { contains } : {}),
    recordedAt: new Date().toISOString(),
    ...(commit ? { recordedCommit: commit } : {}),
  };

  const memPath = getMemoryPath(root);
  fs.mkdirSync(path.dirname(memPath), { recursive: true });
  fs.writeFileSync(memPath, JSON.stringify([...raw, entry], null, 2) + '\n', 'utf8');

  return entry;
}

/**
 * Elimina una entrada de memoria por ID.
 */
function forgetEntry(cwd = process.cwd(), id) {
  if (!id) throw new Error('Se requiere el ID de la entrada a olvidar (--forget <id>).');
  const root = resolveRepoRoot(cwd);
  const raw = loadRawMemory(root);
  const index = raw.findIndex((e) => e.id === id);

  if (index === -1) {
    throw new Error(`No se encontró ninguna entrada de memoria con ID '${id}'.`);
  }

  raw.splice(index, 1);
  const memPath = getMemoryPath(root);
  fs.writeFileSync(memPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return { forgotten: id };
}

/**
 * Ejecuta el mapa de orientación del Sonar.
 * @param {string} cwd Directorio de trabajo
 * @param {object} options
 * @returns {object}
 */
function runSonarMap(cwd = process.cwd(), options = {}) {
  const root = resolveRepoRoot(cwd);
  const rawPath = options.path || '.';
  const safeScopeAbs = resolveSafePath(root, rawPath);
  const scopeRel = path.relative(root, safeScopeAbs).replace(/\\/g, '/') || '.';

  const listResult = listFiles(root, options);

  const summary = summarizeTree(listResult.files, {
    scope: scopeRel,
    depth: options.depth || 2,
    maxNodes: options.maxNodes || MAX_NODES_DEFAULT,
  });

  const tests = detectTestLayout(listResult.files);
  const memory = loadMemory(root);

  return {
    root,
    scope: scopeRel,
    source: listResult.source,
    partial: listResult.partial,
    reason: listResult.reason || null,
    elapsedMs: listResult.elapsedMs,
    files: listResult.files.length,
    rootFiles: summary.rootFiles,
    extensions: summary.extensions,
    tree: summary.tree,
    omittedDirs: summary.omittedDirs,
    tests,
    memory,
  };
}

/**
 * Parsea el log de git y extrae archivos co-modificados junto al archivo target.
 * Omite commits que toquen más de maxFilesPerCommit (commits masivos de formato/renombre).
 */
function parseCoChanges(logOutput, target, options = {}) {
  const maxFilesPerCommit = options.maxFilesPerCommit || 50;
  const top = options.top || 5;

  const normalizedTarget = path.normalize(target).replace(/\\/g, '/');
  const lines = (logOutput || '').split('\n');

  let commitsAnalyzed = 0;
  let skippedLarge = 0;
  const coCounts = {};

  let currentCommitFiles = [];

  function processCommit() {
    if (currentCommitFiles.length === 0) return;
    if (currentCommitFiles.length > maxFilesPerCommit) {
      skippedLarge++;
    } else {
      commitsAnalyzed++;
      for (const f of currentCommitFiles) {
        if (f !== normalizedTarget) {
          coCounts[f] = (coCounts[f] || 0) + 1;
        }
      }
    }
    currentCommitFiles = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@@')) {
      processCommit();
    } else {
      currentCommitFiles.push(path.normalize(trimmed).replace(/\\/g, '/'));
    }
  }
  processCommit();

  const sortedFiles = Object.entries(coCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([p, count]) => ({ path: p, count }));

  return {
    commitsAnalyzed,
    skippedLarge,
    files: sortedFiles,
  };
}

/**
 * Busca archivos que referencian el archivo target en el repositorio.
 */
function findReferences(root, target, allFiles, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const baseName = path.basename(target);
  const normalizedTarget = path.normalize(target).replace(/\\/g, '/');

  let matchedFiles = [];

  // Intento 1: git grep
  try {
    const out = execFileSync('git', ['grep', '-l', '-I', '-F', baseName], {
      cwd: root,
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (typeof out === 'string') {
      matchedFiles = out
        .split('\n')
        .map((l) => l.trim().replace(/\\/g, '/'))
        .filter(Boolean);
    }
  } catch (_) {
    // Fallback a escaneo simple sobre allFiles si no hay git
    if (Array.isArray(allFiles)) {
      for (const f of allFiles) {
        if (f === normalizedTarget) continue;
        try {
          const content = fs.readFileSync(path.join(root, f), 'utf8');
          if (content.includes(baseName)) {
            matchedFiles.push(f);
          }
        } catch (_) {}
      }
    }
  }

  const filtered = matchedFiles.filter((f) => f !== normalizedTarget);
  const total = filtered.length;
  const isAmbiguous = total > 15;

  return {
    files: filtered.slice(0, 15),
    total,
    ambiguous: isAmbiguous,
  };
}

/**
 * Encuentra candidatos de test relacionados con el archivo target.
 */
function findTestCandidates(allFiles, target) {
  const baseName = path.basename(target);
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;

  const results = [];
  for (const f of allFiles) {
    const fBase = path.basename(f);
    const pat = testPatternOf(fBase);
    if (pat && fBase.toLowerCase().includes(stem.toLowerCase())) {
      results.push(f);
    }
  }
  return results.sort();
}

/**
 * Ejecuta la radiografía de foco sobre un archivo específico.
 */
function runSonarFocus(cwd = process.cwd(), targetFile, options = {}) {
  const root = resolveRepoRoot(cwd);
  const safeTargetAbs = resolveSafePath(root, targetFile);

  if (!fs.existsSync(safeTargetAbs)) {
    throw new Error(`El archivo '${targetFile}' no existe en el repositorio.`);
  }

  const targetRel = path.relative(root, safeTargetAbs).replace(/\\/g, '/');
  const listResult = listFiles(root, options);
  const testCandidates = findTestCandidates(listResult.files, targetRel);
  const referencedBy = findReferences(root, targetRel, listResult.files, options);

  let coChanged = { commitsAnalyzed: 0, skippedLarge: 0, files: [] };
  try {
    const logOut = execFileSync(
      'git',
      [
        'log',
        '-n',
        '30',
        '--full-diff',
        '--name-only',
        '--format=tformat:@@%h',
        '--',
        targetRel,
      ],
      {
        cwd: root,
        timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    if (logOut) {
      coChanged = parseCoChanges(logOut, targetRel, options);
    }
  } catch (_) {
    // Repo sin commits o error de git
  }

  return {
    target: targetRel,
    referencedBy,
    coChanged,
    testCandidates,
  };
}

/**
 * Imprime el mapa de orientación en formato texto legible.
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
    console.log(`Archivos raíz: ${map.rootFiles.join(', ')}`);
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




