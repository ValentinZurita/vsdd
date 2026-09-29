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
  saveInterviewAnswer,
  getInterviewProgress,
  clearInterviewProgress,
  saveIntakeInterviewAnswer,
  isGenericUtility,
  extractArchivosClaveSafe,
  generateFeatureCatalog,
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

    // Feature 3: Completada con resumen
    const feat3 = path.join(vsddRoot, '003-perfil-usuario');
    fs.mkdirSync(feat3);
    fs.writeFileSync(path.join(feat3, 'idea.md'), '# Idea Perfil\nEstado: listo-para-spec\n');
    fs.writeFileSync(path.join(feat3, 'tasks.md'), '# Tasks Perfil\nEstado: completado\n');
    fs.writeFileSync(
      path.join(feat3, 'resumen.md'),
      '# Resumen Perfil\nEstado: completado\n\n## 1. Qué se hizo\nPerfil creado.\n'
    );

    const features = scanFeatures(tempDir);
    assert.equal(features.length, 3);

    // Verificar Feature 1
    const f1 = features.find((f) => f.id === '001-auth-oauth');
    assert.equal(f1.phase, 'spec');
    assert.equal(f1.nextCommand, 'vsdd spec');
    assert.equal(f1.isCompleted, false);
    assert.equal(f1.objective, 'Los usuarios no pueden iniciar sesión con Google.');
    assert.equal(f1.hasResumen, false);
    assert.equal(f1.states.resumen, 'no-generado');

    // Verificar Feature 2
    const f2 = features.find((f) => f.id === '002-carrito-compras');
    assert.equal(f2.phase, 'apply');
    assert.equal(f2.nextCommand, 'vsdd apply');
    assert.equal(f2.isCompleted, false);
    assert.equal(f2.totalTasks, 4);
    assert.equal(f2.completedTasks, 2);
    assert.equal(f2.pendingTasks, 2);
    assert.equal(f2.nextTaskTitle, 'Cálculo de totales y cupones');
    assert.equal(f2.hasResumen, false);

    // Verificar Feature 3
    const f3 = features.find((f) => f.id === '003-perfil-usuario');
    assert.equal(f3.isCompleted, true);
    assert.equal(f3.phase, 'completado');
    assert.equal(f3.hasResumen, true);
    assert.equal(f3.states.resumen, 'completado');

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

