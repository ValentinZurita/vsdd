#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Sanitiza un string para usar como identificador en nombres de tests o funciones.
 */
function toIdentifier(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'caso';
}

/**
 * Sanitiza un string reemplazando saltos de línea por espacios en blanco y recortando extremos.
 */
function sanitizeOneLine(str) {
  return (str || '').replace(/\r?\n/g, ' ').trim();
}

/**
 * Escapa strings para literales en comillas simples (TypeScript / JavaScript).
 */
function escapeJsString(str) {
  return sanitizeOneLine(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

/**
 * Escapa strings para literales en comillas dobles (C# / Go).
 */
function escapeDoubleQuoteString(str) {
  return sanitizeOneLine(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

/**
 * Sanitiza contenido para docstrings en Python evitando que comillas triples o barras
 * invertidas finales provoquen SyntaxError.
 */
function sanitizePythonDocstring(str) {
  let cleaned = (str || '').replace(/\r?\n/g, ' ').replace(/"/g, '\\"');
  const match = cleaned.match(/\\+$/);
  if (match && match[0].length % 2 !== 0) {
    cleaned += '\\';
  }
  return cleaned;
}

/**
 * Limpia prefijos comunes de salida en criterios y ejemplos de Example Mapping.
 */
function cleanExpected(str) {
  return (str || '')
    .trim()
    .replace(/^[*_]*(?:resultado(?:\s+(?:observable|esperado))?|salida(?:\s+esperada)?):?[*_]*\s*/i, '')
    .trim();
}

/**
 * Limpia prefijos comunes de entrada en criterios y ejemplos de Example Mapping.
 */
function cleanInput(str) {
  return (str || '')
    .trim()
    .replace(/^[*_]*entrada:?[*_]*\s*/i, '')
    .trim();
}

/**
 * Parsea el contenido de spec.md y extrae los requisitos funcionales con sus
 * criterios observables y ejemplos de Example Mapping.
 * @param {string} specContent Contenido Markdown del spec
 * @returns {Array<Object>} Lista de requisitos y casos de aceptación
 */
function extractAcceptanceOracle(specContent) {
  if (!specContent || typeof specContent !== 'string') {
    return [];
  }

  const lines = specContent.split(/\r?\n/);
  const requirements = [];
  let currentRf = null;
  let inRfSection = false;
  let inCodeBlock = false;
  let codeFenceMarker = '';
  let codeFenceLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Detección de apertura / cierre de bloques de código (``` o ~~~)
    const codeFenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (codeFenceMatch) {
      const marker = codeFenceMatch[1].charAt(0);
      const length = codeFenceMatch[1].length;
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeFenceMarker = marker;
        codeFenceLength = length;
        continue;
      } else if (codeFenceMarker === marker && length >= codeFenceLength) {
        inCodeBlock = false;
        codeFenceMarker = '';
        codeFenceLength = 0;
        continue;
      }
    }
    if (inCodeBlock) continue;

    // Detectar sección principal de Requisitos Funcionales
    if (/^##\s+Requisitos\s+funcionales/i.test(trimmed)) {
      inRfSection = true;
      continue;
    }

    // Salida de la sección de RF si empieza otro H2
    if (inRfSection && /^##\s+/.test(trimmed) && !/^###\s+/.test(trimmed)) {
      inRfSection = false;
      if (currentRf) {
        requirements.push(currentRf);
        currentRf = null;
      }
      continue;
    }

    if (!inRfSection) continue;

    // Detectar encabezado de Requisito Funcional: ### RF-01 Título o ### RF-01: Título
    const rfMatch = trimmed.match(/^###\s+(RF-\d+)\s*(.*)/i);
    if (rfMatch) {
      if (currentRf) {
        requirements.push(currentRf);
      }
      const rawTitle = rfMatch[2] ? rfMatch[2].trim() : '';
      const title = rawTitle.replace(/^[:\-\u2013\u2014]\s*/, '').trim();
      currentRf = {
        id: rfMatch[1].toUpperCase(),
        title,
        criteria: [],
        examples: [],
      };
      continue;
    }

    if (!currentRf) continue;

    // Detectar tablas Markdown o tablas TUI dentro del RF
    if (/^[|│]/.test(trimmed)) {
      // Si la línea contiene datos y no es solo separador de tabla (--- o ─)
      if (!/^[|│\s\-─:+=]+$/.test(trimmed)) {
        let row = trimmed;
        if (row.startsWith('|') || row.startsWith('│')) {
          row = row.slice(1);
        }
        if (row.endsWith('|') || row.endsWith('│')) {
          row = row.slice(0, -1);
        }
        // Proteger pipes escapados (\|) dentro de celdas
        const protectedRow = row.replace(/\\([|│])/g, '\u0000PIPE\u0000');
        const cells = protectedRow
          .split(/[|│]/)
          .map((c) => c.replace(/\u0000PIPE\u0000/g, '|').trim());
        // Descartar encabezados de tabla: si la fila siguiente es el separador (| --- |) o si al menos 2 celdas son nombres exactos de encabezado
        const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
        const followedBySeparator = /^[|│\s\-─:+=]+$/.test(nextLine) && /[─\-]/.test(nextLine);
        const exactHeaderKeywords = /^(escenario|caso|entrada|input|salida|salida\s+esperada|output|resultado|resultado\s+observable)$/i;
        const matchedExact = cells.filter((c) => exactHeaderKeywords.test(c)).length;
        const isHeader = followedBySeparator || matchedExact >= 2;
        if (!isHeader && cells.length >= 2) {
          let scenario;
          let input;
          let expected;
          if (cells.length >= 3) {
            scenario = cells[0] || 'Tabla';
            input = cells[1] || '';
            expected = cleanExpected(cells[2] || '');
          } else {
            input = cells[0] || '';
            expected = cleanExpected(cells[1] || '');
            scenario = input ? `Tabla: ${input}` : 'Tabla';
          }
          currentRf.examples.push({
            scenario,
            input,
            expected,
            raw: `${input} → ${expected}`,
          });
        }
      }
      continue;
    }

    // Detectar viñetas de Example Mapping: - **Ejemplo concreto:** Entrada: X → Salida: Y
    const exampleMatch = trimmed.match(/^[-*]\s+\*\*ejemplo\s+concreto:?\*\*\s*(.*)/i);
    if (exampleMatch) {
      const rest = exampleMatch[1].trim();
      if (rest) {
        const arrowIndex = rest.search(/(?:→|->)/);
        let input = '';
        let expected = '';
        if (arrowIndex !== -1) {
          const arrowMatch = rest.match(/(?:→|->)+/);
          input = cleanInput(rest.slice(0, arrowIndex));
          expected = cleanExpected(rest.slice(arrowIndex + arrowMatch[0].length));
        } else {
          input = cleanInput(rest);
        }
        currentRf.examples.push({
          scenario: 'Ejemplo concreto',
          input: input || rest,
          expected: expected || '',
          raw: rest,
        });
      }
      continue;
    }

    // Sub-viñeta de ejemplo: * Entrada: X → Resultado observable: Y (o Salida: Y)
    const subExampleMatch = trimmed.match(/^[*\-]\s+[*_]*Entrada:?[*_]*\s*(.*)/i);
    if (subExampleMatch) {
      const subRest = subExampleMatch[1].trim();
      const arrowIndex = subRest.search(/(?:→|->)/);
      if (arrowIndex !== -1) {
        const arrowMatch = subRest.match(/(?:→|->)+/);
        const input = cleanInput(subRest.slice(0, arrowIndex));
        const expected = cleanExpected(subRest.slice(arrowIndex + arrowMatch[0].length));
        currentRf.examples.push({
          scenario: 'Ejemplo concreto',
          input,
          expected,
          raw: `${input} → ${expected}`,
        });
        continue;
      }
    }

    // Detectar criterios EARS (viñetas que contienen 'debe' o empiezan con Siempre/Cuando/Si)
    if (/^[-*]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[-*]\s+/, '').trim();
      if (
        /^(Siempre|Cuando|Si|Para|El\s+sistema|La\s+interfaz)\b/i.test(bulletContent) ||
        /\bdebe\b/i.test(bulletContent)
      ) {
        currentRf.criteria.push(bulletContent);
      }
    }
  }

  if (currentRf) {
    requirements.push(currentRf);
  }

  // Fallback: Si un RF no tiene ejemplos explícitos en Example Mapping,
  // transformar cada criterio observable EARS en un caso de aceptación
  for (const rf of requirements) {
    if (rf.examples.length === 0 && rf.criteria.length > 0) {
      rf.examples = rf.criteria.map((crit, idx) => ({
        scenario: `Criterio ${idx + 1}`,
        input: 'Estímulo según especificación',
        expected: crit,
        raw: crit,
      }));
    }
  }

  return requirements;
}

/**
 * Formatea el oráculo a formato Markdown universal (Agnóstico total).
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

/**
 * Localiza la ruta del spec.md a partir de un identificador de feature o búsqueda en docs/sdd/vsdd.
 */
function resolveSpecPath(featureArg, cwd = process.cwd()) {
  // 1. Si se pasó una ruta directa existente
  if (featureArg && fs.existsSync(path.resolve(cwd, featureArg))) {
    const resolved = path.resolve(cwd, featureArg);
    if (fs.statSync(resolved).isDirectory()) {
      const candidate = path.join(resolved, 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return resolved;
    }
  }

  // 2. Si se pasó un identificador (ej: 001 o 001-galeria)
  const baseDir = path.join(cwd, 'docs', 'sdd', 'vsdd');
  if (featureArg && fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir);
    const match = entries.find((e) => e === featureArg || e.startsWith(featureArg + '-'));
    if (match) {
      const candidate = path.join(baseDir, match, 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  if (featureArg) {
    return null;
  }

  // 3. Autodetectar si hay una sola feature en docs/sdd/vsdd (solo si no se pasó featureArg)
  if (fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir).filter((e) => {
      const full = path.join(baseDir, e);
      return fs.statSync(full).isDirectory() && !e.startsWith('.');
    });
    if (entries.length === 1) {
      const candidate = path.join(baseDir, entries[0], 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    }
    // Si hay varias, tomar la última ordenada numéricamente
    if (entries.length > 1) {
      entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
      for (const e of entries) {
        const candidate = path.join(baseDir, e, 'spec.md');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

/**
 * Muestra el mensaje de ayuda de uso del oráculo VSDD.
 */
function printOracleHelp() {
  console.log(`
Uso: vsdd oracle [id-funcionalidad] [opciones]
     vsdd scaffold-tests [id-funcionalidad] [opciones]

Genera un oráculo de pruebas independiente y agnóstico a partir de la especificación (spec.md).

Opciones:
  -t, --target <ruta>   Ruta del archivo de tests de destino (.ts, .py, .go, .rs, .cs, .md)
  --dry-run             Previsualiza el contenido generado sin escribir en disco
  --json                Emite el oráculo y metadatos en formato JSON
  --force               Sobrescribe el archivo de destino si ya existe
  -h, --help            Muestra esta ayuda de uso
`.trim());
}

/**
 * Ejecutor principal del oráculo CLI.
 */
function runOracle(args = process.argv.slice(2), cwd = process.cwd()) {
  let featureArg = null;
  let targetPath = null;
  let dryRun = false;
  let isJson = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      printOracleHelp();
      process.exitCode = 0;
      return;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--json') {
      isJson = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('--target=')) {
      targetPath = arg.slice('--target='.length);
    } else if (arg.startsWith('-t=')) {
      targetPath = arg.slice('-t='.length);
    } else if (arg === '--target' || arg === '-t') {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith('-')) {
        const err = {
          error: `La opción '${arg}' requiere especificar la ruta del archivo destino.`,
          hint: 'Uso: vsdd oracle [id-funcionalidad] --target <ruta>',
        };
        if (isJson || args.includes('--json')) {
          console.error(JSON.stringify(err, null, 2));
        } else {
          console.error(`✖ Error: ${err.error}\n  ${err.hint}`);
        }
        process.exitCode = 1;
        return;
      }
      targetPath = args[++i];
    } else if (!arg.startsWith('-') && !featureArg) {
      featureArg = arg;
    }
  }

  const specPath = resolveSpecPath(featureArg, cwd);
  if (!specPath || !fs.existsSync(specPath)) {
    const err = {
      error: 'No se encontró el archivo spec.md para la funcionalidad especificada.',
      hint: 'Uso: vsdd oracle [id-funcionalidad] [--target <ruta>] [--dry-run|--json]',
    };
    if (isJson) {
      console.error(JSON.stringify(err, null, 2));
    } else {
      console.error(`✖ Error: ${err.error}\n  ${err.hint}`);
    }
    process.exitCode = 1;
    return;
  }

  let specContent;
  try {
    specContent = fs.readFileSync(specPath, 'utf8');
  } catch (err) {
    console.error(`✖ Error al leer '${specPath}': ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const requirements = extractAcceptanceOracle(specContent);
  const featureId = path.basename(path.dirname(specPath));
  const meta = {
    featureId,
    source: path.relative(cwd, specPath),
  };

  if (isJson) {
    console.log(JSON.stringify({ meta, requirements }, null, 2));
    return;
  }

  const formattedOutput = formatOracle(requirements, targetPath, meta);
  const resolvedTarget = targetPath ? path.resolve(cwd, targetPath) : null;
  const targetDir = resolvedTarget ? path.dirname(resolvedTarget) : null;

  if (dryRun || !targetPath) {
    if (dryRun && resolvedTarget && fs.existsSync(resolvedTarget)) {
      process.stderr.write(`▲ [Aviso] El archivo destino '${targetPath}' ya existe (previsualizando con --dry-run).\n`);
    }
    process.stdout.write(formattedOutput);
    return;
  }

  // Prevenir sobreescritura si target es un directorio
  if (fs.existsSync(resolvedTarget)) {
    try {
      if (fs.statSync(resolvedTarget).isDirectory()) {
        console.error(`✖ Error: El destino '${targetPath}' es un directorio existente. Especifica la ruta completa a un archivo.`);
        process.exitCode = 1;
        return;
      }
    } catch (_) {}
  }

  // Escritura en archivo destino
  if (fs.existsSync(resolvedTarget) && !force) {
    console.error(`▲ [Aviso] El archivo destino '${targetPath}' ya existe.`);
    console.error(`  Para no pisar código accidentalmente, usa --force para sobrescribir o --dry-run para previsualizar.`);
    process.exitCode = 1;
    return;
  }

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(resolvedTarget, formattedOutput, 'utf8');
    console.log(`✔ Oráculo de aceptación generado exitosamente en: ${targetPath}`);
  } catch (err) {
    console.error(`✖ Error al escribir en '${targetPath}': ${err.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runOracle();
}

module.exports = {
  extractAcceptanceOracle,
  formatUniversalMarkdown,
  formatTypeScript,
  formatPython,
  formatGo,
  formatRust,
  formatCSharp,
  formatOracle,
  resolveSpecPath,
  runOracle,
};
