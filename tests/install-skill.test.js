const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const installer = require('../scripts/install-skill.js');

// -----------------------------------------------------------------------------
// Utilidades de Prueba con Limpieza Automática
// -----------------------------------------------------------------------------
function tmpProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-install-test-'));
  if (t && typeof t.after === 'function') {
    t.after(() => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (_) {
        // Limpieza de mejor esfuerzo
      }
    });
  }
  return dir;
}

function writeSkill(root, files = { 'SKILL.md': '---\nname: vsdd\n---\n# VSDD\n', 'references/guide.md': 'guide\n' }) {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

function exists(file) {
  return fs.existsSync(file);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

// -----------------------------------------------------------------------------
// Pruebas de Planificación y Destinos
// -----------------------------------------------------------------------------
test('calculates documented project and global targets and deduplicates shared destinations', (t) => {
  const project = tmpProject(t);
  const home = path.join(project, 'home');

  const sharedProject = installer.calculateTargets({
    hosts: ['codex', 'cursor', 'antigravity'],
    scope: 'project',
    projectRoot: project,
    homeDir: home,
  });
  assert.deepEqual(sharedProject.map((target) => target.destination), [
    path.join(project, '.agents', 'skills', 'vsdd'),
  ]);
  assert.deepEqual(sharedProject[0].hosts, ['codex', 'cursor', 'antigravity']);

  const allGlobal = installer.calculateTargets({
    hosts: ['all'],
    scope: 'global',
    projectRoot: project,
    homeDir: home,
  });
  assert.deepEqual(allGlobal.map((target) => target.destination), [
    path.join(home, '.claude', 'skills', 'vsdd'),
    path.join(home, '.agents', 'skills', 'vsdd'),
    path.join(home, '.gemini', 'config', 'skills', 'vsdd'),
  ]);
  assert.deepEqual(allGlobal[1].hosts, ['codex', 'cursor']);
});

test('project-scope installation rejects a missing project root before planning', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project);
  const missingProject = path.join(project, 'missing-project');

  assert.throws(() => installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: missingProject,
    sourceDir: source,
    apply: false,
  }), /Project root must already exist as a directory/);
});

test('dry-run plans without writing destinations', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project);

  const result = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: false,
  });

  assert.equal(result.applied, false);
  assert.equal(result.operations[0].status, 'would-create');
  assert.equal(exists(path.join(project, '.claude', 'skills', 'vsdd')), false);
});

// -----------------------------------------------------------------------------
// Pruebas de Ejecución y Consistencia
// -----------------------------------------------------------------------------
test('copies canonical skill tree when apply is explicit', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project);
  const destination = path.join(project, '.claude', 'skills', 'vsdd');

  const result = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: true,
  });

  assert.equal(result.operations[0].status, 'created');
  assert.equal(read(path.join(destination, 'SKILL.md')), read(path.join(source, 'SKILL.md')));
  assert.equal(read(path.join(destination, 'references', 'guide.md')), 'guide\n');
});

test('identical destination is reported unchanged and is idempotent', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project);

  installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: true,
  });
  const second = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: true,
  });

  assert.equal(second.operations[0].status, 'unchanged');
});

test('conflicting destination is refused when update=false', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project);
  const conflict = path.join(project, '.claude', 'skills', 'vsdd');
  fs.mkdirSync(conflict, { recursive: true });
  fs.writeFileSync(path.join(conflict, 'SKILL.md'), 'different\n');

  assert.throws(() => installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: true,
    update: false,
  }), /Conflicting destination refuses overwrite.*Use --update/);
});

test('update=true overwrites conflicting destination and cleans obsolete files', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project, {
    'SKILL.md': '---\nname: vsdd\n---\n# VSDD v2\n',
    'references/new.md': 'new\n',
  });
  const destination = path.join(project, '.claude', 'skills', 'vsdd');
  fs.mkdirSync(path.join(destination, 'references'), { recursive: true });
  fs.writeFileSync(path.join(destination, 'SKILL.md'), 'old\n');
  fs.writeFileSync(path.join(destination, 'references', 'obsolete.md'), 'obsolete\n');

  const result = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: true,
    update: true,
  });

  assert.equal(result.operations[0].status, 'updated');
  assert.equal(read(path.join(destination, 'SKILL.md')), '---\nname: vsdd\n---\n# VSDD v2\n');
  assert.equal(read(path.join(destination, 'references', 'new.md')), 'new\n');
  assert.equal(exists(path.join(destination, 'references', 'obsolete.md')), false);
});

