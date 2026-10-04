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

test('constitution: consagra los 11 principios fundamentales del manifiesto', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  
  // Verificación estructural de los 11 principios numerados
  assert.match(content, /^1\.\s+\*\*Soberanía del Usuario:\*\*/m);
  assert.match(content, /^2\.\s+\*\*Proporción antes que Ceremonia \(YAGNI\):\*\*/m);
  assert.match(content, /^3\.\s+\*\*Guiar antes que Prohibir:\*\*/m);
  assert.match(content, /^4\.\s+\*\*Pensar también es Trabajo:\*\*/m);
  assert.match(content, /^5\.\s+\*\*Agnosticismo Tecnológico:\*\*/m);
  assert.match(content, /^6\.\s+\*\*Definir qué NO Hacer:\*\*/m);
  assert.match(content, /^7\.\s+\*\*Slicing Vertical:\*\*/m);
  assert.match(content, /^8\.\s+\*\*Tests que Sirvan \(DFT\):\*\*/m);
  assert.match(content, /^9\.\s+\*\*Memoria con Evidencia:\*\*/m);
  assert.match(content, /^10\.\s+\*\*Separación de Planos:\*\*/m);
  assert.match(content, /^11\.\s+\*\*Higiene de Atención:\*\*/m);
});

test('constitution: Principios 10 y 11 formalizan la Separación de Planos e Higiene de Contexto', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  
  // Principio 10: Compute where it computes, Reason where it reasons
  assert.match(
    content,
    /Compute where it computes, Reason where it reasons/i,
    'El Principio 10 debe incluir el principio de Compute where it computes, Reason where it reasons'
  );
  assert.match(
    content,
    /determinista/i,
    'Debe definir el cómputo determinista'
  );

  // Principio 11: Progressive disclosure y memoria de trabajo
  assert.match(
    content,
    /No cargues en la memoria de trabajo nada que no vaya a usarse en el turno actual/i,
    'El Principio 11 debe incluir el mandato de no cargar en memoria de trabajo nada ajeno al turno actual'
  );
  assert.match(
    content,
    /Carga Just-In-Time/i,
    'Debe exigir Carga Just-In-Time'
  );
});

test('constitution: Principio 9 formaliza la memoria con ancla verificable', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  assert.match(
    content,
    /ancla verificable/i,
    'El Principio 9 debe exigir ancla verificable para los aprendizajes técnicos'
  );
});
