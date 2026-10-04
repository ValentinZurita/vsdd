const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getCanonicalVersion, compareSemver } = require('../scripts/lib/version');

const repoRoot = path.resolve(__dirname, '..');

test('version-sync: package.json define la versión canónica 0.44.0', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '0.44.0');
  assert.equal(getCanonicalVersion(), '0.44.0');
});

test('version-sync: SKILL.md está sincronizado con package.json', () => {
  const skill = fs.readFileSync(path.join(repoRoot, 'SKILL.md'), 'utf8');
  const match = skill.match(/version:\s*['"]?([0-9.]+)['"]?/);
  assert.ok(match, 'SKILL.md debe declarar metadata.version');
  assert.equal(match[1], getCanonicalVersion());
});

test('version-sync: install.sh declara la versión canónica exacta', () => {
  const installSh = fs.readFileSync(path.join(repoRoot, 'install.sh'), 'utf8');
  const match = installSh.match(/VSDD_VERSION=["']([0-9.]+)["']/);
  assert.ok(match, 'install.sh debe definir VSDD_VERSION');
  assert.equal(match[1], getCanonicalVersion());
});

test('version-sync: install.ps1 declara la versión canónica exacta', () => {
  const installPs1 = fs.readFileSync(path.join(repoRoot, 'install.ps1'), 'utf8');
  const match = installPs1.match(/\$VSDD_VERSION\s*=\s*["']([0-9.]+)["']/);
  assert.ok(match, 'install.ps1 debe definir $VSDD_VERSION');
  assert.equal(match[1], getCanonicalVersion());
});

test('version-sync: README.md contiene el badge de versión canónica', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const expectedBadge = `version-${getCanonicalVersion()}-blue.svg`;
  assert.ok(readme.includes(expectedBadge), `README.md debe contener el badge ${expectedBadge}`);
});

test('version-sync: compareSemver maneja prefijos v y longitudes mixtas', () => {
  assert.equal(compareSemver('0.44.0', '0.44.0'), 0);
  assert.equal(compareSemver('v0.44.0', '0.44.0'), 0);
  assert.equal(compareSemver('0.44.0', '0.45.0'), 1);
  assert.equal(compareSemver('0.45.0', '0.44.0'), -1);
  assert.equal(compareSemver('0.44', '0.44.0'), 0);
});

test('version-sync: scripts/cli.js reporta la versión canónica', () => {
  const out = execSync(`node "${path.join(repoRoot, 'scripts', 'cli.js')}" --version --json`, {
    encoding: 'utf8',
  });
  const parsed = JSON.parse(out);
  assert.equal(parsed.version, getCanonicalVersion());
});

test('version-sync: scripts/sync-version.js --check valida sincronización con código 0', () => {
  const syncScript = path.join(repoRoot, 'scripts', 'sync-version.js');
  const out = execSync(`node "${syncScript}" --check`, { encoding: 'utf8' });
  assert.ok(out.includes('Todos los archivos están perfectamente sincronizados'));
});

test('install.ps1: sintaxis de llaves balanceadas y funciones a nivel raíz', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'install.ps1'), 'utf8');
  let depth = 0;
  for (const ch of content) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    assert.ok(depth >= 0, 'Llave de cierre huérfana en install.ps1');
  }
  assert.equal(depth, 0, 'install.ps1 debe tener llaves perfectamente balanceadas');

  assert.match(content, /function\s+Show-Banner/);
  assert.match(content, /function\s+Run-Uninstall/);
  assert.match(content, /function\s+Prompt-Choice/);
  assert.match(content, /function\s+Resolve-SourceDirectory/);
  assert.match(content, /function\s+Invoke-Main/);
});

test('version-sync: scripts/sync-version.js checkVersion reporta discrepancias correctamente', (t) => {
  const os = require('node:os');
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-sync-fail-'));
  if (t && typeof t.after === 'function') {
    t.after(() => fs.rmSync(tmpRepo, { recursive: true, force: true }));
  }

  fs.writeFileSync(path.join(tmpRepo, 'package.json'), JSON.stringify({ version: '0.44.0' }));
  fs.writeFileSync(path.join(tmpRepo, 'SKILL.md'), 'version: "0.0.1"');

  const { checkVersion } = require('../scripts/sync-version');
  const res = checkVersion(tmpRepo);
  assert.equal(res.inSync, false);
  assert.ok(res.outOfSyncFiles.includes('SKILL.md'));
});


