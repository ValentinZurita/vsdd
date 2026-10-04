/**
 * VSDD Oracle - Generators
 * Generadores de suites de pruebas de aceptación en múltiples lenguajes
 * (Markdown, TypeScript/JavaScript, Python, Go, Rust, C#).
 */

'use strict';

const path = require('path');
const {
  toIdentifier,
  sanitizeOneLine,
  escapeJsString,
  escapeDoubleQuoteString,
  sanitizePythonDocstring,
} = require('./sanitizers');

/**
 * Formatea el oráculo a formato Markdown universal (Agnóstico total).
 * @param {Array<Object>} requirements
 * @param {Object} meta
 * @returns {string}
 */
function formatUniversalMarkdown(requirements, meta = {}) {
  let md = `# Oráculo de Aceptación Universal (VSDD)\n`;
  if (meta.featureId) {
    md += `Funcionalidad: \`${sanitizeOneLine(meta.featureId)}\`\n`;
  }
  if (meta.source) {
    md += `Origen: \`${sanitizeOneLine(meta.source)}\`\n`;
  }
  md += `\n> Este documento define el contrato de pruebas observable pactado en la especificación.\n`;
  md += `> Es agnóstico al lenguaje y sirve como guía de verificación para TDD, QA o automatización.\n\n`;

  for (const rf of requirements) {
    const titleClean = sanitizeOneLine(rf.title) || 'Requisito';
    md += `## ${rf.id}: ${titleClean}\n\n`;
    if (rf.examples.length === 0) {
      md += `  - [ ] Sin casos de prueba definidos en spec.\n\n`;
      continue;
    }
    for (const ex of rf.examples) {
      const scenario = sanitizeOneLine(ex.scenario);
      const rawDetail = ex.input && ex.expected ? `Entrada: ${ex.input} → Esperado: ${ex.expected}` : ex.raw;
      const detail = sanitizeOneLine(rawDetail);
      md += `- [ ] **${scenario}:** ${detail}\n`;
    }
    md += `\n`;
  }

  return md.trim() + '\n';
}

/**
 * Formatea el oráculo a stubs para TypeScript / JavaScript (Vitest, Jest).
 * @param {Array<Object>} requirements
 * @param {Object} meta
 * @returns {string}
 */
function formatTypeScript(requirements, meta = {}) {
  let code = `// Oráculo de Aceptación VSDD (Vitest / Jest)\n`;
  code += `// Origen: ${meta.source || 'spec.md'}\n\n`;

  for (const rf of requirements) {
    const titleClean = escapeJsString(rf.title);
    code += `describe('${rf.id}: ${titleClean}', () => {\n`;
    for (const ex of rf.examples) {
      const rawDesc = ex.input && ex.expected ? `${ex.input} -> ${ex.expected}` : ex.raw;
      const desc = escapeJsString(rawDesc);
      code += `  it.todo('${desc}');\n`;
    }
    code += `});\n\n`;
  }

  return code.trim() + '\n';
}

/**
 * Formatea el oráculo a stubs para Python (pytest).
 * @param {Array<Object>} requirements
 * @param {Object} meta
 * @returns {string}
 */
function formatPython(requirements, meta = {}) {
  let code = `# Oráculo de Aceptación VSDD (pytest)\n`;
  code += `# Origen: ${meta.source || 'spec.md'}\n`;
  code += `import pytest\n\n`;

  for (const rf of requirements) {
    const classId = toIdentifier(`${rf.id}_${rf.title}`);
    const titleClean = sanitizePythonDocstring(rf.title);
    code += `class Test_${classId}:\n`;
    code += `    """${rf.id}: ${titleClean}"""\n\n`;
    if (rf.examples.length === 0) {
      code += `    def test_sin_casos(self):\n`;
      code += `        pytest.skip("Sin casos definidos en spec")\n\n`;
      continue;
    }
    rf.examples.forEach((ex, idx) => {
      const fnName = toIdentifier(`test_caso_${idx + 1}_${ex.input || ex.scenario}`).slice(0, 50);
      const rawDesc = ex.input && ex.expected ? `Entrada: ${ex.input} -> Esperado: ${ex.expected}` : ex.raw;
      const desc = sanitizePythonDocstring(rawDesc);
      code += `    def ${fnName}(self):\n`;
      code += `        """${desc}"""\n`;
      code += `        pytest.skip("Pendiente de implementacion")\n\n`;
    });
  }

  return code.trim() + '\n';
}

/**
 * Formatea el oráculo a stubs para Go (testing package).
 * @param {Array<Object>} requirements
 * @param {Object} meta
 * @returns {string}
 */
