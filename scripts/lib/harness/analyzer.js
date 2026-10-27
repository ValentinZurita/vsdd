'use strict';

/**
 * Neutraliza cadenas, plantillas y expresiones regulares en una línea para análisis estructural.
 */
function stripLiteralsAndComments(line) {
  const noStrings = line
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""');
  const noLineComments = noStrings.replace(/\/\/.*$/, '').replace(/#.*$/, '');
  return noLineComments.replace(/\/(?![/*])(?:\\.|[^/\\])+\/[gimsuy]*/g, 'rx');
}

/**
 * Determina si una línea es un comentario puro o está vacía.
 */
function isCommentOrBlank(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('*/')
  );
}

/**
 * Normaliza entradas que pueden ser un git diff unificado o código fuente directo.
 */
function normalizeSourceInput(input) {
  const text = String(input || '');
  if (!/^@@\s+-\d+/m.test(text)) {
    return text;
  }
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1))
    .join('\n');
}

/**
 * Busca modificadores de omisión (.skip, .todo, xit, xdescribe, pytest.mark.skip, t.Skip, #[ignore]).
 */
function scanTestSkipModifiers(lines) {
  const violations = [];
  const skipPatterns = [
    /\b(?:test|it|describe)\.skip\b/,
    /\b(?:test|it)\.todo\b/,
    /\b(?:xit|xtest|xdescribe)\s*\(/,
    /@?pytest\.mark\.skip\b/,
    /\bpytest\.skip\s*\(/,
    /\bt\.Skip(?:Now|f)?\s*\(/,
    /#\s*\[\s*ignore\b/,
  ];

  for (let i = 0; i < lines.length; i += 1) {
    const clean = stripLiteralsAndComments(lines[i]);
    if (skipPatterns.some((rx) => rx.test(clean) || rx.test(lines[i].trim()))) {
      violations.push({
        type: 'test-skip',
        rule: 'no-skip',
        line: i + 1,
        message: `Modificador de omisión de prueba prohibido en línea ${i + 1}.`,
      });
    }
  }
  return violations;
}

/**
 * Busca aserciones cosméticas o vacías y comprueba que exista al menos una aserción real.
 */
function scanTestAssertions(lines) {
  const violations = [];
  const cosmeticPatterns = [
    /\.toBeDefined\s*\(\s*\)/,
    /\.toBeTruthy\s*\(\s*\)/,
    /\.not\.toBeNull\s*\(\s*\)/,
    /\bexpect\s*\(\s*(?:true|false|1|0)\s*\)\s*\.toBe\s*\(\s*(?:true|false|1|0)\s*\)/,
    /\bassert(?:\.ok)?\s*\(\s*true\s*\)/,
    /\bassert\.(?:equal|strictEqual)\s*\(\s*(?:true|1)\s*,\s*(?:true|1)\s*\)/,
  ];
  const realAssertionRx =
    /\b(?:assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual|match|doesNotMatch|throws|rejects|ok)|expect\s*\([^)]+\)\s*\.(?:toBe|toEqual|toStrictEqual|toMatch|toContain|toThrow)|assert_eq!|assert\s+[^;]+==)/;

  let realCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (isCommentOrBlank(raw)) {
      continue;
    }
    const isCosmetic = cosmeticPatterns.some((rx) => rx.test(raw));
    if (isCosmetic) {
      violations.push({
        type: 'cosmetic-assertion',
        rule: 'no-cosmetic-assertion',
        line: i + 1,
        message: `Aserción cosmética o tautológica detectada en línea ${i + 1}.`,
      });
    } else if (realAssertionRx.test(raw)) {
      realCount += 1;
    }
  }

  if (realCount === 0 && violations.length === 0) {
    violations.push({
      type: 'missing-real-assertion',
      rule: 'require-real-assertion',
      line: 1,
      message: 'El archivo de pruebas no contiene aserciones de valor reales.',
    });
  }
  return violations;
}

/**
 * Inspecciona un archivo de pruebas para verificar pureza (sin .skip ni aserciones vacías).
 */
function inspectTestPurity(content) {
  const lines = String(content || '').split(/\r?\n/);
  const violations = [
    ...scanTestSkipModifiers(lines),
    ...scanTestAssertions(lines),
  ];
  return {
    valid: violations.length === 0,
    ok: violations.length === 0,
    violations,
    errors: violations.map((v) => v.message),
  };
}

