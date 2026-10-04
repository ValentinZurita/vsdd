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
  abortFeature,
  compareSemver,
  formatUpdateBanner,
  formatMismatchBanner,
  detectDualInstallationMismatch,
  checkVersionUpdate,
  performVsddUpdate,
  getLocalVsddVersion,
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

    // Modificación no commiteada para validar que subfolderCwd detecta cambios sucios
    fs.appendFileSync(path.join(tempDir, 'src', 'nested', 'index.js'), '// dirty\n');

    // Ejecutar simulando cwd en una subcarpeta profunda
    const subfolderCwd = path.join(tempDir, 'src', 'nested');
    const drift = calculateFeatureDrift(featDir, { planContent }, subfolderCwd);
    assert.equal(drift.status, 'YELLOW');
    assert.equal(drift.reason, 'DIRTY_LOCAL');
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

test('generateFeatureCatalog processes preloadedFeatures in-memory without scanning disk', () => {
  const mockFeatures = [
    {
      id: '002-feature-two',
      isCompleted: true,
      objective: 'Segunda funcionalidad terminada.',
      resumenContent: '## 2. Componentes\n- Archivos clave: `src/two.ts`',
      planContent: '',
    },
    {
      id: '001-feature-one',
      isCompleted: true,
      objective: 'Primera funcionalidad terminada.',
      resumenContent: '## 2. Componentes\n- Archivos clave: `src/one.ts`',
      planContent: '',
    },
    {
      id: '003-feature-pending',
      isCompleted: false,
      objective: 'En progreso',
    },
  ];

  // Pasar preloadedFeatures; cwd se ignora por completo
  const catalog = generateFeatureCatalog(null, 5, mockFeatures);
  assert.equal(catalog.length, 2);
  assert.equal(catalog[0].id, '002-feature-two');
  assert.equal(catalog[1].id, '001-feature-one');
  assert.deepEqual(catalog[0].archivosClave, ['src/two.ts']);
  assert.deepEqual(catalog[1].archivosClave, ['src/one.ts']);
});

test('formatHubMenu renders clean initial state when repository has 0 pending and 0 completed', () => {
  const menu = formatHubMenu([]);
  assert.match(menu, /No se encontraron funcionalidades en este proyecto/i);
  assert.match(menu, /vsdd intake/i);
  assert.ok(!menu.includes('Últimas funcionalidades completadas'));
});

test('formatHubMenu displays completed features section when 0 pending but >= 1 completed exist', () => {
  const mockFeatures = [
    {
      id: '002-checkout-flow',
      isCompleted: true,
      objective: 'Flujo de checkout seguro.',
      resumenContent: '## 2. Componentes\n- Archivos clave: `src/checkout/service.ts`',
      planContent: '',
    },
    {
      id: '001-auth-oauth',
      isCompleted: true,
      objective: 'Autenticación OAuth.',
      resumenContent: '## 2. Componentes\n- Archivos clave: `src/auth/provider.ts`',
      planContent: '',
    },
  ];

  const menu = formatHubMenu(mockFeatures);
  assert.match(menu, /No se encontraron funcionalidades pendientes en este proyecto/i);
  assert.match(menu, /Últimas funcionalidades completadas:/i);
  assert.match(menu, /002-checkout-flow - Flujo de checkout seguro\. \(Archivos clave: src\/checkout\/service\.ts\)/i);
  assert.match(menu, /001-auth-oauth - Autenticación OAuth\. \(Archivos clave: src\/auth\/provider\.ts\)/i);
  assert.match(menu, /Para iniciar una nueva funcionalidad: vsdd intake/i);
});

test('formatHubMenu renders catalog notice when there are both pending and completed features', () => {
  const mockFeatures = [
    {
      id: '002-pending-feature',
      isCompleted: false,
      objective: 'Trabajo pendiente.',
      phaseDescription: 'Tareas en curso',
      totalTasks: 3,
      completedTasks: 1,
      pendingTasks: 2,
      nextCommand: 'vsdd apply',
    },
    {
      id: '001-completed-feature',
      isCompleted: true,
      objective: 'Trabajo listo.',
      resumenContent: '## 2. Componentes\n- Archivos clave: `src/ready.ts`',
      planContent: '',
    },
  ];

  const menu = formatHubMenu(mockFeatures);
  assert.match(menu, /002-pending-feature/i);
  assert.match(menu, /Hay 1 funcionalidad\(es\) completada\(s\) registradas \(consulta el catálogo con: vsdd --catalog\)/i);
});