function formatGo(requirements, meta = {}) {
  let code = `// Oráculo de Aceptación VSDD (Go testing)\n`;
  code += `// Origen: ${meta.source || 'spec.md'}\n`;
  code += `package acceptance_test\n\n`;
  code += `import "testing"\n\n`;

  const totalExamples = requirements.reduce((acc, rf) => acc + (rf.examples ? rf.examples.length : 0), 0);
  if (totalExamples === 0) {
    code += `func TestOracle_NoCases(t *testing.T) {\n\tt.Skip("Sin casos definidos en spec")\n}\n`;
    return code.trim() + '\n';
  }

  for (const rf of requirements) {
    const rfClean = toIdentifier(rf.id);
    rf.examples.forEach((ex, idx) => {
      const fnName = `Test_${rfClean}_Case${idx + 1}`;
      const rawDesc = ex.input && ex.expected ? `Entrada: ${ex.input} -> Esperado: ${ex.expected}` : ex.raw;
      const desc = escapeDoubleQuoteString(rawDesc);
      code += `// ${rf.id}: ${desc}\n`;
      code += `func ${fnName}(t *testing.T) {\n`;
      code += `\tt.Skip("Pendiente de implementacion")\n`;
      code += `}\n\n`;
    });
  }

  return code.trim() + '\n';
}

/**
 * Formatea el oráculo a stubs para Rust (cargo test).
 * @param {Array<Object>} requirements
 * @param {Object} meta
 * @returns {string}
 */
function formatRust(requirements, meta = {}) {
  let code = `// Oráculo de Aceptación VSDD (Rust)\n`;
  code += `// Origen: ${meta.source || 'spec.md'}\n\n`;
  code += `#[cfg(test)]\nmod acceptance_oracle {\n`;

  for (const rf of requirements) {
    const modName = toIdentifier(rf.id).toLowerCase();
    code += `    mod ${modName} {\n`;
    rf.examples.forEach((ex, idx) => {
      const fnName = `test_case_${idx + 1}`;
      const rawDesc = ex.input && ex.expected ? `Entrada: ${ex.input} -> Esperado: ${ex.expected}` : ex.raw;
      const desc = sanitizeOneLine(rawDesc);
      code += `        // ${desc}\n`;
      code += `        #[test]\n`;
      code += `        #[ignore = "Pendiente de implementacion"]\n`;
      code += `        fn ${fnName}() {}\n\n`;
    });
    code += `    }\n`;
  }
  code += `}\n`;

  return code.trim() + '\n';
}

/**
 * Formatea el oráculo a stubs para C# (xUnit / NUnit).
 * @param {Array<Object>} requirements
 * @param {Object} meta
 * @returns {string}
 */
function formatCSharp(requirements, meta = {}) {
  let code = `// Oráculo de Aceptación VSDD (C# xUnit)\n`;
  code += `// Origen: ${meta.source || 'spec.md'}\n`;
  code += `using Xunit;\n\n`;
  code += `namespace AcceptanceOracle\n{\n`;

  for (const rf of requirements) {
    const className = `${toIdentifier(rf.id)}Tests`;
    code += `    public class ${className}\n    {\n`;
    rf.examples.forEach((ex, idx) => {
      const fnName = `Case_${idx + 1}`;
      const rawDesc = ex.input && ex.expected ? `${ex.input} -> ${ex.expected}` : ex.raw;
      const desc = escapeDoubleQuoteString(rawDesc);
      code += `        [Fact(Skip = "Pendiente de implementacion: ${desc}")]\n`;
      code += `        public void ${fnName}() { }\n\n`;
    });
    code += `    }\n`;
  }
  code += `}\n`;

  return code.trim() + '\n';
}

/**
 * Detecta el generador apropiado según la extensión del archivo destino.
 * @param {Array<Object>} requirements
 * @param {string} targetPath
 * @param {Object} meta
 * @returns {string}
 */
function formatOracle(requirements, targetPath = '', meta = {}) {
  if (!targetPath) {
    return formatUniversalMarkdown(requirements, meta);
  }

  const ext = path.extname(targetPath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
      return formatTypeScript(requirements, meta);
    case '.py':
      return formatPython(requirements, meta);
    case '.go':
      return formatGo(requirements, meta);
    case '.rs':
      return formatRust(requirements, meta);
    case '.cs':
      return formatCSharp(requirements, meta);
    case '.md':
    case '.txt':
    default:
      return formatUniversalMarkdown(requirements, meta);
  }
}

module.exports = {
  formatUniversalMarkdown,
  formatTypeScript,
  formatPython,
  formatGo,
  formatRust,
  formatCSharp,
  formatOracle,
};
