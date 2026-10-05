'use strict';

const fs = require('fs');
const path = require('path');
const { parseMarkdownLines } = require('./lexer');

function validateCrossArtifactTraceability(parsedTasks, featureDir, errors, warnings, options = {}) {
  // 1. Obtener y parsear spec.md si existe
  let specContent = options.specContent;
  if (!specContent && featureDir && featureDir !== '.' && fs.existsSync(path.join(featureDir, 'spec.md'))) {
    try {
      specContent = fs.readFileSync(path.join(featureDir, 'spec.md'), 'utf8');
    } catch (_) {}
  }

  if (specContent) {
    const specParsed = parseMarkdownLines(specContent);
    const specEstadoLine = specParsed.lines.find(
      (l) => !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
    );
    const specEstado = specEstadoLine
      ? (specEstadoLine.trimmed.match(/^\s*Estado:\s*([a-zA-Z0-9_-]+)/i)[1] || '').toLowerCase()
      : '';

    // Si spec está cancelado, no evaluar trazabilidad
    if (specEstado !== 'cancelado') {
      // Extraer RFs de spec.md
      const specRFs = new Map();
      for (const h of specParsed.headings) {
        if (h.level === 3) {
          const match = h.text.match(/^RF-(\d+)\b(.*)$/i);
          if (match) {
            const num = match[1].padStart(2, '0');
            const id = `RF-${num}`;
            specRFs.set(id, { title: match[2].replace(/^[:\s-]+/, '').trim(), line: h.lineNumber });
          }
        }
      }

      if (specRFs.size > 0) {
        // Extraer menciones a RFs en tasks.md
        const tasksRFs = new Set();
        const phantomRFs = [];

        for (const line of parsedTasks.lines) {
          if (!line.inCodeBlock) {
            const rfMatches = line.trimmed.matchAll(/\bRF-(\d+)\b/gi);
            for (const m of rfMatches) {
              const num = m[1].padStart(2, '0');
              const id = `RF-${num}`;
              tasksRFs.add(id);
              if (!specRFs.has(id)) {
                phantomRFs.push({ id, line: line.lineNumber });
              }
            }
          }
        }

        // Determinar severidad según estado de tasks.md
        const tasksEstadoLine = parsedTasks.lines.find(
          (l) => !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
        );
        const tasksEstado = tasksEstadoLine
          ? (tasksEstadoLine.trimmed.match(/^\s*Estado:\s*([a-zA-Z0-9_-]+)/i)[1] || '').toLowerCase()
          : '';
        const isBlockingState =
          tasksEstado === 'listo-para-aplicar' ||
          tasksEstado === 'listo-para-verify' ||
          tasksEstado === 'completado';

        // 1. Requisitos huérfanos: definidos en spec.md pero ausentes en tasks.md
        for (const [id, info] of specRFs.entries()) {
          if (!tasksRFs.has(id)) {
            const line = tasksEstadoLine ? tasksEstadoLine.lineNumber : 1;
            const issue = {
              line,
              rule: 'trazabilidad-rf-huerfano',
              message: `El requisito '${id}${info.title ? ': ' + info.title : ''}' definido en spec.md no está cubierto por ninguna tarea en tasks.md.`,
              expected: `Al menos una tarea cubriendo '${id}'`,
              found: 'Requisito sin tarea asignada',
              snippet: parsedTasks.getSnippet ? parsedTasks.getSnippet(line) : undefined,
              suggestion: `Agrega una tarea que implemente '${id}' o declara '- **Cubre:** ${id}' en la tarea correspondiente.`,
            };
            if (isBlockingState) {
              errors.push(issue);
            } else {
              warnings.push(issue);
            }
          }
        }

        // 2. Requisitos fantasma: citados en tasks.md pero inexistentes en spec.md
        for (const phantom of phantomRFs) {
          errors.push({
            line: phantom.line,
            rule: 'trazabilidad-rf-inexistente',
            message: `La tarea cita el requisito '${phantom.id}', pero este no existe en spec.md.`,
            expected: `Requisito definido en spec.md (${Array.from(specRFs.keys()).join(', ')})`,
            found: phantom.id,
            snippet: parsedTasks.getSnippet ? parsedTasks.getSnippet(phantom.line) : undefined,
            suggestion: `Corrige el identificador a uno existente en spec.md (${Array.from(specRFs.keys()).join(', ')}) o define '${phantom.id}' en spec.md.`,
          });
        }
      }
    }
  }

  // 2. Obtener y parsear plan.md si existe
  let planContent = options.planContent;
  if (!planContent && featureDir && featureDir !== '.' && fs.existsSync(path.join(featureDir, 'plan.md'))) {
    try {
      planContent = fs.readFileSync(path.join(featureDir, 'plan.md'), 'utf8');
    } catch (_) {}
  }

  if (planContent) {
    const planParsed = parseMarkdownLines(planContent);
    const planFiles = new Set();
    let inArbol = false;

    for (const line of planParsed.lines) {
      if (line.inCodeBlock) continue;
      if (/^##\s+.*[ÁáAa]rbol de cambios/i.test(line.trimmed)) {
        inArbol = true;
        continue;
      }
      if (inArbol && /^##\s+/i.test(line.trimmed)) {
        inArbol = false;
        continue;
      }
      if (inArbol) {
        const fileMatch = line.trimmed.match(/^[-*]\s*[`]?\s*([+~-])\s*([^`\s#:]+)/);
        if (fileMatch) {
          const clean = fileMatch[2].replace(/[`*]/g, '').trim();
          if (clean) planFiles.add(clean);
        }
      }
    }

    if (planFiles.size > 0) {
      for (const line of parsedTasks.lines) {
        if (!line.inCodeBlock && /^\s*[-*]\s*\*\*Archivos:\*\*\s*(.+)$/i.test(line.trimmed)) {
          const match = line.trimmed.match(/^\s*[-*]\s*\*\*Archivos:\*\*\s*(.+)$/i);
          if (match && match[1]) {
            const rawFiles = match[1].split(/[,;]/);
            for (const rf of rawFiles) {
              let cleaned = rf.replace(/[`*]/g, '').trim();
              cleaned = cleaned.replace(/^([+~-])\s*/, '').trim();
              if (
                cleaned &&
                !cleaned.toLowerCase().includes('ninguno') &&
                !cleaned.toLowerCase().includes('n/a')
              ) {
                let matched = false;
                for (const pf of planFiles) {
                  if (pf.includes(cleaned) || cleaned.includes(pf)) {
                    matched = true;
                    break;
                  }
                }
                if (!matched) {
                  warnings.push({
                    line: line.lineNumber,
                    rule: 'trazabilidad-archivo-no-en-plan',
                    message: `El archivo '${cleaned}' mencionado en la tarea no figura en el '## Árbol de cambios' de plan.md.`,
                    expected: `Archivo declarado en plan.md (${Array.from(planFiles).join(', ')})`,
                    found: cleaned,
                    snippet: parsedTasks.getSnippet ? parsedTasks.getSnippet(line.lineNumber) : undefined,
                    suggestion: `Declara '${cleaned}' en el '## Árbol de cambios' de plan.md para asegurar consistencia.`,
                  });
                }
              }
            }
          }
        }
      }
    }
  }
}

module.exports = {
  validateCrossArtifactTraceability,
};
