const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanFeatures, formatHubMenu } = require('../scripts/vsdd-status');

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
