const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const {
  testPatternOf,
  summarizeTree,
  detectTestLayout,
  runSonarMap,
} = require('../scripts/vsdd-sonar.js');

test('testPatternOf: deriva patrones de test canónicos y rechaza falsos positivos léxicos', () => {
  // Patrones válidos
  assert.equal(testPatternOf('auth_test.go'), '*_test.go');
  assert.equal(testPatternOf('checkout.test.ts'), '*.test.ts');
  assert.equal(testPatternOf('order.spec.js'), '*.spec.js');
  assert.equal(testPatternOf('test_payment.py'), 'test_*.py');
  assert.equal(testPatternOf('UserServiceTest.java'), '*Test.java');
  assert.equal(testPatternOf('user_spec.rb'), '*_spec.rb');

  // Falsos positivos que contienen 'test' pero no son tests (exigen separador o prefijo)
  assert.equal(testPatternOf('latest.go'), null);
  assert.equal(testPatternOf('contest.js'), null);
  assert.equal(testPatternOf('protest.py'), null);
  assert.equal(testPatternOf('attestation.ts'), null);
  assert.equal(testPatternOf('detest.rb'), null);
});

test('summarizeTree: agrupa conteos por directorio, calcula extensión dominante y respeta tope de nodos', () => {
  const files = [
    'README.md',
    'go.mod',
    'cmd/api/main.go',
    'cmd/api/routes.go',
    'internal/auth/handler.go',
    'internal/auth/handler_test.go',
    'internal/auth/service.go',
    'internal/orders/order.go',
    'web/src/app.tsx',
    'web/src/index.html',
    'web/package.json',
  ];

  const summary = summarizeTree(files, { scope: '.', depth: 2, maxNodes: 40 });

  assert.deepEqual(summary.rootFiles.sort(), ['README.md', 'go.mod']);
  assert.equal(summary.extensions['.go'], 6);
  assert.equal(summary.extensions['.tsx'], 1);
  assert.equal(summary.extensions['.html'], 1);
  assert.equal(summary.extensions['.json'], 1);
  assert.equal(summary.extensions['.md'], 1);

  // Verificar nodos del árbol
  const dirs = summary.tree.map((n) => n.dir);
  assert.ok(dirs.includes('cmd/api'), 'Debe incluir cmd/api');
  assert.ok(dirs.includes('internal/auth'), 'Debe incluir internal/auth');
  assert.ok(dirs.includes('internal/orders'), 'Debe incluir internal/orders');
  assert.ok(dirs.includes('web'), 'Debe incluir web a profundidad 2');

  const authNode = summary.tree.find((n) => n.dir === 'internal/auth');
  assert.equal(authNode.files, 3);
  assert.deepEqual(authNode.top, ['.go']);
  assert.equal(summary.omittedDirs, 0);
});

test('summarizeTree: omite directorios que superan maxNodes e informa omittedDirs', () => {
  // Generar 50 carpetas sintéticas
  const files = [];
  for (let i = 0; i < 50; i++) {
    files.push(`pkg/service${i}/file.go`);
  }

  const summary = summarizeTree(files, { scope: '.', depth: 2, maxNodes: 10 });
  assert.equal(summary.tree.length, 10);
  assert.equal(summary.omittedDirs, 40);
});

test('detectTestLayout: identifica conteo de tests, patrones y carpetas dedicadas', () => {
  const files = [
    'src/auth.ts',
    'src/auth.test.ts',
    'src/order.ts',
    'src/order.test.ts',
    'tests/e2e/login.spec.js',
    'tests/e2e/checkout.spec.js',
    'cmd/api/main.go',
    'cmd/api/main_test.go',
  ];

  const layout = detectTestLayout(files);
  assert.equal(layout.files, 5);
  assert.equal(layout.patterns['*.test.ts'], 2);
  assert.equal(layout.patterns['*.spec.js'], 2);
  assert.equal(layout.patterns['*_test.go'], 1);
  assert.ok(layout.dirs.includes('tests/e2e'));
  assert.ok(layout.dirs.includes('src'));
});

