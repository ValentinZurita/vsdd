const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const {
  scanFeatures,
  formatHubMenu,
  calculateFeatureDrift,
  extractTrackedFiles,
  saveFeatureContext,
  saveFeatureExploration,
  getFeatureExploration,
  saveIntakeDraft,
  getIntakeDraft,
  clearIntakeDraft,
  promoteIntakeDraft,
} = require('../scripts/vsdd-status');

test('scanFeatures returns empty array if docs/sdd/vsdd does not exist', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-status-test-empty-'));
  try {
    const features = scanFeatures(tempDir);
    assert.deepEqual(features, []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanFeatures correctly detects and classifies multiple features by their lifecycle state', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-status-test-multi-'));
  try {
    const vsddRoot = path.join(tempDir, 'docs', 'sdd', 'vsdd');
    fs.mkdirSync(vsddRoot, { recursive: true });

    // Feature 1: Idea aprobada
    const feat1 = path.join(vsddRoot, '001-auth-oauth');
    fs.mkdirSync(feat1);
    fs.writeFileSync(
      path.join(feat1, 'idea.md'),
      '# Idea OAuth\nEstado: listo-para-spec\n\n## Problema\nLos usuarios no pueden iniciar sesión con Google.\n'
    );

    // Feature 2: Implementación en progreso con varias tareas
    const feat2 = path.join(vsddRoot, '002-carrito-compras');
    fs.mkdirSync(feat2);
    fs.writeFileSync(path.join(feat2, 'idea.md'), '# Idea Carrito\nEstado: listo-para-spec\n');
    fs.writeFileSync(path.join(feat2, 'spec.md'), '# Spec Carrito\nEstado: listo-para-plan\n');
    fs.writeFileSync(path.join(feat2, 'plan.md'), '# Plan Carrito\nEstado: listo-para-tareas\n');
    fs.writeFileSync(
      path.join(feat2, 'tasks.md'),
      `# Tasks Carrito
Estado: listo-para-aplicar

## Fase 1
- [x] **TASK-01: Modelo de datos**
- [X] **TASK-02: Repositorio en memoria**
- [ ] **TASK-03: Cálculo de totales y cupones**
* [ ] **TASK-04: Componente de vista**
`
    );

    // Feature 3: Completada
    const feat3 = path.join(vsddRoot, '003-perfil-usuario');
    fs.mkdirSync(feat3);
    fs.writeFileSync(path.join(feat3, 'idea.md'), '# Idea Perfil\nEstado: listo-para-spec\n');
    fs.writeFileSync(path.join(feat3, 'tasks.md'), '# Tasks Perfil\nEstado: completado\n');

    const features = scanFeatures(tempDir);
    assert.equal(features.length, 3);

    // Verificar Feature 1
    const f1 = features.find((f) => f.id === '001-auth-oauth');
    assert.equal(f1.phase, 'spec');
    assert.equal(f1.nextCommand, 'vsdd spec');
    assert.equal(f1.isCompleted, false);
    assert.equal(f1.objective, 'Los usuarios no pueden iniciar sesión con Google.');

    // Verificar Feature 2
    const f2 = features.find((f) => f.id === '002-carrito-compras');
    assert.equal(f2.phase, 'apply');
    assert.equal(f2.nextCommand, 'vsdd apply');
    assert.equal(f2.isCompleted, false);
    assert.equal(f2.totalTasks, 4);
    assert.equal(f2.completedTasks, 2);
    assert.equal(f2.pendingTasks, 2);
    assert.equal(f2.nextTaskTitle, 'Cálculo de totales y cupones');

    // Verificar Feature 3
    const f3 = features.find((f) => f.id === '003-perfil-usuario');
    assert.equal(f3.isCompleted, true);
    assert.equal(f3.phase, 'completado');

    // Verificar formateo de menú
    const menu = formatHubMenu(features);
    assert.ok(menu.includes('001-auth-oauth'));
    assert.ok(menu.includes('002-carrito-compras'));
    assert.ok(!menu.includes('003-perfil-usuario')); // Excluido del menú de pendientes
    assert.ok(menu.includes('Avance: 2/4 tareas'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift returns UNKNOWN when directory is not a git repo or has 0 commits', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-nogit-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'plan.md'), '# Plan\n## Árbol de cambios\n- ~ src/app.js\n');

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'UNKNOWN');
    assert.equal(drift.reason, 'NO_GIT_OR_NO_COMMITS');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('extractTrackedFiles parses plan.md Árbol de cambios with correct action types', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-extract-'));
  try {
    const planContent = `# Plan de prueba
## Árbol de cambios
- ~ \`src/services/auth.service.ts\`
- + \`src/dtos/login.dto.ts\`
- - \`src/legacy/old-auth.ts\`
`;
    const res = extractTrackedFiles(tempDir, planContent);
    assert.equal(res.trackedFiles.length, 3);
    assert.deepEqual(res.trackedFiles[0], { path: 'src/services/auth.service.ts', action: 'modify' });
    assert.deepEqual(res.trackedFiles[1], { path: 'src/dtos/login.dto.ts', action: 'create' });
    assert.deepEqual(res.trackedFiles[2], { path: 'src/legacy/old-auth.ts', action: 'delete' });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift does NOT trigger RED for new files (+) that do not exist yet (Judgment Day catch)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-newfiles-'));
  try {
    // Inicializar git con 1 commit
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'existing.js'), 'console.log("hello");');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });

    // Plan incluye archivo existente para modificar (~), y archivo nuevo (+) que NO existe
    const planContent = `# Plan
## Árbol de cambios
- ~ src/existing.js
- + src/brand-new-file.js
`;
    fs.writeFileSync(path.join(featDir, 'plan.md'), planContent);

    const drift = calculateFeatureDrift(featDir, { planContent }, tempDir);
    // No debe ser RED porque src/existing.js sí existe, y src/brand-new-file.js es '+'
    assert.notEqual(drift.status, 'RED');
    assert.equal(drift.status, 'GREEN');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift triggers RED when a file marked to modify (~) does NOT exist on disk', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-red-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'init');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });

    // El plan dice que va a modificar src/deleted.js, pero ese archivo no existe
    const planContent = `# Plan
## Árbol de cambios
- ~ src/deleted.js
`;
    fs.writeFileSync(path.join(featDir, 'plan.md'), planContent);

    const drift = calculateFeatureDrift(featDir, { planContent }, tempDir);
    assert.equal(drift.status, 'RED');
    assert.equal(drift.reason, 'MISSING_MODIFIED_FILE');
    assert.ok(drift.details.missingFiles.includes('src/deleted.js'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift triggers YELLOW when tracked files are modified in commits after baseCommit', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-yellow-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    const serviceFile = path.join(tempDir, 'src', 'service.js');
    fs.writeFileSync(serviceFile, 'function login() {}\n');
    execSync('git add . && git commit -m "commit 1"', { cwd: tempDir, stdio: 'ignore' });

    const baseCommit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });

    // Guardar context.json con baseCommit
    saveFeatureContext(
      featDir,
      {
        baseCommit,
        trackedFiles: [{ path: 'src/service.js', action: 'modify' }],
      },
      tempDir
    );

    // Simular que en el repo alguien modifica src/service.js en un commit posterior
    fs.writeFileSync(serviceFile, 'function login(token) { return true; }\n');
    execSync('git add . && git commit -m "commit 2 por otro dev"', { cwd: tempDir, stdio: 'ignore' });

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'YELLOW');
    assert.equal(drift.reason, 'MODIFIED_UPSTREAM');
    assert.equal(drift.details.commitsSinceBase, 1);
    assert.equal(drift.details.commitsBehind, 1); // Deprecated compatibility alias.
    assert.ok(drift.details.modifiedFiles.includes('src/service.js'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift triggers YELLOW when tracked files have uncommitted local changes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-dirty-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    const file = path.join(tempDir, 'src', 'app.js');
    fs.writeFileSync(file, 'const a = 1;\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const baseCommit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });

    saveFeatureContext(
      featDir,
      {
        baseCommit,
        trackedFiles: [{ path: 'src/app.js', action: 'modify' }],
      },
      tempDir
    );

    // Modificar localmente sin commitear
    fs.writeFileSync(file, 'const a = 2; // dirty local\n');

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'YELLOW');
    assert.equal(drift.reason, 'DIRTY_LOCAL');
    assert.ok(drift.details.dirtyLocalFiles.includes('src/app.js'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift returns BRANCH_MISMATCH when the baseline branch changed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-branch-mismatch-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    const file = path.join(tempDir, 'README.md');
    fs.writeFileSync(file, 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    const baseCommit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();
    const currentBranch = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    const originalBranch = currentBranch === 'baseline-branch' ? 'other-branch' : 'baseline-branch';

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });
    saveFeatureContext(featDir, {
      baseCommit,
      branch: originalBranch,
      trackedFiles: [{ path: 'README.md', action: 'modify' }],
    }, tempDir);

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'YELLOW');
    assert.equal(drift.reason, 'BRANCH_MISMATCH');
    assert.equal(drift.details.branchMismatch, true);
    assert.equal(drift.details.originalBranch, originalBranch);
    assert.equal(drift.details.currentBranch, currentBranch);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift returns GREEN when the baseline branch is unchanged', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-same-branch-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    const baseCommit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();
    const currentBranch = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });
    saveFeatureContext(featDir, {
      baseCommit,
      branch: currentBranch,
      trackedFiles: [{ path: 'README.md', action: 'modify' }],
    }, tempDir);

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'GREEN');
    assert.equal(drift.reason, 'SYNCED');
    assert.equal(drift.details.branchMismatch, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift keeps DIRTY_LOCAL as the primary reason on a different branch', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-dirty-branch-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    const file = path.join(tempDir, 'src', 'app.js');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'const value = 1;\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    const baseCommit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();
    const currentBranch = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    const originalBranch = currentBranch === 'baseline-branch' ? 'other-branch' : 'baseline-branch';

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });
    saveFeatureContext(featDir, {
      baseCommit,
      branch: originalBranch,
      trackedFiles: [{ path: 'src/app.js', action: 'modify' }],
    }, tempDir);
    fs.writeFileSync(file, 'const value = 2;\n');

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'YELLOW');
    assert.equal(drift.reason, 'DIRTY_LOCAL');
    assert.ok(drift.details.dirtyLocalFiles.includes('src/app.js'));
    assert.equal(drift.details.branchMismatch, true);
    assert.equal(drift.details.originalBranch, originalBranch);
    assert.equal(drift.details.currentBranch, currentBranch);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift does not return GREEN for a branch mismatch without a valid baseline', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-branch-no-base-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
    const currentBranch = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    const originalBranch = currentBranch === 'baseline-branch' ? 'other-branch' : 'baseline-branch';

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });
    saveFeatureContext(featDir, {
      baseCommit: 'not-a-commit',
      branch: originalBranch,
      trackedFiles: [{ path: 'README.md', action: 'modify' }],
    }, tempDir);

    const drift = calculateFeatureDrift(featDir, {}, tempDir);
    assert.equal(drift.status, 'YELLOW');
    assert.equal(drift.reason, 'BRANCH_MISMATCH');
    assert.equal(drift.details.branchMismatch, true);
    assert.equal(drift.details.originalBranch, originalBranch);
    assert.equal(drift.details.currentBranch, currentBranch);
    assert.equal(Object.prototype.hasOwnProperty.call(drift.details, 'commitsSinceBase'), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('extractTrackedFiles auto-syncs if plan.md is newer than context.json (Judgment Day catch)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-sync-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });

    const contextPath = path.join(featDir, 'context.json');
    const planPath = path.join(featDir, 'plan.md');

    // 1. Guardar context.json viejo
    fs.writeFileSync(
      contextPath,
      JSON.stringify({
        version: '1.0',
        trackedFiles: [{ path: 'src/old.js', action: 'modify' }],
      })
    );

    // Forzar timestamp anterior en context.json
    const pastTime = (Date.now() - 50000) / 1000;
    fs.utimesSync(contextPath, pastTime, pastTime);

    // 2. Crear plan.md nuevo con otro archivo
    fs.writeFileSync(
      planPath,
      `# Plan
## Árbol de cambios
- ~ src/new-service.js
`
    );

    const res = extractTrackedFiles(featDir);
    assert.equal(res.trackedFiles.length, 1);
    assert.equal(res.trackedFiles[0].path, 'src/new-service.js');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('calculateFeatureDrift resolves paths correctly when invoked from a subfolder', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-drift-subfolder-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tempDir, 'src', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'nested', 'index.js'), 'export {};\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(featDir, { recursive: true });
    const planContent = `# Plan\n## Árbol de cambios\n- ~ src/nested/index.js\n`;
    fs.writeFileSync(path.join(featDir, 'plan.md'), planContent);

    // Ejecutar simulando cwd en una subcarpeta profunda
    const subfolderCwd = path.join(tempDir, 'src', 'nested');
    const drift = calculateFeatureDrift(featDir, { planContent }, subfolderCwd);
    assert.equal(drift.status, 'GREEN');
    assert.equal(drift.reason, 'NO_BASE_COMMIT_CLEAN');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('formatHubMenu renders drift status badge cleanly', () => {
  const features = [
    {
      id: '001-test',
      objective: 'Probar semáforo',
      phaseDescription: 'Implementación en progreso',
      totalTasks: 2,
      completedTasks: 1,
      pendingTasks: 1,
      nextTaskTitle: 'Segunda tarea',
      nextCommand: 'vsdd apply',
      isCompleted: false,
      drift: {
        status: 'YELLOW',
        label: '🟡 1 archivo(s) con cambios desde el baseline (+3 commits desde el baseline)',
      },
    },
  ];

  const menu = formatHubMenu(features);
  assert.ok(menu.includes('Salud del Repo: 🟡 1 archivo(s) con cambios desde el baseline (+3 commits desde el baseline)'));
});

test('saveFeatureExploration guarda y acumula Ola 1 y Ola 2 de forma no destructiva', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-explore-test-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'hello\n');
    execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-auth');
    fs.mkdirSync(featDir, { recursive: true });

    // Guardar Ola 1
    const res1 = saveFeatureExploration(
      featDir,
      'spec',
      {
        model: 'flash',
        ola1: {
          type: 'spec-gaps',
          complexity: 10,
          q1: '¿Soportar OAuth2?',
        },
      },
      tempDir
    );

    assert.equal(res1.phases.spec.status, 'en-progreso');
    assert.equal(res1.phases.spec.exploration.ola1.complexity, 10);
    assert.ok(res1.phases.spec.exploration.baseCommit);

    // Guardar Ola 2 posteriormente (debe mergear, no sobrescribir Ola 1)
    const res2 = saveFeatureExploration(
      featDir,
      'spec',
      {
        ola2: {
          type: 'benchmarking-web',
          leader: 'Auth0',
        },
      },
      tempDir
    );

    assert.equal(res2.phases.spec.exploration.ola1.complexity, 10);
    assert.equal(res2.phases.spec.exploration.ola2.leader, 'Auth0');

    // Recuperar con getFeatureExploration
    const retrieved = getFeatureExploration(featDir, 'spec');
    assert.ok(retrieved);
    assert.equal(retrieved.ola1.complexity, 10);
    assert.equal(retrieved.ola2.leader, 'Auth0');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('ciclo de vida de intake draft: saveIntakeDraft, getIntakeDraft, clearIntakeDraft, promoteIntakeDraft', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-intake-draft-test-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, 'init.txt'), 'ok\n');
    execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

    assert.equal(getIntakeDraft(tempDir), null);

    // Guardar borrador inicial
    const saved = saveIntakeDraft(
      {
        ideaSummary: 'Integrar notificaciones push',
        exploration: {
          ola1: { found: true },
        },
      },
      tempDir
    );

    assert.equal(saved.isDraft, true);
    assert.equal(saved.ideaSummary, 'Integrar notificaciones push');

    // Comprobar que getIntakeDraft lo lee
    const draft = getIntakeDraft(tempDir);
    assert.ok(draft);
    assert.equal(draft.ideaSummary, 'Integrar notificaciones push');

    // Promover a carpeta definitiva
    const finalDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '002-push-notifications');
    fs.mkdirSync(finalDir, { recursive: true });

    const promoted = promoteIntakeDraft(finalDir, tempDir);
    assert.ok(promoted);
    assert.equal(promoted.phases.intake.status, 'completado');
    assert.equal(promoted.phases.intake.exploration.ola1.found, true);

    // Borrador debe haberse eliminado
    assert.equal(getIntakeDraft(tempDir), null);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanFeatures detecta .draft-intake.json e inyecta la entrada en pendientes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-scan-draft-test-'));
  try {
    const vsddRoot = path.join(tempDir, 'docs', 'sdd', 'vsdd');
    fs.mkdirSync(vsddRoot, { recursive: true });

    // Guardar un borrador de intake
    saveIntakeDraft(
      {
        ideaSummary: 'Mejora de performance',
      },
      tempDir
    );

    const features = scanFeatures(tempDir);
    assert.equal(features.length, 1);
    assert.equal(features[0].isDraft, true);
    assert.equal(features[0].id, '[Borrador] Intake en progreso');
    assert.equal(features[0].objective, 'Mejora de performance');
    assert.equal(features[0].phase, 'intake');

    const menu = formatHubMenu(features);
    assert.ok(menu.includes('[Borrador] Intake en progreso'));
    assert.ok(menu.includes('• Objetivo: Mejora de performance'));

    // Limpiar borrador y verificar que desaparece
    clearIntakeDraft(tempDir);
    const updatedFeatures = scanFeatures(tempDir);
    assert.equal(updatedFeatures.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('mitigación QA mtime: saveFeatureExploration no corrompe trackedFiles ante plan.md editado', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-mtime-qa-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'src', 'original.js'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(tempDir, 'src', 'manual.js'), 'export const b = 2;\n');
    execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

    const baseCommit = execSync('git rev-parse HEAD', { cwd: tempDir, encoding: 'utf8' }).trim();
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '003-mtime-test');
    fs.mkdirSync(featDir, { recursive: true });

    // 1. Guardar context.json inicial con 1 solo archivo rastreado
    saveFeatureContext(
      featDir,
      {
        baseCommit,
        trackedFiles: [{ path: 'src/original.js', action: 'modify' }],
      },
      tempDir
    );

    // 2. Usuario edita manualmente plan.md añadiendo src/manual.js
    const planContent = `# Plan Técnico\n## Árbol de cambios\n- ~ src/original.js\n- + src/manual.js\n`;
    fs.writeFileSync(path.join(featDir, 'plan.md'), planContent);

    // 3. Se invoca saveFeatureExploration (sin pasar trackedFiles)
    saveFeatureExploration(
      featDir,
      'plan',
      {
        ola1: { modules: ['src/original.js', 'src/manual.js'] },
      },
      tempDir
    );

    // 4. extractTrackedFiles debe contener src/manual.js (sincronizado con plan.md, no congelado en el viejo context.json)
    const tracked = extractTrackedFiles(featDir);
    assert.equal(tracked.trackedFiles.length, 2);
    const paths = tracked.trackedFiles.map((t) => t.path);
    assert.ok(paths.includes('src/original.js'));
    assert.ok(paths.includes('src/manual.js'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI soporta --save-exploration, --get-exploration e --intake-draft', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-cli-explore-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '004-cli');
    fs.mkdirSync(featDir, { recursive: true });

    const cliPath = path.resolve(__dirname, '..', 'scripts', 'vsdd-status.js');

    // 1. Guardar exploración vía CLI
    const saveCmd = `node "${cliPath}" --save-exploration "${featDir}" --phase spec --data '{"model":"flash","ola1":{"tested":true}}'`;
    execSync(saveCmd, { cwd: tempDir, stdio: 'pipe' });

    // 2. Consultar exploración vía CLI
    const getCmd = `node "${cliPath}" --get-exploration "${featDir}" --phase spec`;
    const getOut = execSync(getCmd, { cwd: tempDir, encoding: 'utf8' });
    const parsed = JSON.parse(getOut);
    assert.equal(parsed.model, 'flash');
    assert.equal(parsed.ola1.tested, true);

    // 3. Guardar intake draft vía CLI
    const draftCmd = `node "${cliPath}" --save-intake-draft --data '{"ideaSummary":"cli test draft"}'`;
    execSync(draftCmd, { cwd: tempDir, stdio: 'pipe' });

    const checkDraftCmd = `node "${cliPath}" --intake-draft`;
    const draftOut = execSync(checkDraftCmd, { cwd: tempDir, encoding: 'utf8' });
    const draftParsed = JSON.parse(draftOut);
    assert.equal(draftParsed.ideaSummary, 'cli test draft');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
