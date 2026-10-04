const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { parseCliCommand, getVersion } = require('../scripts/cli');

const repoRoot = path.resolve(__dirname, '..');
const scriptsDir = path.join(repoRoot, 'scripts');

test('cli: getVersion lee la versión correcta de package.json', () => {
  const version = getVersion(scriptsDir);
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(version, pkg.version);
});

test('cli: parseCliCommand sin argumentos delega a vsdd-status.js', () => {
  const parsed = parseCliCommand([], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'vsdd-status.js'));
  assert.deepEqual(parsed.args, []);
});

test('cli: parseCliCommand con banderas directas (--json, --catalog) delega a vsdd-status.js', () => {
  const parsedJson = parseCliCommand(['--json'], scriptsDir);
  assert.equal(parsedJson.script, path.join(scriptsDir, 'vsdd-status.js'));
  assert.deepEqual(parsedJson.args, ['--json']);

  const parsedCatalog = parseCliCommand(['--catalog'], scriptsDir);
  assert.equal(parsedCatalog.script, path.join(scriptsDir, 'vsdd-status.js'));
  assert.deepEqual(parsedCatalog.args, ['--catalog']);
});

test('cli: parseCliCommand validate rutea a vsdd-validate.js con argumentos limpios', () => {
  const parsed = parseCliCommand(['validate', 'docs/sdd/vsdd/001-test/spec.md', '--json'], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'vsdd-validate.js'));
  assert.deepEqual(parsed.args, ['docs/sdd/vsdd/001-test/spec.md', '--json']);
});

test('cli: parseCliCommand status rutea a vsdd-status.js', () => {
  const parsed = parseCliCommand(['status', '--json'], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'vsdd-status.js'));
  assert.deepEqual(parsed.args, ['--json']);
});

test('cli: parseCliCommand abort rutea a vsdd-status.js con flag --abort inyectada', () => {
  const parsed = parseCliCommand(['abort', '001-mi-feature', '--delete-branch'], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'vsdd-status.js'));
  assert.deepEqual(parsed.args, ['--abort', '001-mi-feature', '--delete-branch']);
});

test('cli: parseCliCommand update rutea a vsdd-status.js con update', () => {
  const parsed = parseCliCommand(['update', '--json'], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'vsdd-status.js'));
  assert.deepEqual(parsed.args, ['update', '--json']);
});

test('cli: parseCliCommand install rutea a install-skill.js', () => {
  const parsed = parseCliCommand(['install', '--scope', 'project', '--hosts', 'cursor'], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'install-skill.js'));
  assert.deepEqual(parsed.args, ['--scope', 'project', '--hosts', 'cursor']);
});

test('cli: parseCliCommand sonar rutea a vsdd-sonar.js con argumentos', () => {
  const parsed = parseCliCommand(['sonar', '--focus', 'scripts/cli.js', '--json'], scriptsDir);
  assert.equal(parsed.script, path.join(scriptsDir, 'vsdd-sonar.js'));
  assert.deepEqual(parsed.args, ['--focus', 'scripts/cli.js', '--json']);
});

test('cli: parseCliCommand reconoce banderas de versión y ayuda', () => {
  const parsedV = parseCliCommand(['-v'], scriptsDir);
  assert.equal(parsedV.action, 'version');

  const parsedHelp = parseCliCommand(['--help'], scriptsDir);
  assert.equal(parsedHelp.action, 'help');

  const parsedHelpWord = parseCliCommand(['help'], scriptsDir);
  assert.equal(parsedHelpWord.action, 'help');
});

test('cli: parseCliCommand detecta comando desconocido', () => {
  const parsed = parseCliCommand(['inventado'], scriptsDir);
  assert.equal(parsed.action, 'unknown');
  assert.equal(parsed.command, 'inventado');
});

// -----------------------------------------------------------------------------
// Pruebas de Integración de Ejecución CLI
// -----------------------------------------------------------------------------

test('cli integración: ejecución de vsdd -v y --version emite versión válida', () => {
  const stdout = execSync(`node ${path.join(scriptsDir, 'cli.js')} -v`, { encoding: 'utf8', cwd: repoRoot });
  assert.match(stdout, /⚡ VSDD v\d+\.\d+/);

  const jsonOut = execSync(`node ${path.join(scriptsDir, 'cli.js')} --version --json`, { encoding: 'utf8', cwd: repoRoot });
  const parsed = JSON.parse(jsonOut);
  assert.ok(parsed.version);
});

test('cli integración: ejecución de vsdd --help emite banner de ayuda', () => {
  const stdout = execSync(`node ${path.join(scriptsDir, 'cli.js')} --help`, { encoding: 'utf8', cwd: repoRoot });
  assert.match(stdout, /⚡ VSDD/);
  assert.match(stdout, /vsdd validate/);
  assert.match(stdout, /vsdd status/);
});

test('cli integración: subcomando desconocido sale con código 1', () => {
  assert.throws(() => {
    execSync(`node ${path.join(scriptsDir, 'cli.js')} comando-inexistente`, { stdio: 'pipe', cwd: repoRoot });
  }, /Command failed/);
});

test('cli integración: vsdd validate propaga código 1 ante archivo con errores', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-cli-val-'));
  try {
    const invalidFile = path.join(tmpDir, 'idea.md');
    fs.writeFileSync(invalidFile, '# Idea sin secciones válidas\n');

    assert.throws(() => {
      execSync(`node ${path.join(scriptsDir, 'cli.js')} validate "${invalidFile}" --json`, {
        stdio: 'pipe',
        cwd: repoRoot,
      });
    }, (error) => {
      assert.equal(error.status, 1);
      return true;
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('cli integración: vsdd sonar --json emite mapa de exploración válido', () => {
  const stdout = execSync(`node ${path.join(scriptsDir, 'cli.js')} sonar --json`, {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  const parsed = JSON.parse(stdout);
  assert.ok(parsed.tree);
  assert.ok(parsed.extensions);
  assert.ok(parsed.tests);
  assert.equal(typeof parsed.files, 'number');
});
