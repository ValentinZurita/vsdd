const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const constitutionPath = path.join(repoRoot, 'docs', 'CONSTITUTION.md');

test('constitution: docs/CONSTITUTION.md existe y es legible', () => {
  assert.ok(fs.existsSync(constitutionPath), 'docs/CONSTITUTION.md debe existir');
  const content = fs.readFileSync(constitutionPath, 'utf8');
  assert.ok(content.length > 500, 'CONSTITUTION.md no debe estar vacío');
});

test('constitution: consagra los 10 principios fundamentales del manifiesto', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  
  // Verificación estructural de los 10 principios numerados
  assert.match(content, /^1\.\s+\*\*Soberanía del Usuario:\*\*/m);
  assert.match(content, /^2\.\s+\*\*Anti-Sobreingeniería Radical \(YAGNI\):\*\*/m);
  assert.match(content, /^3\.\s+\*\*Guiar antes que Prohibir:\*\*/m);
  assert.match(content, /^4\.\s+\*\*Agnosticismo Tecnológico Absoluto:\*\*/m);
  assert.match(content, /^5\.\s+\*\*La Ciencia del "Qué NO Hacer":\*\*/m);
  assert.match(content, /^6\.\s+\*\*Slicing Vertical:\*\*/m);
  assert.match(content, /^7\.\s+\*\*Tests Robustos y Útiles \(DFT\):\*\*/m);
  assert.match(content, /^8\.\s+\*\*Memoria con Evidencia:\*\*/m);
  assert.match(content, /^9\.\s+\*\*Separación de Planos:\*\*/m);
  assert.match(content, /^10\.\s+\*\*Higiene de Atención:\*\*/m);
});

test('constitution: Principios 9 y 10 formalizan la Separación de Planos e Higiene de Contexto', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  
  // Principio 9: Compute where it computes, Reason where it reasons
  assert.match(
    content,
    /Compute where it computes, Reason where it reasons/i,
    'El Principio 9 debe incluir el principio de Compute where it computes, Reason where it reasons'
  );
  assert.match(
    content,
    /Plano de Cómputo Determinista/i,
    'Debe definir el Plano de Cómputo Determinista'
  );
  assert.match(
    content,
    /Plano Agéntico/i,
    'Debe definir el Plano Agéntico'
  );

  // Principio 10: Progressive disclosure y memoria de trabajo
  assert.match(
    content,
    /No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual/i,
    'El Principio 10 debe incluir el mandato de no cargar en memoria de trabajo nada ajeno al turno actual'
  );
  assert.match(
    content,
    /Carga Just-In-Time \(JIT\)/i,
    'Debe exigir Carga Just-In-Time (JIT)'
  );
  assert.match(
    content,
    /Subagentes Efímeros/i,
    'Debe exigir aislamiento mediante Subagentes Efímeros'
  );
});

test('constitution: Principio 8 formaliza la memoria verificable con ancla física', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  assert.match(
    content,
    /ancla física verificable/i,
    'El Principio 8 debe exigir ancla física verificable para los aprendizajes técnicos'
  );
});