/**
 * Extrae literales de cadena (> 8 caracteres) presentes en aserciones de prueba.
 */
function extractTestLiterals(testContent) {
  const lines = String(testContent || '').split(/\r?\n/);
  const assertionLineRx = /\b(?:assert|expect|toBe|toEqual|Should)\b/;
  const literals = new Set();

  for (const line of lines) {
    if (!assertionLineRx.test(line) || isCommentOrBlank(line)) {
      continue;
    }
    const matches = line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])+)\1/g);
    for (const match of matches) {
      const value = match[2].trim();
      const isPath = value.startsWith('.') || value.startsWith('/') || value.startsWith('node:');
      if (value.length > 8 && !isPath) {
        literals.add(value);
      }
    }
  }
  return Array.from(literals);
}

/**
 * Detecta bloques catch vacíos y comentarios supresores de tipos/linter.
 */
function scanCatchAndSuppressors(code, lines) {
  const violations = [];
  const suppressorParts = ['@ts-ignore', '@ts-nocheck', 'eslint-disable', 'type:\\s*ignore'];
  const suppressorRx = new RegExp(
    `(?:\\/\\/|\\/\\*|#)\\s*(?:${suppressorParts.join('|')})\\b`
  );

  for (let i = 0; i < lines.length; i += 1) {
    if (suppressorRx.test(lines[i])) {
      violations.push({
        type: 'type-suppressor',
        rule: 'no-suppressors',
        line: i + 1,
        message: `Supresor de compilador o linter prohibido en línea ${i + 1}.`,
      });
    }
  }

  const cleanLines = lines.map((l) => stripLiteralsAndComments(l));
  const joinedClean = cleanLines.join('\n');
  const emptyCatchRx = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
  let match = emptyCatchRx.exec(joinedClean);
  while (match !== null) {
    const lineNum = joinedClean.slice(0, match.index).split('\n').length;
    violations.push({
      type: 'empty-catch',
      rule: 'no-empty-catch',
      line: lineNum,
      message: `Bloque catch vacío sin manejo de errores en línea ${lineNum}.`,
    });
    match = emptyCatchRx.exec(joinedClean);
  }
  return violations;
}

/**
 * Detecta literales de prueba (> 8 caracteres) copiados/hardcodeados en código de producción.
 */
function scanHardcodedLiterals(lines, rawLiterals) {
  const literals = Array.isArray(rawLiterals)
    ? rawLiterals.filter((lit) => typeof lit === 'string' && lit.length > 8)
    : extractTestLiterals(String(rawLiterals || ''));
  if (literals.length === 0) {
    return [];
  }

  const violations = [];
  const errorEmitRx = /\b(?:throw\s+new\s+\w*Error|console\.(?:error|warn))\s*\(/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isCommentOrBlank(line) || errorEmitRx.test(line)) {
      continue;
    }
    for (const lit of literals) {
      if (line.includes(`'${lit}'`) || line.includes(`"${lit}"`) || line.includes(`\`${lit}\``)) {
        violations.push({
          type: 'hardcoded-test-literal',
          rule: 'no-hardcoded-literals',
          literal: lit,
          line: i + 1,
          message: `Literal de prueba hardcodeado ("${lit}") detectado en línea ${i + 1}.`,
        });
      }
    }
  }
  return violations;
}

/**
 * Extrae el nombre de función si una línea declara el inicio de una función con llaves.
 */
