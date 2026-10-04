const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

test('packaging: npm pack --dry-run emite distribución limpia sin archivos de test o docs', () => {
  const stdout = execSync('npm pack --dry-run --json', {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const jsonStart = stdout.indexOf('[');
  assert.ok(jsonStart !== -1, 'npm pack debe emitir un array JSON');

  const parsed = JSON.parse(stdout.slice(jsonStart));
  assert.ok(Array.isArray(parsed) && parsed.length > 0, 'resultado de npm pack debe tener al menos un paquete');

  const files = parsed[0].files.map((f) => f.path.replace(/\\/g, '/'));

  // 1. Archivos obligatorios incluidos
  assert.ok(files.includes('package.json'), 'package.json debe estar incluido');
  assert.ok(files.includes('SKILL.md'), 'SKILL.md debe estar incluido');
  assert.ok(files.includes('README.md'), 'README.md debe estar incluido');
  assert.ok(files.includes('LICENSE'), 'LICENSE debe estar incluido');
  assert.ok(files.some((f) => f.startsWith('scripts/cli.js')), 'scripts/cli.js debe estar incluido');
  assert.ok(files.some((f) => f.startsWith('references/')), 'references/ debe estar incluido');

  // 2. Archivos prohibidos (deben estar excluidos)
  const forbiddenPrefixes = ['tests/', '.github/', '.atl/', 'docs/'];
  for (const file of files) {
    for (const prefix of forbiddenPrefixes) {
      assert.equal(
        file.startsWith(prefix),
        false,
        `El archivo ${file} no debería formar parte del paquete distribuible de npm`
      );
    }
  }
});
