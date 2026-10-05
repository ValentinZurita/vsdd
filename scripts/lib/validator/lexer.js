'use strict';

/**
 * Normaliza una cadena para comparaciones insensibles a acentos y mayúsculas
 */
function normalizeText(text) {
  if (!text) return '';
  const str = typeof text === 'string' ? text : String(text.trimmed || text.text || text || '');
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[:.;,\-_]+$/, '')
    .trim();
}

/**
 * Tokenizador semántico y constructor de AST liviano para Markdown
 */
function parseMarkdownLines(content) {
  const rawLines = (content || '').split(/\r?\n/);
  const lines = [];
  const headings = [];
  let inCodeBlock = false;
  let codeFenceMarker = '';
  let codeFenceLength = 0;
  let codeBlockStartLine = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const lineNumber = i + 1;
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
        codeBlockStartLine = lineNumber;
      } else if (codeFenceMarker === marker && length >= codeFenceLength) {
        inCodeBlock = false;
        codeFenceMarker = '';
        codeFenceLength = 0;
      }
    }

    const lineObj = {
      lineNumber,
      text: rawLine,
      trimmed,
      inCodeBlock,
    };
    lines.push(lineObj);

    // Solo parsear encabezados fuera de bloques de código
    if (!inCodeBlock) {
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();
        headings.push({
          level,
          text: headingText,
          normalized: normalizeText(headingText),
          lineNumber,
          lines: [],
        });
      }
    }
  }

  // Asignar líneas a su sección H2 correspondiente
  let currentH2 = null;
  for (const lineObj of lines) {
    if (!lineObj.inCodeBlock) {
      const headingMatch = lineObj.trimmed.match(/^(##)\s+(.*)$/);
      if (headingMatch) {
        currentH2 = headings.find(
          (h) => h.level === 2 && h.lineNumber === lineObj.lineNumber
        );
        continue;
      }
    }
    if (currentH2) {
      currentH2.lines.push(lineObj);
    }
  }

  // -------------------------------------------------------------
  // Construcción de AST Semántico estructurado
  // -------------------------------------------------------------
  const ast = {
    h1: headings.find((h) => h.level === 1) || null,
    sections: [],
    tables: [],
  };

  // Detectar tablas en líneas fuera de code blocks
  let currentTable = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.inCodeBlock && /^\s*\|.*\|\s*$/.test(l.trimmed)) {
      if (!currentTable) {
        currentTable = {
          startLine: l.lineNumber,
          rawLines: [l.text],
          headers: [],
          rows: [],
        };
        // Extraer celdas del encabezado
        const cells = l.trimmed
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        currentTable.headers = cells;
      } else {
        currentTable.rawLines.push(l.text);
        // Ignorar fila separadora | :--- | :--- |
        if (!/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l.trimmed)) {
          const cells = l.trimmed
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          currentTable.rows.push(cells);
        }
      }
    } else {
      if (currentTable) {
        ast.tables.push(currentTable);
        currentTable = null;
      }
    }
  }
  if (currentTable) {
    ast.tables.push(currentTable);
  }

  // Agrupar secciones H2 con sus sub-encabezados H3
  const h2Headings = headings.filter((h) => h.level === 2);
  for (let i = 0; i < h2Headings.length; i++) {
    const h2 = h2Headings[i];
    const nextH2 = h2Headings[i + 1] || null;
    const startLine = h2.lineNumber;
    const endLine = nextH2 ? nextH2.lineNumber - 1 : lines.length;

    const sectionLines = lines.filter(
      (l) => l.lineNumber >= startLine && l.lineNumber <= endLine
    );
    const subH3s = headings.filter(
      (h) => h.level === 3 && h.lineNumber > startLine && h.lineNumber <= endLine
    );

    ast.sections.push({
      heading: h2,
      startLine,
      endLine,
      lines: sectionLines,
      subH3s,
    });
  }

  /**
   * Genera un snippet visual de código con contexto de líneas y marcador '>'
   */
  function getSnippet(targetLineNumber, context = 1) {
    const target = Number(targetLineNumber);
    if (!Number.isFinite(target) || target < 1) return '';
    const totalLines = rawLines.length;
    if (totalLines === 0) return '';
    const clampedTarget = Math.min(totalLines, target);
    const start = Math.max(1, clampedTarget - context);
    const end = Math.min(totalLines, clampedTarget + context);

    const snippetLines = [];
    const maxLineNumWidth = String(end).length;

    for (let l = start; l <= end; l++) {
      const isTarget = l === clampedTarget;
      const marker = isTarget ? '> ' : '  ';
      const lineNumStr = String(l).padStart(maxLineNumWidth, ' ');
      const lineContent = rawLines[l - 1] || '';
      snippetLines.push(`${marker}${lineNumStr} | ${lineContent}`);
    }

    return snippetLines.join('\n');
  }

  /**
   * Calcula la línea óptima de inserción para una sección faltante en función del orden canónico
   */
  function calculateInsertionLine(targetKey, canonicalKeys = []) {
    const targetNorm = normalizeText(targetKey);
    const canonicalNorms = (canonicalKeys || [])
      .filter(Boolean)
      .map((k) =>
        typeof k === 'string' ? normalizeText(k) : normalizeText(k?.key || k?.title || '')
      );

    const targetIdx = canonicalNorms.indexOf(targetNorm);
    if (targetIdx === -1) {
      // Si no está en el catálogo canónico, sugerir al final del documento
      return Math.max(1, rawLines.length);
    }

    // Buscar la sección previa más cercana que sí exista
    for (let i = targetIdx - 1; i >= 0; i--) {
      const prevNorm = canonicalNorms[i];
      const prevSection = ast.sections.find(
        (s) => s.heading.normalized === prevNorm
      );
      if (prevSection) {
        return prevSection.endLine + 1;
      }
    }

    // Si no hay secciones previas, buscar la sección posterior más cercana
    for (let i = targetIdx + 1; i < canonicalNorms.length; i++) {
      const nextNorm = canonicalNorms[i];
      const nextSection = ast.sections.find(
        (s) => s.heading.normalized === nextNorm
      );
      if (nextSection) {
        return Math.max(1, nextSection.startLine);
      }
    }

    // Fallback: después del H1 o en línea 3
    const h1 = ast.h1;
    return h1 ? h1.lineNumber + 2 : 2;
  }

  return {
    rawLines,
    lines,
    headings,
    unclosedCodeBlock: inCodeBlock ? codeBlockStartLine : null,
    ast,
    getSnippet,
    calculateInsertionLine,
  };
}

module.exports = {
  normalizeText,
  parseMarkdownLines,
};