function matchBraceFunctionStart(cleanLine) {
  const decl =
    cleanLine.match(/\b(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/) ||
    cleanLine.match(/\b(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>\s*\{/) ||
    cleanLine.match(/\b(?:func|fn)\s+([A-Za-z0-9_]+)\s*\([^)]*\)[^{]*\{/);
  return decl ? decl[1] : null;
}

/**
 * Evalúa el cuerpo de una función delimitada por llaves midiendo líneas efectivas y anidamiento.
 */
function evaluateBraceFunction(lines, startIndex, name, options) {
  const maxLines = options.maxFunctionLines || 50;
  const maxNesting = options.maxNestingDepth || 3;
  let braceDepth = 0;
  let effectiveLines = 0;
  let maxControlDepth = 0;
  const controlStack = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    const raw = lines[i];
    const clean = stripLiteralsAndComments(raw);
    if (i > startIndex && !isCommentOrBlank(raw) && clean.trim() !== '}') {
      effectiveLines += 1;
    }
    const isControl =
      /\b(?:if|for|while|switch|try)\b/.test(clean) && !/\belse\s+if\b/.test(clean);
    const opens = (clean.match(/\{/g) || []).length;
    const closes = (clean.match(/\}/g) || []).length;

    if (i > startIndex && isControl && opens > 0) {
      controlStack.push(braceDepth + 1);
      maxControlDepth = Math.max(maxControlDepth, controlStack.length);
    }
    braceDepth += opens - closes;
    while (controlStack.length > 0 && braceDepth < controlStack[controlStack.length - 1]) {
      controlStack.pop();
    }
    if (braceDepth <= 0) {
      return buildFunctionViolations(name, startIndex + 1, effectiveLines, maxControlDepth, maxLines, maxNesting);
    }
  }
  return [];
}

/**
 * Construye las violaciones de tamaño o anidamiento para una función evaluada.
 */
function buildFunctionViolations(name, line, effectiveLines, maxControlDepth, maxLines, maxNesting) {
  const violations = [];
  if (effectiveLines > maxLines) {
    violations.push({
      type: 'function-too-long',
      rule: 'max-function-lines',
      name,
      line,
      effectiveLines,
      message: `Función '${name}' excede límite de ${maxLines} líneas (${effectiveLines} líneas efectivas).`,
    });
  }
  if (maxControlDepth > maxNesting) {
    violations.push({
      type: 'excessive-nesting',
      rule: 'max-nesting-depth',
      name,
      line,
      depth: maxControlDepth,
      message: `Función '${name}' supera ${maxNesting} niveles de anidamiento (${maxControlDepth} niveles).`,
    });
  }
  return violations;
}

/**
 * Escanea funciones en lenguajes de llaves (JS/TS/Go/Rust) y Python (def por indentación).
 */
function scanFunctionsComplexity(lines, options = {}) {
  const violations = [];
  const maxLines = options.maxFunctionLines || 50;
  const maxNesting = options.maxNestingDepth || 3;

  for (let i = 0; i < lines.length; i += 1) {
    const clean = stripLiteralsAndComments(lines[i]);
    const braceFnName = matchBraceFunctionStart(clean);
    if (braceFnName) {
      violations.push(...evaluateBraceFunction(lines, i, braceFnName, options));
      continue;
    }
    const pyMatch = clean.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*:/);
    if (pyMatch) {
      const pyViolations = evaluatePythonFunction(lines, i, pyMatch[1].length, pyMatch[2], maxLines, maxNesting);
      violations.push(...pyViolations);
    }
  }
  return violations;
}

/**
 * Evalúa una función Python por indentación midiendo líneas efectivas y niveles de control.
 */
function evaluatePythonFunction(lines, startIndex, baseIndent, name, maxLines, maxNesting) {
  let effectiveLines = 0;
  let maxControlDepth = 0;
  const controlIndents = [];

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (isCommentOrBlank(raw)) {
      continue;
    }
    const indent = (raw.match(/^(\s*)/) || ['', ''])[1].length;
    if (indent <= baseIndent) {
      break;
    }
    effectiveLines += 1;
    while (controlIndents.length > 0 && indent <= controlIndents[controlIndents.length - 1]) {
      controlIndents.pop();
    }
    if (/^\s*(?:if|for|while|try|with)\b/.test(raw)) {
      controlIndents.push(indent);
      maxControlDepth = Math.max(maxControlDepth, controlIndents.length);
    }
  }
  return buildFunctionViolations(name, startIndex + 1, effectiveLines, maxControlDepth, maxLines, maxNesting);
}

/**
 * Inspecciona código de producción o diff verificando complejidad, catch vacíos, supresores y literales espejo.
 */
function inspectProductionCode(content, testLiterals = [], options = {}) {
  const normalized = normalizeSourceInput(content);
  const lines = normalized.split(/\r?\n/);
  const violations = [
    ...scanCatchAndSuppressors(normalized, lines),
    ...scanHardcodedLiterals(lines, testLiterals),
    ...scanFunctionsComplexity(lines, options),
  ];

  return {
    valid: violations.length === 0,
    ok: violations.length === 0,
    violations,
    errors: violations.map((v) => v.message),
  };
}

module.exports = {
  inspectTestPurity,
  inspectTestFile: inspectTestPurity,
  analyzeTestContent: inspectTestPurity,
  extractTestLiterals,
  inspectProductionCode,
  inspectProductionDiff: inspectProductionCode,
  analyzeProductionContent: inspectProductionCode,
};
