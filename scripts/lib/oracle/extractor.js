/**
 * VSDD Oracle - Extractor
 * Parser de especificaciones Markdown (spec.md) para extraer requisitos funcionales,
 * criterios observables EARS y ejemplos de Example Mapping.
 */

'use strict';

const { cleanExpected, cleanInput } = require('./sanitizers');

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

module.exports = {
  extractAcceptanceOracle,
};
