const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const installer = require('../scripts/install-skill.js');

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-install-test-'));
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

test('calculates documented project and global targets and deduplicates shared destinations', () => {
  const project = tmpProject();
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

test('project-scope installation rejects a missing project root before planning', () => {
  const project = tmpProject();
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

test('dry-run plans without writing destinations', () => {
  const project = tmpProject();
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

test('copies canonical skill tree when apply is explicit', () => {
  const project = tmpProject();
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

test('identical destination is reported unchanged and is idempotent', () => {
  const project = tmpProject();
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

test('conflicting destination is refused when update=false', () => {
  const project = tmpProject();
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

test('update=true overwrites conflicting destination and cleans obsolete files', () => {
  const project = tmpProject();
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
