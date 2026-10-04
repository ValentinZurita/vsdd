'use strict';

/**
 * Normaliza una cadena para comparaciones insensibles a acentos y mayúsculas
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[:.;,\-_]+$/, '')
    .trim();
}

/**
 * Tokenizador basado en máquina de estados que extrae líneas, encabezados y detecta bloques de código
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

  return {
    rawLines,
    lines,
    headings,
    unclosedCodeBlock: inCodeBlock ? codeBlockStartLine : null,
  };
}

module.exports = {
  normalizeText,
  parseMarkdownLines,
};