// -----------------------------------------------------------------------------
// Nuevas Pruebas de Calidad Arquitectónica
// -----------------------------------------------------------------------------
test('auto-resolves repo root source and filters development files (.git, package.json, scripts, tests)', (t) => {
  const project = tmpProject(t);

  // Simular un repositorio completo con archivos de desarrollo
  writeSkill(project, {
    'SKILL.md': '---\nname: vsdd\n---\n# VSDD Real\n',
    'references/phase.md': 'phase content\n',
    'package.json': '{"name": "vsdd"}\n',
    'scripts/install-skill.js': 'console.log("script");\n',
    'tests/install-skill.test.js': 'console.log("test");\n',
    '.git/HEAD': 'ref: refs/heads/main\n',
  });

  const destination = path.join(project, '.claude', 'skills', 'vsdd');

  // Sin pasar sourceDir: debe autodetectar la raíz del proyecto
  const result = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    apply: true,
  });

  assert.equal(result.operations[0].status, 'created');
  
  // Archivos de la skill deben existir
  assert.equal(exists(path.join(destination, 'SKILL.md')), true);
  assert.equal(exists(path.join(destination, 'references', 'phase.md')), true);
  assert.equal(read(path.join(destination, 'SKILL.md')), '---\nname: vsdd\n---\n# VSDD Real\n');

  // Archivos de desarrollo NUNCA deben copiarse a la skill instalada
  assert.equal(exists(path.join(destination, 'package.json')), false, 'package.json no debe copiarse');
  assert.equal(exists(path.join(destination, 'scripts')), false, 'scripts no debe copiarse');
  assert.equal(exists(path.join(destination, 'tests')), false, 'tests no debe copiarse');
  assert.equal(exists(path.join(destination, '.git')), false, '.git no debe copiarse');
});

test('rolls back newly created destination directories on copy failure', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project, {
    'SKILL.md': '---\nname: vsdd\n---\n# VSDD\n',
    'references/guide.md': 'guide\n',
  });
  const destination = path.join(project, '.claude', 'skills', 'vsdd');
  const originalCopyFileSync = fs.copyFileSync;
  let copied = 0;

  // Simular falla en la segunda copia de archivo
  fs.copyFileSync = (...args) => {
    copied += 1;
    if (copied === 2) {
      throw new Error('simulated disk copy failure');
    }
    return originalCopyFileSync(...args);
  };

  try {
    assert.throws(() => installer.installSkill({
      scope: 'project',
      hosts: ['claude-code'],
      projectRoot: project,
      sourceDir: source,
      apply: true,
    }), /simulated disk copy failure/);
  } finally {
    fs.copyFileSync = originalCopyFileSync;
  }

  // Comprobar que el rollback borró los archivos y carpetas creadas
  assert.equal(exists(destination), false, 'directorio de destino debe haber sido revertido');
  assert.equal(exists(path.join(project, '.claude', 'skills')), false, 'árbol de skills debe haber sido revertido');
});

test('parses command line arguments correctly and rejects invalid flags', () => {
  const parsed = installer.parseArgs([
    '--scope', 'global',
    '--hosts', 'claude-code,cursor',
    '--apply',
    '--update',
    '--project', '/tmp/custom-path',
  ]);

  assert.equal(parsed.scope, 'global');
  assert.deepEqual(parsed.hosts, ['claude-code', 'cursor']);
  assert.equal(parsed.apply, true);
  assert.equal(parsed.update, true);
  assert.equal(parsed.projectRoot, '/tmp/custom-path');

  // Argumento desconocido debe arrojar error descriptivo
  assert.throws(() => installer.parseArgs(['--invalid-flag']), /Unknown argument: --invalid-flag/);

  // Bandera de ayuda
  const helpParsed = installer.parseArgs(['-h']);
  assert.equal(helpParsed.help, true);

  // Bandera de desinstalación
  const uninstallParsed = installer.parseArgs(['--uninstall', '--scope', 'global', '--hosts', 'all']);
  assert.equal(uninstallParsed.uninstall, true);
});

test('uninstalls skill destinations when apply is true', (t) => {
  const project = tmpProject(t);
  const source = writeSkill(project);
  const destination = path.join(project, '.claude', 'skills', 'vsdd');

  // Primero instalar
  installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    sourceDir: source,
    apply: true,
  });
  assert.equal(exists(destination), true);

  // Dry run de desinstalación
  const dryRun = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    uninstall: true,
    apply: false,
  });
  assert.equal(dryRun.uninstalled, true);
  assert.equal(dryRun.operations[0].status, 'would-remove');
  assert.equal(exists(destination), true);

  // Desinstalación con apply
  const applied = installer.installSkill({
    scope: 'project',
    hosts: ['claude-code'],
    projectRoot: project,
    uninstall: true,
    apply: true,
  });
  assert.equal(applied.uninstalled, true);
  assert.equal(applied.operations[0].status, 'removed');
  assert.equal(exists(destination), false);
});

