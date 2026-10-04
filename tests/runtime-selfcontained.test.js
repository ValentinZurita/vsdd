const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { walkSource } = require('../scripts/install-skill');

const repoRoot = path.resolve(__dirname, '..');
const shipped = walkSource(repoRoot).filter((e) => e.type === 'file').map((e) => e.relative);

test('runtime: solo SKILL.md y references/ viajan a los proyectos', () => {
  assert.ok(shipped.includes('SKILL.md'));
  for (const rel of shipped) {
    assert.ok(rel === 'SKILL.md' || rel.startsWith(`references${path.sep}`), `No debe instalarse: ${rel}`);
  }
});

test('runtime: ningún archivo instalado depende de la Constitución del repo', () => {
  for (const rel of shipped) {
    const txt = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    assert.doesNotMatch(txt, /docs\/CONSTITUTION\.md/, `${rel} apunta a docs/CONSTITUTION.md`);
    assert.doesNotMatch(txt, /contra la Constituci[oó]n/i, `${rel} usa la Constitución como rúbrica`);
  }
  const skill = fs.readFileSync(path.join(repoRoot, 'SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /CONSTITUTION\.md/, 'SKILL.md no debe citar un archivo que no se instala');
  assert.doesNotMatch(skill, /\(Art\.\s?\d/, 'SKILL.md no debe citar artículos que no se instalan');
});