test('runSonarMap: ejecuta en repo git temporal e incluye archivos sin commitear', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-test-'));
  try {
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test User" && git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project');
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/test\ngo 1.22');
    fs.mkdirSync(path.join(tmpDir, 'cmd', 'api'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'cmd', 'api', 'main.go'), 'package main\nfunc main() {}');
    execSync('git add . && git commit -m "initial commit"', { cwd: tmpDir, stdio: 'ignore' });

    // Crear archivo sin commitear (untracked)
    fs.writeFileSync(path.join(tmpDir, 'cmd', 'api', 'untracked_test.go'), 'package main\n');

    const result = runSonarMap(tmpDir);

    assert.equal(result.source, 'git');
    assert.equal(result.partial, false);
    assert.equal(result.files, 4);
    assert.ok(result.rootFiles.includes('go.mod'));
    assert.ok(result.rootFiles.includes('README.md'));
    assert.equal(result.extensions['.go'], 2);
    assert.equal(result.tests.files, 1);
    assert.equal(result.tests.patterns['*_test.go'], 1);

    // Invariante de agnosticismo absoluto (RNF-04)
    assert.equal(result.stack, undefined, 'No debe existir clave stack');
    assert.equal(result.language, undefined, 'No debe existir clave language');
    assert.equal(result.framework, undefined, 'No debe existir clave framework');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('presupuesto de salida: el JSON del mapa se mantiene <= 2.5 KB incluso con muchas carpetas', () => {
  const files = ['README.md', 'package.json'];
  for (let i = 0; i < 500; i++) {
    files.push(`src/modules/feature_${i}/index.ts`);
    files.push(`src/modules/feature_${i}/index.test.ts`);
  }

  const summary = summarizeTree(files, { scope: '.', depth: 2, maxNodes: 40 });
  const tests = detectTestLayout(files);
  const payload = {
    root: '/dummy/path',
    scope: '.',
    source: 'git',
    partial: false,
    elapsedMs: 25,
    files: files.length,
    rootFiles: summary.rootFiles,
    extensions: summary.extensions,
    tree: summary.tree,
    omittedDirs: summary.omittedDirs,
    tests,
    memory: [],
  };

  const jsonStr = JSON.stringify(payload);
  const byteLength = Buffer.byteLength(jsonStr, 'utf8');
  assert.ok(
    byteLength <= 2560,
    `El payload debe pesar <= 2560 bytes (~2.5 KB). Peso actual: ${byteLength} bytes`
  );
});

test('zoom: --path re-centra el mapa y lista rootFiles relativos a la subcarpeta', () => {
  const files = [
    'package.json',
    'apps/api/package.json',
    'apps/api/src/server.ts',
    'apps/api/src/routes/auth.ts',
    'apps/web/package.json',
    'apps/web/src/main.tsx',
  ];

  const summary = summarizeTree(files, { scope: 'apps/api', depth: 2 });
  assert.deepEqual(summary.rootFiles, ['package.json']);
  assert.ok(summary.tree.some((t) => t.dir === 'src' || t.dir === 'src/routes'));
  assert.equal(summary.tree.some((t) => t.dir.includes('web')), false, 'No debe incluir apps/web');
});

test('confinamiento de seguridad: rechaza rutas que escapan de la raíz del repo (RNF-05)', () => {
  const { resolveSafePath } = require('../scripts/vsdd-sonar.js');
  const repoRoot = '/Users/test/my-repo';

  assert.throws(
    () => resolveSafePath(repoRoot, '../../etc/passwd'),
    /fuera de la raíz/i
  );
  assert.throws(
    () => resolveSafePath(repoRoot, '/etc/passwd'),
    /fuera de la raíz/i
  );
  assert.throws(
    () => resolveSafePath(repoRoot, '..'),
    /fuera de la raíz/i
  );

  // Ruta válida dentro del repo
  const safeRoot = resolveSafePath(repoRoot, '.');
  const safe = resolveSafePath(repoRoot, 'apps/api');
  assert.equal(path.relative(safeRoot, safe), path.join('apps', 'api'));
});

test('profundidad: depth mayor a 4 se limita a 4 y menor a 1 se ajusta a 1', () => {
  const files = ['a/b/c/d/e/f/file.txt'];

  const deep = summarizeTree(files, { depth: 9 });
  assert.equal(deep.tree[0].dir, 'a/b/c/d');

  const shallow = summarizeTree(files, { depth: 0 });
  assert.equal(shallow.tree[0].dir, 'a');
});

test('parseCoChanges: agrupa archivos co-modificados, excluye self y omite commits masivos', () => {
  const { parseCoChanges } = require('../scripts/vsdd-sonar.js');

  const logOutput = [
    '@@c1',
    'src/auth.js',
    'tests/auth.test.js',
    'README.md',
    '@@c2',
    'src/auth.js',
    'tests/auth.test.js',
    '@@c3',
    'src/auth.js',
    // 55 archivos en este commit
    ...Array.from({ length: 55 }, (_, i) => `generated/file_${i}.js`),
  ].join('\n');

  const res = parseCoChanges(logOutput, 'src/auth.js', { maxFilesPerCommit: 50, top: 5 });

  assert.equal(res.commitsAnalyzed, 2, 'Debe analizar solo los 2 commits normales');
  assert.equal(res.skippedLarge, 1, 'Debe reportar 1 commit masivo omitido');
  assert.equal(res.files[0].path, 'tests/auth.test.js');
  assert.equal(res.files[0].count, 2);
  assert.equal(res.files[1].path, 'README.md');
  assert.equal(res.files[1].count, 1);
  assert.equal(res.files.some((f) => f.path === 'src/auth.js'), false, 'No debe incluirse a sí mismo');
});

test('runSonarFocus: radiografía completa en repo temporal con commits reales', () => {
  const { runSonarFocus } = require('../scripts/vsdd-sonar.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-focus-'));

  try {
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });

    // Commit 1: crear target y consumidor que lo referencia
    fs.writeFileSync(path.join(tmpDir, 'src', 'service.js'), 'export function run() {}\n');
    fs.writeFileSync(path.join(tmpDir, 'src', 'controller.js'), 'import { run } from "./service.js";\n');
    execSync('git add . && git commit -m "c1: add service and controller"', { cwd: tmpDir, stdio: 'ignore' });

    // Commit 2: agregar test
    fs.writeFileSync(path.join(tmpDir, 'tests', 'service.test.js'), 'import { run } from "../src/service.js";\n');
    fs.appendFileSync(path.join(tmpDir, 'src', 'service.js'), '// patch 1\n');
    execSync('git add . && git commit -m "c2: add test"', { cwd: tmpDir, stdio: 'ignore' });

    // Commit 3: actualizar test y target
    fs.appendFileSync(path.join(tmpDir, 'tests', 'service.test.js'), '// test 2\n');
    fs.appendFileSync(path.join(tmpDir, 'src', 'service.js'), '// patch 2\n');
    execSync('git add . && git commit -m "c3: update test and service"', { cwd: tmpDir, stdio: 'ignore' });

    const focus = runSonarFocus(tmpDir, 'src/service.js');

    assert.equal(focus.target, 'src/service.js');
    assert.ok(focus.referencedBy.files.includes('src/controller.js'));
    assert.equal(focus.referencedBy.ambiguous, false);
    assert.deepEqual(focus.testCandidates, ['tests/service.test.js']);

    assert.equal(focus.coChanged.commitsAnalyzed, 3);
    assert.equal(focus.coChanged.files[0].path, 'tests/service.test.js');
    assert.equal(focus.coChanged.files[0].count, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('runSonarFocus: maneja repo sin commits sin lanzar error y con commitsAnalyzed 0', () => {
  const { runSonarFocus } = require('../scripts/vsdd-sonar.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-nocommit-'));

  try {
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');

    const focus = runSonarFocus(tmpDir, 'index.js');
    assert.equal(focus.target, 'index.js');
    assert.equal(focus.coChanged.commitsAnalyzed, 0);
    assert.equal(focus.coChanged.files.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('memoria: rememberEntry valida ancla, contains y límite de 15 entradas', () => {
  const { rememberEntry, forgetEntry, runSonarMap } = require('../scripts/vsdd-sonar.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-mem-'));

  try {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth.js'), 'export const secret = "xyz";\n');

    // 1. Falla si ancla no existe
    assert.throws(
      () => rememberEntry(tmpDir, { hypothesis: 'H1', anchor: 'src/inventado.js' }),
      /no existe/i
    );

    // 2. Falla si contains no coincide
    assert.throws(
      () => rememberEntry(tmpDir, { hypothesis: 'H1', anchor: 'src/auth.js', contains: 'JWT_KEY' }),
      /no se encuentra en el ancla/i
    );

    // 3. Guarda entrada válida m-001
    const entry = rememberEntry(tmpDir, {
      hypothesis: 'La clave secreta vive en secret',
      anchor: 'src/auth.js',
      contains: 'secret = "xyz"',
    });

    assert.equal(entry.id, 'm-001');
    assert.equal(entry.anchor, 'src/auth.js');

    // 4. Se refleja en runSonarMap como vigente
    let map = runSonarMap(tmpDir);
    assert.equal(map.memory.length, 1);
    assert.equal(map.memory[0].status, 'vigente');

    // 5. Detecta rota cuando el contenido del ancla cambia
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth.js'), 'export const token = "abc";\n');
    map = runSonarMap(tmpDir);
    assert.equal(map.memory[0].status, 'rota');
    assert.equal(map.memory[0].reason, 'texto de ancla ausente');

    // 6. Detecta rota cuando el archivo ancla es eliminado
    fs.unlinkSync(path.join(tmpDir, 'src', 'auth.js'));
    map = runSonarMap(tmpDir);
    assert.equal(map.memory[0].status, 'rota');
    assert.equal(map.memory[0].reason, 'ancla inexistente');

    // 7. forgetEntry elimina la memoria
    forgetEntry(tmpDir, 'm-001');
    map = runSonarMap(tmpDir);
    assert.equal(map.memory.length, 0);

    // 8. forgetEntry falla ante ID inexistente
    assert.throws(() => forgetEntry(tmpDir, 'm-999'), /no se encontró/i);

    // 9. Límite de 15 entradas
    fs.writeFileSync(path.join(tmpDir, 'target.txt'), 'content\n');
    for (let i = 1; i <= 15; i++) {
      rememberEntry(tmpDir, { hypothesis: `H-${i}`, anchor: 'target.txt' });
    }
    assert.throws(
      () => rememberEntry(tmpDir, { hypothesis: 'H-16', anchor: 'target.txt' }),
      /límite de memoria alcanzado/i
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('degradación sin git: opera mediante fs ignorando node_modules y sin congelar', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-nogit-'));

  try {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'dep'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), 'console.log(1);\n');
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep', 'index.js'), 'console.log(2);\n');

    const res = runSonarMap(tmpDir);
    assert.equal(res.source, 'fs');
    assert.equal(res.files, 1, 'Debe haber listado solo src/index.js, ignorando node_modules');
    assert.ok(res.tree.some((t) => t.dir === 'src'));
    assert.equal(res.tree.some((t) => t.dir.includes('node_modules')), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('degradación por timeout: responde partial true y no arroja excepción', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-timeout-'));

  try {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    for (let i = 0; i < 50; i++) {
      fs.writeFileSync(path.join(tmpDir, 'src', `f_${i}.js`), 'code\n');
    }

    // timeoutMs = 1 ms para forzar timeout en fs walk
    const res = runSonarMap(tmpDir, { timeoutMs: 1 });
    assert.equal(res.partial, true);
    assert.equal(res.reason, 'timeout');
    assert.ok(typeof res.elapsedMs === 'number');
    assert.ok(Array.isArray(res.tree));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('presupuesto de payload: 500 archivos en raíz se truncan a 15 y el JSON no supera 2.5 KB', () => {
  const rootFilesList = Array.from({ length: 500 }, (_, i) => `file_${String(i).padStart(3, '0')}.txt`);
  const summary = summarizeTree(rootFilesList, { scope: '.', depth: 2 });

  assert.equal(summary.rootFiles.length, 15);
  assert.equal(summary.omittedRootFiles, 485);

  const payload = JSON.stringify({
    root: '/dummy/repo',
    scope: '.',
    source: 'git',
    files: 500,
    rootFiles: summary.rootFiles,
    omittedRootFiles: summary.omittedRootFiles,
    extensions: summary.extensions,
    tree: summary.tree,
    omittedDirs: summary.omittedDirs,
    tests: { files: 0, patterns: {}, dirs: [] },
    memory: [],
  });

  const payloadBytes = Buffer.byteLength(payload, 'utf8');
  assert.ok(
    payloadBytes <= 2560,
    `Payload con 500 archivos en raíz (${payloadBytes} bytes) debe ser <= 2560 bytes (2.5 KB)`
  );
});

test('integridad de memoria: repo-memory.json corrupto arroja error y previene sobreescritura', () => {
  const { rememberEntry } = require('../scripts/vsdd-sonar.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-corrupt-mem-'));

  try {
    const memDir = path.join(tmpDir, 'docs', 'sdd', 'vsdd');
    fs.mkdirSync(memDir, { recursive: true });
    const memPath = path.join(memDir, 'repo-memory.json');
    fs.writeFileSync(memPath, '<<< CORRUPTED MERGE CONFLICT JSON >>>');

    fs.writeFileSync(path.join(tmpDir, 'anchor.txt'), 'some text\n');

    // Debe arrojar error de integridad impidiendo que se sobreescriba
    assert.throws(
      () => rememberEntry(tmpDir, { hypothesis: 'test', anchor: 'anchor.txt' }),
      /error de integridad/i
    );

    // Comprobar que el contenido corrupto original no fue destruido
    const after = fs.readFileSync(memPath, 'utf8');
    assert.equal(after, '<<< CORRUPTED MERGE CONFLICT JSON >>>');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('candidatos de test: findTestCandidates limita resultados a maxCandidates (10)', () => {
  const { findTestCandidates } = require('../scripts/vsdd-sonar.js');
  const allFiles = Array.from({ length: 30 }, (_, i) => `tests/service_${i}.test.js`);
  const candidates = findTestCandidates(allFiles, 'src/service.js');

  assert.equal(candidates.length, 10, 'Debe acotar a como máximo 10 candidatos');
});

test('seguridad symlinks: resolveSafePath bloquea symlinks que apuntan fuera del repositorio', () => {
  const { resolveSafePath } = require('../scripts/vsdd-sonar.js');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-symlink-root-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sonar-symlink-outside-'));

  try {
    const outsideFile = path.join(outsideDir, 'secret.env');
    fs.writeFileSync(outsideFile, 'SECRET=1234\n');

    const linkPath = path.join(tmpDir, 'symlink-to-outside.txt');
    try {
      fs.symlinkSync(outsideFile, linkPath);
    } catch (_) {
      // Si el SO no permite symlinks sin privilegios, saltar
      return;
    }

    assert.throws(
      () => resolveSafePath(tmpDir, 'symlink-to-outside.txt'),
      /apunta fuera de la raíz del repositorio/i
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  }
});