test('saveInterviewAnswer acumula respuestas ordenadas y getInterviewProgress las recupera', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-interview-test-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '005-interview');
    fs.mkdirSync(featDir, { recursive: true });

    // Guardar respuesta Q1
    saveInterviewAnswer(
      featDir,
      'spec',
      {
        index: 1,
        topic: 'Autenticación',
        question: '¿Qué método de autenticación usar?',
        answer: 'OAuth2 con GitHub',
        maxQuestions: 4,
      },
      tempDir
    );

    // Guardar respuesta Q2
    saveInterviewAnswer(
      featDir,
      'spec',
      {
        index: 2,
        topic: 'Sesión',
        question: '¿Dónde almacenar el token?',
        answer: 'Cookies HTTP-only',
      },
      tempDir
    );

    const progress = getInterviewProgress(featDir, 'spec');
    assert.ok(progress);
    assert.equal(progress.maxQuestions, 4);
    assert.equal(progress.questions.length, 2);
    assert.equal(progress.questions[0].index, 1);
    assert.equal(progress.questions[0].answer, 'OAuth2 con GitHub');
    assert.equal(progress.questions[1].index, 2);
    assert.equal(progress.questions[1].answer, 'Cookies HTTP-only');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('clearInterviewProgress reinicia las preguntas preservando la exploración técnica', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-clear-interview-test-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '006-clear');
    fs.mkdirSync(featDir, { recursive: true });

    // 1. Guardar exploración
    saveFeatureExploration(
      featDir,
      'plan',
      {
        ola1: { modules: ['src/index.js'] },
      },
      tempDir
    );

    // 2. Guardar respuesta de entrevista
    saveInterviewAnswer(
      featDir,
      'plan',
      {
        index: 1,
        question: '¿Framework de testing?',
        answer: 'node:test',
      },
      tempDir
    );

    // 3. Limpiar entrevista
    clearInterviewProgress(featDir, 'plan', tempDir);

    const interview = getInterviewProgress(featDir, 'plan');
    assert.deepEqual(interview.questions, []);

    // La exploración debe seguir intacta
    const exploration = getFeatureExploration(featDir, 'plan');
    assert.ok(exploration);
    assert.deepEqual(exploration.ola1.modules, ['src/index.js']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('saveIntakeInterviewAnswer y promoteIntakeDraft migran las respuestas de entrevista a context.json', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-intake-interview-test-'));
  try {
    saveIntakeInterviewAnswer(
      {
        index: 1,
        question: '¿Enfoque MVP?',
        answer: 'Solo lectura inicial',
      },
      tempDir
    );

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '007-promoted');
    fs.mkdirSync(featDir, { recursive: true });

    const promoted = promoteIntakeDraft(featDir, tempDir);
    assert.ok(promoted);
    assert.equal(promoted.phases.intake.status, 'completado');
    assert.equal(promoted.phases.intake.interview.questions.length, 1);
    assert.equal(promoted.phases.intake.interview.questions[0].answer, 'Solo lectura inicial');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI soporta --save-interview, --get-interview y --clear-interview', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-cli-interview-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '008-cli-interview');
    fs.mkdirSync(featDir, { recursive: true });

    const cliPath = path.resolve(__dirname, '..', 'scripts', 'vsdd-status.js');

    // 1. Guardar respuesta vía CLI
    const saveCmd = `node "${cliPath}" --save-interview "${featDir}" --phase spec --data '{"index":1,"question":"q1","answer":"ans1"}'`;
    execSync(saveCmd, { cwd: tempDir, stdio: 'pipe' });

    // 2. Obtener progreso vía CLI
    const getCmd = `node "${cliPath}" --get-interview "${featDir}" --phase spec`;
    const getOut = execSync(getCmd, { cwd: tempDir, encoding: 'utf8' });
    const parsed = JSON.parse(getOut);
    assert.equal(parsed.questions.length, 1);
    assert.equal(parsed.questions[0].answer, 'ans1');

    // 3. Limpiar vía CLI
    const clearCmd = `node "${cliPath}" --clear-interview "${featDir}" --phase spec`;
    execSync(clearCmd, { cwd: tempDir, stdio: 'pipe' });

    const clearCheckOut = execSync(getCmd, { cwd: tempDir, encoding: 'utf8' });
    const clearParsed = JSON.parse(clearCheckOut);
    assert.deepEqual(clearParsed.questions, []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI rechaza argumentos faltantes o banderas mal ubicadas con salida de error', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-cli-err-'));
  try {
    const cliPath = path.resolve(__dirname, '..', 'scripts', 'vsdd-status.js');

    // Sin directorio para --save-interview
    assert.throws(() => {
      execSync(`node "${cliPath}" --save-interview --phase spec`, { cwd: tempDir, stdio: 'pipe' });
    });

    // Sin fase para --get-interview
    assert.throws(() => {
      execSync(`node "${cliPath}" --get-interview "${tempDir}"`, { cwd: tempDir, stdio: 'pipe' });
    });

    // Sin directorio para --promote-intake-draft
    assert.throws(() => {
      execSync(`node "${cliPath}" --promote-intake-draft`, { cwd: tempDir, stdio: 'pipe' });
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanFeatures clasifica como completada una feature que solo contiene resumen.md', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-resumen-only-'));
  try {
    const vsddRoot = path.join(tempDir, 'docs', 'sdd', 'vsdd');
    const featDir = path.join(vsddRoot, '099-feature-archivada');
    fs.mkdirSync(featDir, { recursive: true });

    fs.writeFileSync(
      path.join(featDir, 'resumen.md'),
      `# Resumen de Entrega: Feature Archivada

Fecha: 2026-09-29
Rama integrada: feature/arch → main
Estado: completado

## 1. Qué se hizo
Migración de datos histórica completada sin pérdidas.

## 2. Componentes y Pruebas
- Archivos clave: \`src/migracion.js\`
`
    );

    const features = scanFeatures(tempDir);
    assert.equal(features.length, 1);

    const f = features[0];
    assert.equal(f.id, '099-feature-archivada');
    assert.equal(f.isCompleted, true);
    assert.equal(f.phase, 'completado');
    assert.equal(f.hasResumen, true);
    assert.equal(f.states.resumen, 'completado');
    assert.equal(f.objective, 'Migración de datos histórica completada sin pérdidas.');

    const menu = formatHubMenu(features);
    assert.match(menu, /No se encontraron funcionalidades pendientes/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('isGenericUtility identifies generic and utility paths correctly', () => {
  assert.equal(isGenericUtility('node_modules/express/index.js'), true);
  assert.equal(isGenericUtility('vendor/bundle.js'), true);
  assert.equal(isGenericUtility('src/utils/math.js'), true);
  assert.equal(isGenericUtility('lib/helpers/format.ts'), true);
  assert.equal(isGenericUtility('src/types/user.d.ts'), true);
  assert.equal(isGenericUtility('src/index.js'), true);
  assert.equal(isGenericUtility('package.json'), true);
  assert.equal(isGenericUtility('README.md'), true);
  assert.equal(isGenericUtility(null), true);
  assert.equal(isGenericUtility(undefined), true);

  // Archivos de dominio reales no deben considerarse genéricos
  assert.equal(isGenericUtility('src/auth/service.js'), false);
  assert.equal(isGenericUtility('src/checkout/coupons.ts'), false);
  assert.equal(isGenericUtility('scripts/vsdd-status.js'), false);
});

test('extractArchivosClaveSafe extracts specific non-generic files safely from resumen.md and plan.md', () => {
  // 1. Extracción desde resumen.md
  const resumen = `# Resumen
## 1. Qué se hizo
Implementación de cupones.

## 2. Componentes y Pruebas
- Archivos clave: \`src/checkout/coupons.ts\`, \`src/utils/format.js\`, \`src/checkout/validator.ts\`, \`src/checkout/api.ts\`, \`src/checkout/extra.ts\`
- Pruebas añadidas: npm test
`;
  const files1 = extractArchivosClaveSafe(resumen, null);
  // Debe filtrar utils/format.js y limitar a máximo 3
  assert.deepEqual(files1, [
    'src/checkout/coupons.ts',
    'src/checkout/validator.ts',
    'src/checkout/api.ts',
  ]);

  // 2. Fallback a plan.md cuando resumen.md no tiene componentes o es nulo
  const plan = `# Plan
## 1. Estrategia
Cosas

## 2. Árbol de cambios
- \`+ src/billing/invoice.js\`
- \`* src/utils/helpers.js\`
- \`+ src/billing/tax.js\`
`;
  const files2 = extractArchivosClaveSafe(null, plan);
  assert.deepEqual(files2, ['src/billing/invoice.js', 'src/billing/tax.js']);

  // 3. Resiliencia ante entradas corruptas
  assert.deepEqual(extractArchivosClaveSafe(undefined, undefined), []);
  assert.deepEqual(extractArchivosClaveSafe('texto sin formato', 'otro texto'), []);
});

test('generateFeatureCatalog returns ultracompact manifest capped and sorted', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-catalog-test-'));
  try {
    const vsddRoot = path.join(tempDir, 'docs', 'sdd', 'vsdd');
    fs.mkdirSync(vsddRoot, { recursive: true });

    // Crear 20 features completadas y 1 pendiente
    for (let i = 1; i <= 20; i++) {
      const featId = `${String(i).padStart(3, '0')}-feature-${i}`;
      const featDir = path.join(vsddRoot, featId);
      fs.mkdirSync(featDir, { recursive: true });

      const longObjective = `Este es un objetivo sumamente largo y detallado que definitivamente supera los ochenta caracteres permitidos en el manifiesto condensado para la feature ${i}.`;
      fs.writeFileSync(
        path.join(featDir, 'resumen.md'),
        `# Resumen Feature ${i}
Estado: completado

## 1. Qué se hizo
${longObjective}

## 2. Componentes y Pruebas
- Archivos clave: \`src/module${i}/core.js\`, \`src/utils/common.js\`
`
      );
    }

    // Feature pendiente (no debe entrar al catálogo)
    const pendingDir = path.join(vsddRoot, '021-feature-pendiente');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.writeFileSync(
      path.join(pendingDir, 'idea.md'),
      '# Idea Pendiente\nEstado: listo-para-spec\n'
    );

    // Ejecutar catálogo con límite por defecto (15)
    const catalog = generateFeatureCatalog(tempDir);
    assert.equal(catalog.length, 15);

    // Debe ordenar de forma descendente (020, 019, ..., 006)
    assert.equal(catalog[0].id, '020-feature-20');
    assert.equal(catalog[14].id, '006-feature-6');

    // Verificar truncamiento a <= 80 caracteres (con ellipsis si fue recortado)
    for (const item of catalog) {
      assert.ok(item.objetivo.length <= 80, `Objetivo ${item.objetivo} excede 80 chars`);
      assert.ok(item.objetivo.endsWith('...'));
      assert.equal(item.archivosClave.length, 1); // Excluyó utils/common.js
      assert.match(item.archivosClave[0], /src\/module\d+\/core\.js/);
    }

    // Probar con límite personalizado (ej: 5)
    const catalog5 = generateFeatureCatalog(tempDir, 5);
    assert.equal(catalog5.length, 5);
    assert.equal(catalog5[0].id, '020-feature-20');
    assert.equal(catalog5[4].id, '016-feature-16');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI --catalog output is valid JSON and matches manifest schema', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-catalog-cli-'));
  try {
    const vsddRoot = path.join(tempDir, 'docs', 'sdd', 'vsdd');
    const featDir = path.join(vsddRoot, '001-feature-test');
    fs.mkdirSync(featDir, { recursive: true });

    fs.writeFileSync(
      path.join(featDir, 'resumen.md'),
      `# Resumen Feature Test
Estado: completado

## 1. Qué se hizo
Objetivo conciso.

## 2. Componentes y Pruebas
- Archivos clave: \`src/test.js\`
`
    );

    const cliPath = path.resolve(__dirname, '..', 'scripts', 'vsdd-status.js');
    const rawOutput = execSync(`node "${cliPath}" --catalog`, {
      cwd: tempDir,
      encoding: 'utf8',
    });

    const parsed = JSON.parse(rawOutput.trim());
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 1);
    assert.deepEqual(parsed[0], {
      id: '001-feature-test',
      objetivo: 'Objetivo conciso.',
      archivosClave: ['src/test.js'],
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});