// ---------------------------------------------------------------------------
// Tests para vsdd abort (cancelación limpia de features y borradores)
// ---------------------------------------------------------------------------

test('abortFeature returns error if feature directory does not exist', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-notfound-'));
  try {
    const res = abortFeature('non-existent-feature', {}, tempDir);
    assert.equal(res.success, false);
    assert.match(res.message, /No se encontró la funcionalidad/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('abortFeature discards intake draft when target is draft', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-draft-'));
  try {
    const vsddRoot = path.join(tempDir, 'docs', 'sdd', 'vsdd');
    fs.mkdirSync(vsddRoot, { recursive: true });
    const draftPath = path.join(vsddRoot, '.draft-intake.json');
    fs.writeFileSync(draftPath, JSON.stringify({ isDraft: true, ideaSummary: 'Draft test' }));

    const res = abortFeature('draft', {}, tempDir);
    assert.equal(res.success, true);
    assert.equal(res.isDraft, true);
    assert.equal(fs.existsSync(draftPath), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('abortFeature halts safely when git working tree has dirty uncommitted changes', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-dirty-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'clean\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-dirty-feat');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n');

    // Make working tree dirty
    fs.writeFileSync(path.join(tempDir, 'file.txt'), 'dirty changes\n');

    const res = abortFeature('001-dirty-feat', {}, tempDir);
    assert.equal(res.success, false);
    assert.equal(res.dirty, true);
    assert.match(res.message, /cambios locales sin guardar/i);

    // Verify idea.md was not mutated
    const content = fs.readFileSync(path.join(featDir, 'idea.md'), 'utf8');
    assert.match(content, /Estado: borrador/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('abortFeature stamps Estado: cancelado on markdown files and context.json', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-stamp-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-cancel-me');
    fs.mkdirSync(featDir, { recursive: true });

    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n## Problema\nAlgo');
    fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\nEstado: especificado\n## Contexto');
    fs.writeFileSync(path.join(featDir, 'plan.md'), '# Plan\nEstado: planificado\n## Enfoque');
    fs.writeFileSync(path.join(featDir, 'tasks.md'), '# Tasks\nEstado: en-progreso\n- [ ] Tarea 1');
    fs.writeFileSync(path.join(featDir, 'context.json'), JSON.stringify({ version: '1.0', git: { branch: 'feat/test' } }));

    const res = abortFeature('001-cancel-me', { reason: 'Pivote de negocio' }, tempDir);
    assert.equal(res.success, true);

    const idea = fs.readFileSync(path.join(featDir, 'idea.md'), 'utf8');
    assert.match(idea, /Estado: cancelado/);
    assert.match(idea, /Motivo de cancelación: Pivote de negocio/);

    const spec = fs.readFileSync(path.join(featDir, 'spec.md'), 'utf8');
    assert.match(spec, /Estado: cancelado/);

    const plan = fs.readFileSync(path.join(featDir, 'plan.md'), 'utf8');
    assert.match(plan, /Estado: cancelado/);

    const tasks = fs.readFileSync(path.join(featDir, 'tasks.md'), 'utf8');
    assert.match(tasks, /Estado: cancelado/);

    const ctx = JSON.parse(fs.readFileSync(path.join(featDir, 'context.json'), 'utf8'));
    assert.equal(ctx.status, 'cancelado');
    assert.equal(ctx.cancelReason, 'Pivote de negocio');
    assert.ok(ctx.cancelledAt);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('abortFeature switches to baseBranch and deletes feature branch with protection for main', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-git-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    // Determine default branch name (master or main)
    const baseBranch = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();

    // Create and checkout feature branch
    const featureBranch = 'feat/001-feature';
    execSync(`git checkout -b ${featureBranch}`, { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-feature');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n');
    fs.writeFileSync(
      path.join(featDir, 'context.json'),
      JSON.stringify({ git: { branch: featureBranch, baseBranch } })
    );

    // Commit feature directory so working tree is clean
    execSync('git add . && git commit -m "add feature docs"', { cwd: tempDir, stdio: 'ignore' });

    const res = abortFeature('001-feature', { deleteBranch: true, reason: 'Ya no se necesita' }, tempDir);
    assert.equal(res.success, true);
    assert.equal(res.switchedBranch, true);
    assert.equal(res.branchDeleted, true);

    const currentBranchAfter = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(currentBranchAfter, baseBranch);

    // Verify feature branch was deleted
    const branches = execSync('git branch', { cwd: tempDir, encoding: 'utf8' });
    assert.equal(branches.includes(featureBranch), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanFeatures and formatHubMenu exclude cancelled features from pending and completed lists', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-hub-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-cancelled-feat');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: cancelado\nMotivo de cancelación: Descartada\n');
    fs.writeFileSync(path.join(featDir, 'context.json'), JSON.stringify({ status: 'cancelado' }));

    const features = scanFeatures(tempDir);
    assert.equal(features.length, 1);
    assert.equal(features[0].isCancelled, true);
    assert.equal(features[0].isCompleted, false);
    assert.equal(features[0].phase, 'cancelado');

    // Hub con solo una funcionalidad cancelada debe reportar 0 pendientes y 0 completadas
    const hub = formatHubMenu(features);
    assert.match(hub, /No se encontraron funcionalidades en este proyecto/i);
    assert.equal(hub.includes('001-cancelled-feat'), false);
    assert.equal(hub.includes('[C] Cancelar'), false);

    // Hub con una funcionalidad activa y una cancelada
    const activeFeat = {
      id: '002-active-feat',
      isCompleted: false,
      isCancelled: false,
      objective: 'Feature activa.',
      phaseDescription: 'En progreso',
      totalTasks: 2,
      completedTasks: 0,
      pendingTasks: 2,
      nextCommand: 'vsdd apply',
    };
    const hubWithActive = formatHubMenu([activeFeat, features[0]]);
    assert.match(hubWithActive, /002-active-feat/i);
    assert.equal(hubWithActive.includes('001-cancelled-feat'), false);
    assert.match(hubWithActive, /\[C\] Cancelar o descartar una funcionalidad en curso \(vsdd abort\)/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI --abort executes abortFeature and outputs JSON with --json flag', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-cli-'));
  try {
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '001-cli-test');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n');

    const scriptPath = path.resolve(__dirname, '../scripts/vsdd-status.js');
    const stdout = execSync(`node "${scriptPath}" --abort 001-cli-test --reason "Prueba CLI" --json`, {
      cwd: tempDir,
      encoding: 'utf8',
    });

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.success, true);
    assert.equal(parsed.featureId, '001-cli-test');

    const idea = fs.readFileSync(path.join(featDir, 'idea.md'), 'utf8');
    assert.match(idea, /Estado: cancelado/);
    assert.match(idea, /Motivo de cancelación: Prueba CLI/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});




test('abortFeature on baseBranch deletes featureBranch and ensures working tree is clean', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-base-git-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const baseBranch = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    const featureBranch = 'feat/002-feature';
    
    // Create feature dir ON BASE BRANCH so it exists when we return
    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '002-feature');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n');
    fs.writeFileSync(
      path.join(featDir, 'context.json'),
      JSON.stringify({ git: { branch: featureBranch, baseBranch } })
    );

    execSync('git add . && git commit -m "add feature docs on base branch"', { cwd: tempDir, stdio: 'ignore' });

    // Now branch off
    execSync(`git checkout -b ${featureBranch}`, { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n');
    execSync('git add . && git commit -m "add spec on feature branch"', { cwd: tempDir, stdio: 'ignore' });

    // Checkout baseBranch before calling abortFeature
    execSync(`git checkout ${baseBranch}`, { cwd: tempDir, stdio: 'ignore' });

    // Call abortFeature from baseBranch
    const res = abortFeature('002-feature', { deleteBranch: true, reason: 'Test cancel from baseBranch' }, tempDir);
    assert.equal(res.success, true);
    assert.equal(res.branchDeleted, true);

    const currentBranchAfter = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(currentBranchAfter, baseBranch);

    // Verify feature branch was deleted
    const branches = execSync('git branch', { cwd: tempDir, encoding: 'utf8' });
    assert.equal(branches.includes(featureBranch), false);

    // Verify git working tree is clean
    const statusOut = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(statusOut, '');

  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('abortFeature refuses to delete protected branches like develop or main even with deleteBranch=true', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-protect-'));
  try {
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    // Create develop branch and switch to it
    execSync('git checkout -b develop', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '003-feat-on-develop');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n');
    fs.writeFileSync(
      path.join(featDir, 'context.json'),
      JSON.stringify({ git: { branch: 'develop', baseBranch: 'main' } })
    );

    execSync('git add . && git commit -m "commit on develop"', { cwd: tempDir, stdio: 'ignore' });

    // Abort feature specifying deleteBranch: true while on develop
    const res = abortFeature('003-feat-on-develop', { deleteBranch: true, reason: 'Cancel on develop' }, tempDir);
    assert.equal(res.success, true);
    assert.equal(res.branchDeleted, false); // Must NOT delete develop!

    // Verify develop branch still exists
    const branches = execSync('git branch', { cwd: tempDir, encoding: 'utf8' });
    assert.ok(branches.includes('develop'));

    // Verify cancellation was stamped and committed
    const idea = fs.readFileSync(path.join(featDir, 'idea.md'), 'utf8');
    assert.match(idea, /Estado: cancelado/);
    const statusOut = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(statusOut, '');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('abortFeature refuses to delete branch when it is the only branch in repo (e.g. named perro)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-abort-perro-'));
  try {
    execSync('git init -b perro', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });

    fs.writeFileSync(path.join(tempDir, 'README.md'), 'baseline\n');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const featDir = path.join(tempDir, 'docs', 'sdd', 'vsdd', '004-feat-on-perro');
    fs.mkdirSync(featDir, { recursive: true });
    fs.writeFileSync(path.join(featDir, 'idea.md'), '# Idea\nEstado: borrador\n');
    fs.writeFileSync(
      path.join(featDir, 'context.json'),
      JSON.stringify({ git: { branch: 'perro' } })
    );

    execSync('git add . && git commit -m "commit on perro"', { cwd: tempDir, stdio: 'ignore' });

    // Abort with deleteBranch: true
    const res = abortFeature('004-feat-on-perro', { deleteBranch: true, reason: 'Abort on perro' }, tempDir);
    assert.equal(res.success, true);
    assert.equal(res.branchDeleted, false); // Must NOT delete the only branch perro!

    // Verify perro branch still exists and is checked out
    const current = execSync('git branch --show-current', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(current, 'perro');

    // Verify cancellation was stamped and committed
    const idea = fs.readFileSync(path.join(featDir, 'idea.md'), 'utf8');
    assert.match(idea, /Estado: cancelado/);
    const statusOut = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf8' }).trim();
    assert.equal(statusOut, '');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('compareSemver compara correctamente versiones semver con y sin prefijo v', () => {
  assert.equal(compareSemver('0.43.0', '0.44.0'), 1);
  assert.equal(compareSemver('0.43.0', '0.43.0'), 0);
  assert.equal(compareSemver('0.44.0', '0.43.0'), -1);
  assert.equal(compareSemver('v0.43.0', '0.44.0'), 1);
  assert.equal(compareSemver('0.43', '0.43.1'), 1);
  assert.equal(compareSemver('0.43.1', '0.43'), -1);
});

test('formatUpdateBanner genera un banner alineado a 40 columnas visuales con el trueno', () => {
  const banner = formatUpdateBanner('0.43.0', '0.44.0');
  assert.match(banner, /\[UPDATE\] 0\.43\.0 -> 0\.44\.0/);
  assert.match(banner, /vsdd update/);
  const lines = banner.split('\n');
  assert.equal(lines.length, 4);
  lines.forEach((l) => {
    const visualWidth = l.includes('⚡') ? [...l].length + 1 : [...l].length;
    assert.equal(visualWidth, 40);
  });
});

test('checkVersionUpdate utiliza caché cuando está vigente y consulta fetcher ante vencimiento', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-update-cache-test-'));
  try {
    let fetchCalls = 0;
    let requestedUrl = '';
    const mockFetcher = async (url) => {
      fetchCalls += 1;
      requestedUrl = url;
      return { tag_name: 'v0.45.0' };
    };

    // 1. Primera consulta: sin caché, debe consultar fetcher
    const res1 = await checkVersionUpdate('0.43.0', {
      cacheDir: tempDir,
      fetchRemote: mockFetcher,
    });
    assert.equal(fetchCalls, 1);
    assert.equal(res1.updateAvailable, true);
    assert.equal(res1.latestVersion, '0.45.0');
    assert.equal(res1.cached, false);
    assert.match(requestedUrl, /\/releases\/latest$/);

    // 2. Segunda consulta: con caché vigente, NO debe consultar fetcher
    const res2 = await checkVersionUpdate('0.43.0', {
      cacheDir: tempDir,
      fetchRemote: mockFetcher,
    });
    assert.equal(fetchCalls, 1); // No incrementó
    assert.equal(res2.updateAvailable, true);
    assert.equal(res2.latestVersion, '0.45.0');
    assert.equal(res2.cached, true);

    // 3. Consulta con fallo de red: no explota y retorna error controlado
    const failingFetcher = async () => {
      throw new Error('Connection refused');
    };
    const resFail = await checkVersionUpdate('0.43.0', {
      cacheDir: path.join(tempDir, 'sub'),
      fetchRemote: failingFetcher,
      force: true,
    });
    assert.equal(resFail.updateAvailable, false);
    assert.equal(resFail.latestVersion, '0.43.0');
    assert.match(resFail.error, /Connection refused/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

function createUpdateFixture(failure = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-update-release-test-'));
  const consumerDir = path.join(root, 'consumer');
  fs.mkdirSync(consumerDir);
  const calls = [];
  const runner = (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'gh' && args[0] === 'release') {
      if (failure === 'missing-gh') {
        const error = new Error('gh: command not found');
        error.code = 'ENOENT';
        throw error;
      }
      return 'v1.2.3\n';
    }
    if (command === 'curl') {
      const outputPath = args[args.indexOf('--output') + 1];
      fs.writeFileSync(outputPath, 'fixture archive');
      return '';
    }
    if (command === 'gh' && args[0] === 'attestation') {
      if (failure === 'invalid-attestation') throw new Error('attestation verification failed');
      return '';
    }
    if (command === 'tar') {
      const destination = args[args.indexOf('-C') + 1];
      const releaseDir = path.join(destination, 'vsdd-v1.2.3');
      fs.mkdirSync(path.join(releaseDir, 'scripts'), { recursive: true });
      fs.writeFileSync(path.join(releaseDir, 'package.json'), JSON.stringify({ name: 'vsdd', version: '1.2.3' }));
      fs.writeFileSync(path.join(releaseDir, 'scripts', 'install-skill.js'), '');
      return '';
    }
    if (command === 'node') return 'Mock install completed';
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };
  return { root, consumerDir, calls, runner };
}

function legacyShellRunner(command) {
  return `Mocked legacy command: ${command}`;
}

test('performVsddUpdate downloads a versioned asset, verifies its exact identity, then extracts and installs', (t) => {
  const fixture = createUpdateFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

  const result = performVsddUpdate(fixture.consumerDir, {
    execFileCommand: fixture.runner,
    execCommand: legacyShellRunner,
    platform: 'linux',
    tempRoot: fixture.root,
  });

  assert.equal(result.success, true);
  const commands = fixture.calls.map(({ command, args }) => `${command} ${args.join(' ')}`);
  const releaseIndex = commands.findIndex((value) => value.startsWith('gh release view'));
  const downloadIndex = commands.findIndex((value) => value.startsWith('curl '));
  const verifyIndex = commands.findIndex((value) => value.startsWith('gh attestation verify'));
  const extractIndex = commands.findIndex((value) => value.startsWith('tar '));
  const installIndex = commands.findIndex((value) => value.startsWith('node '));
  assert.ok(releaseIndex >= 0 && releaseIndex < downloadIndex);
  assert.ok(downloadIndex < verifyIndex && verifyIndex < extractIndex && extractIndex < installIndex);
  assert.match(commands[downloadIndex], /releases\/download\/v1\.2\.3\/vsdd-v1\.2\.3\.tar\.gz/);
  assert.match(commands[verifyIndex], /--repo ValentinZurita\/vsdd/);
  assert.match(commands[verifyIndex], /--cert-identity https:\/\/github\.com\/ValentinZurita\/vsdd\/\.github\/workflows\/release\.yml@refs\/tags\/v1\.2\.3/);
  assert.match(commands[verifyIndex], /--source-ref refs\/tags\/v1\.2\.3/);
});

for (const failure of ['missing-gh', 'invalid-attestation']) {
  test(`performVsddUpdate fails closed for ${failure}`, (t) => {
    const fixture = createUpdateFixture(failure);
    t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));

    const result = performVsddUpdate(fixture.consumerDir, {
      execFileCommand: fixture.runner,
      execCommand: legacyShellRunner,
      platform: 'linux',
      tempRoot: fixture.root,
    });

    assert.equal(result.success, false);
    assert.equal(fixture.calls.some(({ command }) => command === 'tar' || command === 'node'), false);
  });
}

test('performVsddUpdate does not pull or mutate a VSDD source checkout', (t) => {
  const fixture = createUpdateFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(fixture.consumerDir, 'SKILL.md'), 'source checkout');
  fs.writeFileSync(path.join(fixture.consumerDir, 'package.json'), JSON.stringify({ name: 'vsdd' }));

  const result = performVsddUpdate(fixture.consumerDir, {
    execFileCommand: fixture.runner,
    execCommand: legacyShellRunner,
  });
  assert.equal(result.success, false);
  assert.match(result.message, /source checkout/i);
  assert.deepEqual(fixture.calls, []);
});

test('CLI vsdd update in a source checkout never invokes real git pull', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-update-cli-test-'));
  const binDir = path.join(tempDir, 'bin');
  fs.mkdirSync(binDir);
  const gitMarker = path.join(tempDir, 'git-was-called');
  const fakeGit = path.join(binDir, 'git');
  fs.writeFileSync(fakeGit, '#!/bin/sh\nprintf called > "$GIT_MARKER"\nexit 11\n', { mode: 0o755 });
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const cliPath = path.join(__dirname, '..', 'scripts', 'vsdd-status.js');
  const out = execSync(`node "${cliPath}" update --json`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
      HOME: tempDir,
      GIT_MARKER: gitMarker,
    },
  }).trim();
  const parsed = JSON.parse(out);
  assert.equal(typeof parsed.success, 'boolean');
  assert.equal(parsed.success, false);
  assert.match(parsed.message, /source checkout/i);
  assert.equal(fs.existsSync(gitMarker), false, 'CLI must not invoke git pull for this checkout');
});

test('CLI soporta --version y -v en texto plano y --json', () => {
  const cliPath = path.join(__dirname, '..', 'scripts', 'vsdd-status.js');
  const vLong = execSync(`node "${cliPath}" --version`, { encoding: 'utf8' }).trim();
  const vShort = execSync(`node "${cliPath}" -v`, { encoding: 'utf8' }).trim();
  const vJson = execSync(`node "${cliPath}" --version --json`, { encoding: 'utf8' }).trim();

  assert.match(vLong, /^⚡ VSDD v\d+\.\d+(\.\d+)?$/);
  assert.equal(vLong, vShort);

  const parsed = JSON.parse(vJson);
  assert.ok(parsed.version);
  assert.match(parsed.version, /^\d+\.\d+(\.\d+)?$/);
});

test('formatMismatchBanner genera un banner alineado a 40 columnas visuales con trueno y aviso', () => {
  const banner = formatMismatchBanner('0.40.0', '0.43.0');
  assert.match(banner, /\[AVISO\] Copia local antigua/);
  assert.match(banner, /Local: v0\.40\.0/);
  assert.match(banner, /Global: v0\.43\.0/);
  assert.match(banner, /vsdd update/);

  const lines = banner.split('\n');
  assert.equal(lines.length, 6);
  lines.forEach((l) => {
    const visualWidth = l.includes('⚡') ? [...l].length + 1 : [...l].length;
    assert.equal(visualWidth, 40);
  });
});

test('detectDualInstallationMismatch detecta copia local obsoleta respecto a global', () => {
  const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-mismatch-proj-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-mismatch-home-'));
  try {
    // 1. Sin instalación local -> mismatch: false
    const res1 = detectDualInstallationMismatch(tempProject, tempHome);
    assert.equal(res1.mismatch, false);

    // 2. Con instalación local con versión 0.40.0 y global con 0.43.0
    const localSkillDir = path.join(tempProject, '.agents', 'skills', 'vsdd');
    fs.mkdirSync(localSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(localSkillDir, 'SKILL.md'),
      `---\nname: vsdd\nmetadata:\n  version: '0.40.0'\n---\n`,
      'utf8'
    );

    const globalSkillDir = path.join(tempHome, '.gemini', 'config', 'skills', 'vsdd');
    fs.mkdirSync(globalSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalSkillDir, 'SKILL.md'),
      `---\nname: vsdd\nmetadata:\n  version: '0.43.0'\n---\n`,
      'utf8'
    );

    const res2 = detectDualInstallationMismatch(tempProject, tempHome);
    assert.equal(res2.mismatch, true);
    assert.equal(res2.localVersion, '0.40.0');
    assert.equal(res2.globalVersion, '0.43.0');
    assert.equal(res2.reason, 'local_outdated');

    // 3. Con instalación local actualizada (versión igual o superior) -> mismatch: false
    fs.writeFileSync(
      path.join(localSkillDir, 'SKILL.md'),
      `---\nname: vsdd\nmetadata:\n  version: '0.43.0'\n---\n`,
      'utf8'
    );
    const res3 = detectDualInstallationMismatch(tempProject, tempHome);
    assert.equal(res3.mismatch, false);

    // 4. En el propio repositorio de desarrollo de vsdd (package.json name: vsdd) -> mismatch: false
    fs.writeFileSync(
      path.join(tempProject, 'package.json'),
      JSON.stringify({ name: 'vsdd', version: '0.43.0' }),
      'utf8'
    );
    fs.writeFileSync(
      path.join(localSkillDir, 'SKILL.md'),
      `---\nname: vsdd\nmetadata:\n  version: '0.10.0'\n---\n`,
      'utf8'
    );
    const res4 = detectDualInstallationMismatch(tempProject, tempHome);
    assert.equal(res4.mismatch, false);
  } finally {
    fs.rmSync(tempProject, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('formatHubMenu incluye formatMismatchBanner cuando mismatchInfo.mismatch es true', () => {
  const menu = formatHubMenu([], {
    mismatchInfo: {
      mismatch: true,
      localVersion: '0.38.0',
      globalVersion: '0.43.0',
    },
  });

  assert.match(menu, /\[AVISO\] Copia local antigua/);
  assert.match(menu, /Local: v0\.38\.0/);
  assert.match(menu, /Global: v0\.43\.0/);
});

test('resolveReferenceFile y resolveTargetFile entregan rutas absolutas canónicas para JIT context', () => {
  const { resolveReferenceFile, resolveTargetFile } = require('../scripts/vsdd-status.js');
  
  // Referencias canónicas de fases
  const specRef = resolveReferenceFile('spec');
  assert.ok(path.isAbsolute(specRef), 'La ruta de referencia spec debe ser absoluta');
  assert.ok(fs.existsSync(specRef), 'El archivo de referencia spec.md debe existir');

  const planRef = resolveReferenceFile('plan');
  assert.ok(path.isAbsolute(planRef), 'La ruta de referencia plan debe ser absoluta');
  assert.ok(fs.existsSync(planRef), 'El archivo de referencia plan.md debe existir');

  // Cancelado o completado no tienen referencia activa
  assert.equal(resolveReferenceFile('cancelado'), '');
  assert.equal(resolveReferenceFile('completado'), '');

  // Artefactos objetivos
  const dummyDir = '/tmp/dummy-feature';
  assert.equal(resolveTargetFile(dummyDir, 'intake'), path.join(dummyDir, 'idea.md'));
  assert.equal(resolveTargetFile(dummyDir, 'spec'), path.join(dummyDir, 'spec.md'));
  assert.equal(resolveTargetFile(dummyDir, 'plan'), path.join(dummyDir, 'plan.md'));
  assert.equal(resolveTargetFile(dummyDir, 'tasks'), path.join(dummyDir, 'tasks.md'));
  assert.equal(resolveTargetFile(dummyDir, 'apply'), path.join(dummyDir, 'tasks.md'));
  assert.equal(resolveTargetFile(dummyDir, 'verify'), path.join(dummyDir, 'resumen.md'));
});
