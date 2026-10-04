const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const skillPath = path.join(repoRoot, 'SKILL.md');
const referencesDir = path.join(repoRoot, 'references');

test('slender-skill: SKILL.md existe y cumple con el Guardián de Peso (<= 4.5 KB)', () => {
  assert.ok(fs.existsSync(skillPath), 'SKILL.md debe existir');
  const stat = fs.statSync(skillPath);
  assert.ok(
    stat.size <= 4500,
    `SKILL.md pesa ${stat.size} bytes. Debe mantenerse esbelto (<= 4500 bytes) para evitar Attention Dilution`
  );
  assert.ok(stat.size > 500, 'SKILL.md no debe ser un cascarón vacío');
});

test('slender-skill: SKILL.md contiene el ciclo de ejecución de 4 pasos (The 4-Step Conductor Loop)', () => {
  const content = fs.readFileSync(skillPath, 'utf8');

  // Paso 1: Descubrimiento de estado vía CLI
  assert.match(content, /vsdd status --json/i, 'Debe incluir vsdd status --json para descubrir estado');
  assert.match(content, /referenceFile/i, 'Debe usar la propiedad referenceFile provista por el CLI');

  // Paso 2: Carga JIT
  assert.match(content, /Just-In-Time|JIT/i, 'Debe ordenar la carga JIT de la referencia de fase');

  // Paso 3: Conducción
  assert.match(content, /tiers/i, 'Debe incluir la conducción por Tiers');

  // Paso 4: Compuerta determinista
  assert.match(content, /vsdd validate/i, 'Debe validar con vsdd validate en 0 tokens');
  assert.match(content, /vsdd sonar/i, 'Debe incluir vsdd sonar en los comandos del conductor');
});

test('slender-skill: SKILL.md formaliza los Principios 9 y 10 y la seguridad de ramas', () => {
  const content = fs.readFileSync(skillPath, 'utf8');

  // Principios 9 y 10 (Separación de Planos e Higiene de Contexto)
  assert.match(content, /Compute where it computes, Reason where it reasons/i);
  assert.match(content, /No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual/i);

  // Seguridad Git
  assert.match(content, /--delete-branch/i, 'Debe advertir explícitamente sobre el peligro de --delete-branch');
});

test('slender-skill: Todas las referencias canónicas de fases existen en references/', () => {
  const requiredPhases = ['intake', 'spec', 'plan', 'tasks', 'apply', 'verify'];
  for (const phase of requiredPhases) {
    const file = path.join(referencesDir, `${phase}.md`);
    assert.ok(fs.existsSync(file), `references/${phase}.md debe existir físicamente`);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.length > 100, `references/${phase}.md no debe estar vacío`);
  }
});
