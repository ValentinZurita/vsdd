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

test('constitution: contiene los 7 artículos fundamentales estructurados', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  
  // Verificación estructural de encabezados H2 de artículos
  assert.match(content, /^## 1\. Soberanía del Usuario y Anti-Sobreingeniería/m);
  assert.match(content, /^## 2\. Agnosticismo Tecnológico Absoluto/m);
  assert.match(content, /^## 3\. La Ciencia del "QUÉ NO HACER"/m);
  assert.match(content, /^## 4\. Elicitación Adaptativa por Tiers/m);
  assert.match(content, /^## 5\. Rúbrica de los 5 Lentes del Conductor/m);
  assert.match(content, /^## 6\. Diseño para Testabilidad \(DFT\) y Oráculo Independiente/m);
  assert.match(content, /^## 7\. Arquitectura de Doble Plano e Higiene de Memoria de Trabajo/m);
});

test('constitution: Artículo 7 formaliza la Separación de Planos e Higiene de Contexto', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  
  // Cláusula 1: Compute where it computes, Reason where it reasons
  assert.match(
    content,
    /Compute where it computes, Reason where it reasons/i,
    'El Artículo 7 debe incluir el principio de Compute where it computes, Reason where it reasons'
  );
  assert.match(
    content,
    /Plano de Cómputo Determinista/i,
    'Debe definir el Plano de Cómputo Determinista (0 tokens)'
  );
  assert.match(
    content,
    /Plano Agéntico/i,
    'Debe definir el Plano Agéntico (LLM / Conductor)'
  );

  // Cláusula 2: Progressive disclosure y memoria de trabajo
  assert.match(
    content,
    /No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual/i,
    'El Artículo 7 debe incluir el mandato de no cargar en memoria de trabajo nada ajeno al turno actual'
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

test('constitution: Artículo 6.4 formaliza la memoria verificable con ancla física', () => {
  const content = fs.readFileSync(constitutionPath, 'utf8');
  assert.match(
    content,
    /ancla física verificable/i,
    'El Artículo 6.4 debe exigir ancla física verificable para los aprendizajes transversales'
  );
});
