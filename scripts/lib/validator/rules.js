'use strict';

const path = require('path');
const { normalizeText } = require('./lexer');
const { findHeadingByAlias } = require('./hygiene');
const { validateCrossArtifactTraceability } = require('./traceability');

/**
 * Validador para idea.md
 */
function validateIdea(parsed, errors, warnings) {
  // 1. Título H1
  const h1 = parsed.headings.find((h) => h.level === 1);
  if (!h1) {
    errors.push({
      line: 1,
      rule: 'titulo-h1-requerido',
      message: "Falta el título principal '# <Título>' en idea.md.",
      expected: '# Idea <nnn> <Nombre>',
      found: 'Sin título H1',
      snippet: parsed.getSnippet ? parsed.getSnippet(1) : undefined,
      suggestion: "Agrega al inicio del archivo: '# Idea 001 <Nombre de la funcionalidad>'.",
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    const targetLine = h1 ? h1.lineNumber + 1 : 2;
    errors.push({
      line: targetLine,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: listo-para-spec' o 'Estado: en-revision'.",
      expected: 'Estado: listo-para-spec',
      found: 'No declarada',
      snippet: parsed.getSnippet ? parsed.getSnippet(targetLine) : undefined,
      suggestion: "Declara debajo del título: 'Estado: listo-para-spec'.",
    });
  } else {
    const estadoMatch = estadoLine.trimmed.match(/^\s*Estado:\s*([a-zA-Z0-9_-]+)/i);
    const estadoVal = estadoMatch[1].toLowerCase();
    if (estadoVal === 'cancelado') {
      errors.length = 0;
      warnings.length = 0;
      return { errors, warnings };
    }
    if (estadoVal !== 'listo-para-spec' && estadoVal !== 'en-revision') {
      errors.push({
        line: estadoLine.lineNumber,
        rule: 'estado-invalido',
        message: `Estado '${estadoVal}' no es válido para idea.md. Debe ser 'listo-para-spec' o 'en-revision'.`,
        expected: 'Estado: listo-para-spec',
        found: estadoLine.trimmed,
        snippet: parsed.getSnippet ? parsed.getSnippet(estadoLine.lineNumber) : undefined,
        suggestion: "Cambia el estado a 'Estado: listo-para-spec' o 'Estado: en-revision'.",
      });
    }
  }

  // 3. Secciones Obligatorias del Contrato Mínimo Viable
  const requiredH2 = [
    { key: 'problema', title: 'Problema' },
    { key: 'qué vamos a hacer', title: 'Qué vamos a hacer' },
    { key: 'en alcance / fuera de alcance', title: 'En alcance / Fuera de alcance' },
    { key: 'listo cuando', title: 'Listo cuando' },
  ];

  for (const req of requiredH2) {
    const found = parsed.headings.find(
      (h) => h.level === 2 && normalizeText(h.text) === normalizeText(req.title)
    );
    if (!found) {
      // Verificar si usó un alias
      const aliasFound = findHeadingByAlias(parsed.headings, 2, req.title.toLowerCase());
      if (aliasFound && aliasFound.aliasUsed) {
        errors.push({
          line: aliasFound.match.lineNumber,
          rule: 'seccion-mal-nombrada',
          message: `Falta la sección obligatoria '## ${req.title}'. Se detectó '## ${aliasFound.aliasUsed}'. Usa el encabezado estándar para cumplir con el contrato.`,
          expected: `## ${req.title}`,
          found: `## ${aliasFound.aliasUsed}`,
          snippet: parsed.getSnippet ? parsed.getSnippet(aliasFound.match.lineNumber) : undefined,
          suggestion: `Renombra '## ${aliasFound.aliasUsed}' por '## ${req.title}'.`,
        });
      } else {
        const insertionLine = parsed.calculateInsertionLine
          ? parsed.calculateInsertionLine(req.key, requiredH2)
          : 1;
        errors.push({
          line: insertionLine,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en idea.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
          snippet: parsed.getSnippet ? parsed.getSnippet(insertionLine) : undefined,
          suggestion: `Inserta '## ${req.title}' con su contenido correspondiente.`,
        });
      }
    } else {
      // Validar que la sección tenga contenido
      const contentLines = found.lines.filter((l) => l.trimmed.length > 0);
      if (contentLines.length === 0) {
        errors.push({
          line: found.lineNumber,
          rule: 'seccion-vacia',
          message: `La sección '## ${req.title}' está vacía. Debe contener descripción redactada.`,
          expected: 'Contenido redactado',
          found: 'Sección sin líneas de contenido',
          snippet: parsed.getSnippet ? parsed.getSnippet(found.lineNumber) : undefined,
          suggestion: `Redacta el contenido descriptivo para '## ${req.title}'.`,
        });
      }

      // Validar contrato específico de "Listo cuando" (1 a 3 viñetas observables)
      if (normalizeText(req.title) === 'listo cuando') {
        const bullets = contentLines.filter((l) => /^[-*]\s+\S+/.test(l.trimmed));
        if (bullets.length === 0) {
          errors.push({
            line: found.lineNumber,
            rule: 'listo-cuando-sin-vinetas',
            message: "La sección '## Listo cuando' debe contener de 1 a 3 viñetas con resultados observables.",
            expected: '- Condición observable 1',
            found: 'Sin viñetas observables',
            snippet: parsed.getSnippet ? parsed.getSnippet(found.lineNumber) : undefined,
            suggestion: "Agrega de 1 a 3 viñetas iniciando con: '- Se puede comprobar que: <resultado observable>'.",
          });
        }
      }
    }
  }

  // 4. Extensibilidad: Secciones adicionales no vacías
  for (const h of parsed.headings.filter((h) => h.level === 2)) {
    const isRequired = requiredH2.some(
      (req) => normalizeText(req.title) === h.normalized
    );
    if (!isRequired) {
      const content = h.lines.filter((l) => l.trimmed.length > 0);
      if (content.length === 0) {
        warnings.push({
          line: h.lineNumber,
          rule: 'seccion-adicional-vacia',
          message: `La sección adicional '## ${h.text}' no contiene contenido.`,
          snippet: parsed.getSnippet ? parsed.getSnippet(h.lineNumber) : undefined,
          suggestion: `Agrega contenido a la sección '## ${h.text}' o elimínala si no es necesaria.`,
        });
      }
    }
  }
}

/**
 * Validador para spec.md
 */
function validateSpec(parsed, errors, warnings) {
  // 1. Título H1
  const h1 = parsed.headings.find((h) => h.level === 1);
  if (!h1 || !/^Spec\b/i.test(h1.text)) {
    errors.push({
      line: h1 ? h1.lineNumber : 1,
      rule: 'titulo-h1-spec-requerido',
      message: "El título principal debe iniciar con '# Spec <nnn> <Nombre>'.",
      expected: '# Spec <nnn> <Nombre>',
      found: h1 ? h1.text : 'Sin título',
      snippet: parsed.getSnippet ? parsed.getSnippet(h1 ? h1.lineNumber : 1) : undefined,
      suggestion: "Asegúrate de que la primera línea comience con: '# Spec 001 <Nombre>'.",
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    const targetLine = h1 ? h1.lineNumber + 1 : 2;
    errors.push({
      line: targetLine,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: <en-revision | listo-para-plan>'.",
      expected: 'Estado: en-revision o Estado: listo-para-plan',
      found: 'No declarada',
      snippet: parsed.getSnippet ? parsed.getSnippet(targetLine) : undefined,
      suggestion: "Declara debajo del título: 'Estado: en-revision' o 'Estado: listo-para-plan'.",
    });
  } else {
    const match = estadoLine.trimmed.match(/^\s*Estado:\s*([a-zA-Z0-9_-]+)/i);
    const estadoVal = match[1].toLowerCase();
    if (estadoVal === 'cancelado') {
      errors.length = 0;
      warnings.length = 0;
      return { errors, warnings };
    }
    if (estadoVal !== 'en-revision' && estadoVal !== 'listo-para-plan') {
      errors.push({
        line: estadoLine.lineNumber,
        rule: 'estado-invalido',
        message: `Estado '${estadoVal}' no es válido para spec.md. Debe ser 'en-revision' o 'listo-para-plan'.`,
        expected: 'Estado: en-revision o Estado: listo-para-plan',
        found: estadoLine.trimmed,
        snippet: parsed.getSnippet ? parsed.getSnippet(estadoLine.lineNumber) : undefined,
        suggestion: "Cambia el estado a 'Estado: en-revision' o 'Estado: listo-para-plan'.",
      });
    }
  }

  // 3. Secciones Obligatorias del Contrato Mínimo Viable
  const requiredH2 = [
    { key: 'contexto y objetivos', title: 'Contexto y objetivos', accepted: ['contexto y objetivos'] },
    { key: 'requisitos funcionales', title: 'Requisitos funcionales', accepted: ['requisitos funcionales'] },
    { key: 'casos límite', title: 'Casos límite', accepted: ['casos limite'] },
    { key: 'requisitos no funcionales', title: 'Requisitos no funcionales', accepted: ['requisitos no funcionales'] },
    { key: 'fuera de alcance', title: 'Fuera de alcance', accepted: ['fuera de alcance', 'limites y exclusiones', 'limites y exclusiones (non-goals y anti-goals)'] },
    { key: 'criterios de finalización', title: 'Criterios de finalización', accepted: ['criterios de finalizacion'] },
  ];

  for (const req of requiredH2) {
    const found = parsed.headings.find(
      (h) => h.level === 2 && req.accepted.includes(normalizeText(h.text))
    );
    if (!found) {
      const aliasFound = findHeadingByAlias(parsed.headings, 2, req.key);
      if (aliasFound && aliasFound.aliasUsed) {
        errors.push({
          line: aliasFound.match.lineNumber,
          rule: 'seccion-mal-nombrada',
          message: `Falta la sección obligatoria '## ${req.title}'. Se detectó '## ${aliasFound.aliasUsed}'. Usa el encabezado estándar para cumplir con el contrato.`,
          expected: `## ${req.title}`,
          found: `## ${aliasFound.aliasUsed}`,
          snippet: parsed.getSnippet ? parsed.getSnippet(aliasFound.match.lineNumber) : undefined,
          suggestion: `Renombra '## ${aliasFound.aliasUsed}' por '## ${req.title}'.`,
        });
      } else {
        const insertionLine = parsed.calculateInsertionLine
          ? parsed.calculateInsertionLine(req.key, requiredH2)
          : 1;
        errors.push({
          line: insertionLine,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en spec.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
          snippet: parsed.getSnippet ? parsed.getSnippet(insertionLine) : undefined,
          suggestion: `Inserta la sección obligatoria '## ${req.title}'.`,
        });
      }
    }
  }

  // 4. Validación interna de Requisitos Funcionales (RF-xx y EARS)
  const rfSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text) === 'requisitos funcionales'
  );
  if (rfSection) {
    const rfHeadings = parsed.headings.filter(
      (h) => h.level === 3 && /^RF-?\d+/i.test(h.text)
    );

    if (rfHeadings.length === 0) {
      errors.push({
        line: rfSection.lineNumber,
        rule: 'rf-sin-elementos',
        message: "La sección '## Requisitos funcionales' debe contener al menos un requisito '### RF-01 <Título>'.",
        expected: '### RF-01 <Título>',
        found: 'Sin requisitos RF-xx',
        snippet: parsed.getSnippet ? parsed.getSnippet(rfSection.lineNumber) : undefined,
        suggestion: "Agrega al menos un requisito funcional: '### RF-01 <Título del Requisito>'.",
      });
    }

    for (const rfh of rfHeadings) {
      const matchRf = rfh.text.match(/^RF-(\d+)/i);
      if (matchRf) {
        const digits = matchRf[1];
        if (digits.length !== 2) {
          errors.push({
            line: rfh.lineNumber,
            rule: 'rf-identificador-formato',
            message: `El identificador de requisito '${rfh.text}' debe usar 2 dígitos correlativos (ej: '### RF-01').`,
            expected: `RF-${digits.padStart(2, '0')}`,
            found: rfh.text,
            snippet: parsed.getSnippet ? parsed.getSnippet(rfh.lineNumber) : undefined,
            suggestion: `Corrige el identificador a 2 dígitos: '### RF-${digits.padStart(2, '0')} ...'.`,
          });
        }
      }

      // Validar presencia de sintaxis EARS en los criterios del RF
      const rfStartIndex = parsed.lines.findIndex((l) => l.lineNumber === rfh.lineNumber);
      const nextHIndex = parsed.lines.findIndex(
        (l, idx) =>
          idx > rfStartIndex &&
          !l.inCodeBlock &&
          /^#{1,3}\s+/.test(l.trimmed)
      );
      const rfLines = parsed.lines.slice(
        rfStartIndex + 1,
        nextHIndex !== -1 ? nextHIndex : parsed.lines.length
      );
      const rfBullets = rfLines.filter((l) => /^\s*[-*]\s+/.test(l.trimmed));
      if (rfBullets.length === 0) {
        errors.push({
          line: rfh.lineNumber,
          rule: 'rf-sin-criterios',
          message: `'${rfh.text}' no contiene criterios observables redactados con viñetas.`,
          expected: '- Cuando <evento>, el sistema debe <resultado>',
          found: 'Sin viñetas de criterios',
          snippet: parsed.getSnippet ? parsed.getSnippet(rfh.lineNumber) : undefined,
          suggestion: "Agrega viñetas con criterios observables: '- Cuando <evento>, el sistema debe <resultado>'.",
        });
      } else {
        const hasEars = rfBullets.some((b) =>
          /\b(siempre|cuando|si|debe|while|when|if|shall|always)\b/i.test(b.trimmed)
        );
        if (!hasEars) {
          errors.push({
            line: rfh.lineNumber,
            rule: 'rf-sintaxis-ears-faltante',
            message: `'${rfh.text}' no contiene criterios redactados bajo sintaxis EARS ('Siempre', 'Cuando', 'Si', 'debe').`,
            expected: 'Viñeta con sintaxis EARS (Siempre / Cuando / Si / debe)',
            found: rfBullets.map((b) => b.trimmed).join('; '),
            snippet: parsed.getSnippet ? parsed.getSnippet(rfh.lineNumber) : undefined,
            suggestion: "Reformula el criterio usando sintaxis EARS: '- Cuando <acción>, el sistema debe <resultado observable>'.",
          });
        }
      }
    }

    // Validar presencia de Example Mapping como oráculo TDD en Requisitos Funcionales
    // Tolera tanto viñetas (- **Ejemplo concreto:**) como tablas markdown de Example Mapping
    const hasExampleMapping = rfHeadings.some((rfh) => {
      const rfStartIndex = parsed.lines.findIndex((l) => l.lineNumber === rfh.lineNumber);
      const nextHIndex = parsed.lines.findIndex(
        (l, idx) =>
          idx > rfStartIndex &&
          !l.inCodeBlock &&
          /^#{1,3}\s+/.test(l.trimmed)
      );
      const rfLines = parsed.lines.slice(
        rfStartIndex + 1,
        nextHIndex !== -1 ? nextHIndex : parsed.lines.length
      );

      // Forma 1: Viñeta con formato flexible
      const hasBulletExample = rfLines.some((l) =>
        /^\s*[-*]\s+\*\*ejemplo\s+(?:concreto)?(?:\*\*:?|:?\*\*)/i.test(l.trimmed)
      );
      if (hasBulletExample) return true;

      // Forma 2: Tabla markdown con columnas de Ejemplo / Entrada / Salida
      const tableLines = rfLines.filter((l) => /^\s*\|.*\|\s*$/.test(l.trimmed));
      if (tableLines.length >= 2) {
        const fullTableText = tableLines.map((l) => l.trimmed || l.text || '').join(' ');
        const normTable = normalizeText(fullTableText);
        const hasInput = /entrada|input|escenario|ejemplo|caso|given|when/i.test(normTable);
        const hasOutput = /salida|resultado|output|esperado|expected|respuesta|then/i.test(normTable);
        if (hasInput && hasOutput) return true;
      }
      return false;
    });

    if (!hasExampleMapping) {
      errors.push({
        line: rfSection.lineNumber,
        rule: 'spec-example-mapping-faltante',
        message: "En '## Requisitos funcionales', al menos un requisito debe contener un ejemplo concreto ('- **Ejemplo concreto:** Entrada: ... → Resultado observable: ...') que actúe como oráculo independiente para las pruebas TDD.",
        expected: '- **Ejemplo concreto:** Entrada: <valor> → Resultado observable: <salida>',
        found: 'Sin viñetas de ejemplo concreto en requisitos funcionales',
        snippet: parsed.getSnippet ? parsed.getSnippet(rfSection.lineNumber) : undefined,
        suggestion: "Agrega debajo de al menos un RF: '- **Ejemplo concreto:** Entrada: <datos> → Resultado observable: <salida>'.",
      });
    }
  }

  // 5. Validación estricta de Criterios de Finalización (- Se puede comprobar que:)
  const criteriosSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text) === 'criterios de finalizacion'
  );
  if (criteriosSection) {
    const contentLines = criteriosSection.lines.filter((l) => l.trimmed.length > 0);
    const allBullets = contentLines.filter((l) => /^\s*[-*]\s+/.test(l.text));

    if (allBullets.length === 0) {
      errors.push({
        line: criteriosSection.lineNumber,
        rule: 'criterios-sin-vinetas',
        message: "La sección '## Criterios de finalización' debe contener al menos una viñeta iniciando con '- Se puede comprobar que:'.",
        expected: '- Se puede comprobar que: <condición observable>',
        found: 'Sin viñetas',
        snippet: parsed.getSnippet ? parsed.getSnippet(criteriosSection.lineNumber) : undefined,
        suggestion: "Agrega viñetas iniciando con: '- Se puede comprobar que: <condición observable>'.",
      });
    } else {
      const minIndent = Math.min(...allBullets.map((b) => b.text.match(/^(\s*)/)[1].length));
      const topLevelBullets = allBullets.filter((b) => b.text.match(/^(\s*)/)[1].length <= minIndent + 1);

      for (const bullet of topLevelBullets) {
        if (!/^\s*[-*]\s+Se puede comprobar que:?\s*\S+/i.test(bullet.text.replace(/\\/g, ''))) {
          errors.push({
            line: bullet.lineNumber,
            rule: 'criterio-finalizacion-prefijo-estricto',
            message: `En '## Criterios de finalización', cada viñeta principal debe comenzar estrictamente con '- Se puede comprobar que:'.`,
            expected: `- Se puede comprobar que: ...`,
            found: bullet.trimmed,
            snippet: parsed.getSnippet ? parsed.getSnippet(bullet.lineNumber) : undefined,
            suggestion: `Inicia la viñeta con el prefijo exacto: '- Se puede comprobar que: ${bullet.trimmed.replace(/^[-*]\s+/, '')}'.`,
          });
        }
      }
    }
  }

  // 6. Validación de Decisiones y alternativas descartadas (si existe en spec.md)
  const adrSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text).includes('decisiones y alternativas descartadas')
  );
  if (adrSection) {
    const contentLines = adrSection.lines.filter((l) => l.trimmed.length > 0);
    const isVacio = contentLines.some((l) =>
      /ningun[ao]/i.test(l.trimmed)
    );
    if (!isVacio && contentLines.length > 0) {
      const bullets = contentLines.filter((l) => /^\s*[-*]\s+/.test(l.trimmed));
      if (bullets.length === 0) {
        errors.push({
          line: adrSection.lineNumber,
          rule: 'spec-decisiones-formato-invalido',
          message: "En '## Decisiones y alternativas descartadas', debe registrarse 'Ninguna.' o una lista de alternativas descartadas estructuradas.",
          expected: '- **Alternativa descartada:** <enfoque>',
          found: contentLines[0].trimmed,
          snippet: parsed.getSnippet ? parsed.getSnippet(adrSection.lineNumber) : undefined,
          suggestion: "Estructura la alternativa como: '- **Alternativa descartada:** <enfoque>' o escribe 'Ninguna.' si no hay alternativas.",
        });
      } else {
        const minIndent = Math.min(...bullets.map((b) => b.text.match(/^(\s*)/)[1].length));
        const topLevelBullets = bullets.filter((b) => b.text.match(/^(\s*)/)[1].length <= minIndent + 1);

        for (const bullet of topLevelBullets) {
          if (!/^\s*[-*]\s+\*\*alternativas?\s+descartadas?:?\*\*:?/i.test(bullet.trimmed)) {
            errors.push({
              line: bullet.lineNumber,
              rule: 'spec-decisiones-formato-invalido',
              message: "En '## Decisiones y alternativas descartadas', cada alternativa debe comenzar con '- **Alternativa descartada:** <enfoque>' y contener '• Por qué se descarta: <justificación>'.",
              expected: '- **Alternativa descartada:** <enfoque>',
              found: bullet.trimmed,
              snippet: parsed.getSnippet ? parsed.getSnippet(bullet.lineNumber) : undefined,
              suggestion: `Reescribe la viñeta iniciando con: '- **Alternativa descartada:** ${bullet.trimmed.replace(/^[-*]\s+/, '')}'.`,
            });
          }
        }
      }
    }
  }

  // 7. Validación de Límites y exclusiones (Non-Goals y Anti-Goals)
  const limitesSection = parsed.headings.find((h) => {
    if (h.level !== 2) return false;
    const norm = normalizeText(h.text);
    return norm === 'limites y exclusiones' || norm.startsWith('limites y exclusiones');
  });
  if (limitesSection) {
    const hasNonGoals = parsed.headings.some(
      (h) =>
        h.level === 3 &&
        (normalizeText(h.text).includes('non-goals') ||
         normalizeText(h.text).includes('fuera de alcance'))
    );
    const hasAntiGoals = parsed.headings.some(
      (h) =>
        h.level === 3 &&
        (normalizeText(h.text).includes('anti-goals') ||
         normalizeText(h.text).includes('anti-objetivos') ||
         normalizeText(h.text).includes('invariantes'))
    );
    if (!hasNonGoals) {
      errors.push({
        line: limitesSection.lineNumber,
        rule: 'spec-non-goals-faltante',
        message: "En '## Límites y exclusiones', falta la subsección obligatoria '### Fuera de alcance (Non-Goals)'.",
        expected: '### Fuera de alcance (Non-Goals)',
        found: 'Subsección ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(limitesSection.lineNumber) : undefined,
        suggestion: "Agrega debajo de '## Límites y exclusiones': '### Fuera de alcance (Non-Goals)'.",
      });
    }
    if (!hasAntiGoals) {
      errors.push({
        line: limitesSection.lineNumber,
        rule: 'spec-anti-goals-faltante',
        message: "En '## Límites y exclusiones', falta la subsección obligatoria '### Anti-objetivos e invariantes prohibidas (Anti-Goals)'.",
        expected: '### Anti-objetivos e invariantes prohibidas (Anti-Goals)',
        found: 'Subsección ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(limitesSection.lineNumber) : undefined,
        suggestion: "Agrega debajo de '## Límites y exclusiones': '### Anti-objetivos e invariantes prohibidas (Anti-Goals)'.",
      });
    }
  }
}

/**
 * Validador para plan.md
 */
function validatePlan(parsed, errors, warnings) {
  // 1. Título H1
  const h1 = parsed.headings.find((h) => h.level === 1);
  if (!h1 || !/^Plan\b/i.test(h1.text)) {
    errors.push({
      line: h1 ? h1.lineNumber : 1,
      rule: 'titulo-h1-plan-requerido',
      message: "El título principal debe iniciar con '# Plan <nnn> <Nombre>'.",
      expected: '# Plan <nnn> <Nombre>',
      found: h1 ? h1.text : 'Sin título',
      snippet: parsed.getSnippet ? parsed.getSnippet(h1 ? h1.lineNumber : 1) : undefined,
      suggestion: "Asegúrate de que la primera línea comience con: '# Plan 001 <Nombre>'.",
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    const targetLine = h1 ? h1.lineNumber + 1 : 2;
    errors.push({
      line: targetLine,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: <en-revision | listo-para-tareas>'.",
      expected: 'Estado: en-revision o Estado: listo-para-tareas',
      found: 'No declarada',
      snippet: parsed.getSnippet ? parsed.getSnippet(targetLine) : undefined,
      suggestion: "Declara debajo del título: 'Estado: en-revision' o 'Estado: listo-para-tareas'.",
    });
  } else {
    const match = estadoLine.trimmed.match(/^\s*Estado:\s*([a-zA-Z0-9_-]+)/i);
    const estadoVal = match[1].toLowerCase();
    if (estadoVal === 'cancelado') {
      errors.length = 0;
      warnings.length = 0;
      return { errors, warnings };
    }
    if (estadoVal !== 'en-revision' && estadoVal !== 'listo-para-tareas') {
      errors.push({
        line: estadoLine.lineNumber,
        rule: 'estado-invalido',
        message: `Estado '${estadoVal}' no es válido para plan.md. Debe ser 'en-revision' o 'listo-para-tareas'.`,
        expected: 'Estado: en-revision o Estado: listo-para-tareas',
        found: estadoLine.trimmed,
        snippet: parsed.getSnippet ? parsed.getSnippet(estadoLine.lineNumber) : undefined,
        suggestion: "Cambia el estado a 'Estado: en-revision' o 'Estado: listo-para-tareas'.",
      });
    }
  }

  // 3. Trazabilidad requerida: Idea y Spec
  const hasIdeaRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Idea:\s*\S+/i.test(l.trimmed));
  const hasSpecRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Spec:\s*\S+/i.test(l.trimmed));
  if (!hasIdeaRef || !hasSpecRef) {
    const targetLine = h1 ? h1.lineNumber + 2 : 3;
    errors.push({
      line: targetLine,
      rule: 'referencias-origen-requeridas',
      message: "plan.md debe incluir referencias de trazabilidad 'Idea: <ruta>' y 'Spec: <ruta>'.",
      expected: "Idea: '<ruta>/idea.md' y Spec: '<ruta>/spec.md'",
      found: `Idea: ${hasIdeaRef ? 'OK' : 'FALTA'}, Spec: ${hasSpecRef ? 'OK' : 'FALTA'}`,
      snippet: parsed.getSnippet ? parsed.getSnippet(targetLine) : undefined,
      suggestion: "Declara las rutas de trazabilidad: 'Idea: `001-slug/idea.md`' y 'Spec: `001-slug/spec.md`'.",
    });
  }

  // 4. Secciones Obligatorias del Contrato Mínimo Viable
  const requiredH2 = [
    { key: 'módulos y arquitectura', title: 'Módulos y arquitectura' },
    {
      key: 'prerrequisitos y validaciones previas',
      title: 'Prerrequisitos y validaciones previas (Spikes)',
      accepted: [
        'prerrequisitos y validaciones previas (spikes)',
        'prerrequisitos y validaciones previas',
      ],
    },
    { key: 'árbol de cambios', title: 'Árbol de cambios', accepted: ['arbol de cambios'] },
    { key: 'estrategia de tests', title: 'Estrategia de tests' },
    { key: 'cobertura rf / rnf', title: 'Cobertura RF / RNF' },
    { key: 'decisiones técnicas', title: 'Decisiones técnicas' },
  ];

  for (const req of requiredH2) {
    const found = parsed.headings.find((h) => {
      if (h.level !== 2) return false;
      const normH = normalizeText(h.text);
      if (req.accepted) {
        return req.accepted.includes(normH);
      }
      return normH === normalizeText(req.title) || normH === normalizeText(req.key);
    });
    if (!found) {
      const aliasFound = findHeadingByAlias(parsed.headings, 2, req.key);
      if (aliasFound && aliasFound.aliasUsed) {
        errors.push({
          line: aliasFound.match.lineNumber,
          rule: 'seccion-mal-nombrada',
          message: `Falta la sección obligatoria '## ${req.title}'. Se detectó '## ${aliasFound.aliasUsed}'. Usa el encabezado estándar para cumplir con el contrato.`,
          expected: `## ${req.title}`,
          found: `## ${aliasFound.aliasUsed}`,
          snippet: parsed.getSnippet ? parsed.getSnippet(aliasFound.match.lineNumber) : undefined,
          suggestion: `Renombra '## ${aliasFound.aliasUsed}' por '## ${req.title}'.`,
        });
      } else {
        const insertionLine = parsed.calculateInsertionLine
          ? parsed.calculateInsertionLine(req.key, requiredH2)
          : 1;
        errors.push({
          line: insertionLine,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en plan.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
          snippet: parsed.getSnippet ? parsed.getSnippet(insertionLine) : undefined,
          suggestion: `Inserta la sección obligatoria '## ${req.title}'.`,
        });
      }
    }
  }

  // 5. Validación estricta del Árbol de Cambios (prefijos +, ~, -)
  const arbolSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text) === 'arbol de cambios'
  );
  if (arbolSection) {
    const contentLines = arbolSection.lines.filter((l) => l.trimmed.length > 0);
    const allBullets = contentLines.filter((l) => /^\s*[-*]\s+/.test(l.text));

    if (allBullets.length === 0) {
      errors.push({
        line: arbolSection.lineNumber,
        rule: 'arbol-sin-archivos',
        message: "La sección '## Árbol de cambios' debe contener al menos un archivo con prefijo '+ ', '~ ' o '- '.",
        expected: "- `+ ruta/archivo.ext` o - `~ ruta/archivo.ext`",
        found: 'Sin archivos declarados',
        snippet: parsed.getSnippet ? parsed.getSnippet(arbolSection.lineNumber) : undefined,
        suggestion: "Agrega los archivos a tocar con su acción: '- `+ ruta/archivo`' (crear), '- `~ ruta/archivo`' (modificar), '- `- ruta/archivo`' (eliminar).",
      });
    } else {
      const minIndent = Math.min(...allBullets.map((b) => b.text.match(/^(\s*)/)[1].length));
      const topLevelBullets = allBullets.filter((b) => b.text.match(/^(\s*)/)[1].length <= minIndent + 1);

      for (const bullet of topLevelBullets) {
        const cleanedBulletText = bullet.text.replace(/\\/g, '');
        const hasValidPrefix = /^\s*[-*]\s+[`'"]?[+~-][\s`'"]\s*\S+/.test(cleanedBulletText);
        if (!hasValidPrefix) {
          errors.push({
            line: bullet.lineNumber,
            rule: 'arbol-prefijo-invalido',
            message: `En '## Árbol de cambios', cada archivo debe tener prefijo '+ ' (nuevo), '~ ' (modificado) o '- ' (eliminado).`,
            expected: "- `+ ruta/archivo` o - `~ ruta/archivo`",
            found: bullet.trimmed,
            snippet: parsed.getSnippet ? parsed.getSnippet(bullet.lineNumber) : undefined,
            suggestion: `Agrega el prefijo de acción: '- \`+ ${bullet.trimmed.replace(/^[-*]\s+/, '')}\`' (crear) o '- \`~ ${bullet.trimmed.replace(/^[-*]\s+/, '')}\`' (modificar).`,
          });
        }
      }
    }
  }

  // 6. Validación de Cobertura RF / RNF (tabla markdown)
  const coberturaSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text) === 'cobertura rf / rnf'
  );
  if (coberturaSection) {
    const tableHeader = coberturaSection.lines.find((l) =>
      /^\s*\|\s*(ID|RF|Requisito)/i.test(l.trimmed)
    );
    if (!tableHeader) {
      errors.push({
        line: coberturaSection.lineNumber,
        rule: 'cobertura-sin-tabla',
        message: "La sección '## Cobertura RF / RNF' debe contener una tabla markdown con encabezado '| ID | Dónde se resuelve ... |'.",
        expected: '| ID | Dónde se resuelve |',
        found: 'Tabla no encontrada',
        snippet: parsed.getSnippet ? parsed.getSnippet(coberturaSection.lineNumber) : undefined,
        suggestion: "Inserta la tabla de cobertura:\n| ID | Dónde se resuelve (Módulo, DT, Tests) |\n| :--- | :--- |\n| RF-01 | ... |",
      });
    }
  }

  // 6b. Validación de Estrategia de tests: Paseo de Verificación Manual (Golden Path Walkthrough)
  const testsSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text) === 'estrategia de tests'
  );
  if (testsSection) {
    const hasGoldenPathH3 = parsed.headings.some(
      (h) =>
        h.level === 3 &&
        (normalizeText(h.text).includes('paseo de verificacion manual') ||
         normalizeText(h.text).includes('golden path'))
    );
    const contentLines = testsSection.lines.filter((l) => l.trimmed.length > 0);
    const hasNoAplica = contentLines.some((l) =>
      /no\s+aplica/i.test(l.trimmed)
    );

    if (!hasGoldenPathH3 && !hasNoAplica) {
      errors.push({
        line: testsSection.lineNumber,
        rule: 'plan-golden-path-faltante',
        message: "En '## Estrategia de tests', debe incluirse la subsección '### Paseo de Verificación Manual (Golden Path Walkthrough)' con pasos de humo (≤ 2 min), o registrar explícitamente 'No aplica (cambio 100% interno cubierto por pruebas automatizadas)'.",
        expected: '### Paseo de Verificación Manual (Golden Path Walkthrough) o No aplica',
        found: 'Subsección de Golden Path ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(testsSection.lineNumber) : undefined,
        suggestion: "Agrega '### Paseo de Verificación Manual (Golden Path Walkthrough)' o registra 'No aplica'.",
      });
    }
  }

  // 7. Validación de Decisiones Técnicas (campos obligatorios en DT-xx)
  const dtHeadings = parsed.headings.filter(
    (h) => h.level === 3 && /^DT-?\d+/i.test(h.text)
  );
  for (const dth of dtHeadings) {
    const dtStartIndex = parsed.lines.findIndex(
      (l) => l.lineNumber === dth.lineNumber
    );
    const nextHeadingIndex = parsed.lines.findIndex(
      (l, idx) =>
        idx > dtStartIndex &&
        !l.inCodeBlock &&
        /^#{1,3}\s+/.test(l.trimmed)
    );
    const dtLines = parsed.lines.slice(
      dtStartIndex,
      nextHeadingIndex !== -1 ? nextHeadingIndex : parsed.lines.length
    );

    const hasDecision = dtLines.some((l) =>
      normalizeText(l.trimmed).includes('decision')
    );
    const hasBestOption = dtLines.some((l) => {
      const norm = normalizeText(l.trimmed);
      return (
        norm.includes('por que es la mejor opcion') ||
        norm.includes('mejor opcion actual') ||
        norm.includes('por que es la mejor opcion actual') ||
        norm.includes('justificacion de la eleccion') ||
        norm.includes('por que se eligio esta opcion')
      );
    });
    const hasAlternative = dtLines.some((l) => {
      const norm = normalizeText(l.trimmed);
      return (
        norm.includes('alternativa descartada') ||
        norm.includes('alternativas descartadas')
      );
    });
    const hasWhyDiscarded = dtLines.some((l) => {
      const norm = normalizeText(l.trimmed);
      return (
        norm.includes('por que se descarta') ||
        norm.includes('por que se descarto') ||
        norm.includes('motivo de descarte')
      );
    });

    if (!hasDecision) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-decision-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Decisión:**'.`,
        expected: '- **Decisión:** <enfoque>',
        found: 'Campo ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(dth.lineNumber) : undefined,
        suggestion: "Agrega debajo del DT: '- **Decisión:** <enfoque técnico elegido>'.",
      });
    }
    if (!hasBestOption) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-mejor-opcion-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Por qué es la mejor opción:**'.`,
        expected: '- **Por qué es la mejor opción:** <justificación>',
        found: 'Campo ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(dth.lineNumber) : undefined,
        suggestion: "Agrega debajo de la decisión: '- **Por qué es la mejor opción actual:** <justificación técnica>'.",
      });
    }
    if (!hasAlternative) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-alternativa-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Alternativa descartada:**'.`,
        expected: '- **Alternativa descartada:** <enfoque alternativo>',
        found: 'Campo ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(dth.lineNumber) : undefined,
        suggestion: "Agrega la alternativa descartada: '- **Alternativa descartada:** <otro enfoque considerado>'.",
      });
    }
    if (!hasWhyDiscarded) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-por-que-descarta-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Por qué se descarta:**'.`,
        expected: '- **Por qué se descarta:** <motivo técnico>',
        found: 'Campo ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(dth.lineNumber) : undefined,
        suggestion: "Agrega el motivo de descarte: '- **Por qué se descarta:** <trade-off o motivo técnico>'.",
      });
    }
  }
}

/**
 * Validador para tasks.md
 */
function validateTasks(parsed, errors, warnings, filePath = 'tasks.md', options = {}) {
  // 1. Título H1
  const h1 = parsed.headings.find((h) => h.level === 1);
  if (!h1 || !/^(Tareas|Tasks)\b/i.test(h1.text)) {
    errors.push({
      line: h1 ? h1.lineNumber : 1,
      rule: 'titulo-h1-tasks-requerido',
      message: "El título principal debe iniciar con '# Tareas <nnn> <Nombre>'.",
      expected: '# Tareas <nnn> <Nombre>',
      found: h1 ? h1.text : 'Sin título',
      snippet: parsed.getSnippet ? parsed.getSnippet(h1 ? h1.lineNumber : 1) : undefined,
      suggestion: "Asegúrate de que la primera línea comience con: '# Tareas 001 <Nombre>'.",
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    const targetLine = h1 ? h1.lineNumber + 1 : 2;
    errors.push({
      line: targetLine,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: <en-revision | listo-para-aplicar | listo-para-verify | completado>'.",
      expected: 'Estado: listo-para-aplicar',
      found: 'No declarada',
      snippet: parsed.getSnippet ? parsed.getSnippet(targetLine) : undefined,
      suggestion: "Declara debajo del título: 'Estado: listo-para-aplicar'.",
    });
  } else {
    const match = estadoLine.trimmed.match(/^\s*Estado:\s*([a-zA-Z0-9_-]+)/i);
    const estadoVal = match[1].toLowerCase();
    if (estadoVal === 'cancelado') {
      errors.length = 0;
      warnings.length = 0;
      return { errors, warnings };
    }
    const validStates = ['en-revision', 'listo-para-aplicar', 'listo-para-verify', 'completado'];
    if (!validStates.includes(estadoVal)) {
      errors.push({
        line: estadoLine.lineNumber,
        rule: 'estado-invalido',
        message: `Estado '${estadoVal}' no es válido para tasks.md. Debe ser uno de: ${validStates.join(', ')}.`,
        expected: 'Estado: listo-para-aplicar',
        found: estadoLine.trimmed,
        snippet: parsed.getSnippet ? parsed.getSnippet(estadoLine.lineNumber) : undefined,
        suggestion: `Cambia el estado a uno válido: ${validStates.join(', ')}.`,
      });
    }
  }

  // 3. Trazabilidad requerida: Idea y Plan
  const hasIdeaRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Idea:\s*\S+/i.test(l.trimmed));
  const hasPlanRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Plan:\s*\S+/i.test(l.trimmed));
  if (!hasIdeaRef || !hasPlanRef) {
    const targetLine = h1 ? h1.lineNumber + 2 : 3;
    errors.push({
      line: targetLine,
      rule: 'referencias-origen-requeridas',
      message: "tasks.md debe incluir referencias de trazabilidad 'Idea: <ruta>' y 'Plan: <ruta>'.",
      expected: "Idea: '<ruta>/idea.md' y Plan: '<ruta>/plan.md'",
      found: `Idea: ${hasIdeaRef ? 'OK' : 'FALTA'}, Plan: ${hasPlanRef ? 'OK' : 'FALTA'}`,
      snippet: parsed.getSnippet ? parsed.getSnippet(targetLine) : undefined,
      suggestion: "Declara las referencias: 'Idea: `001-slug/idea.md`' y 'Plan: `001-slug/plan.md`'.",
    });
  }

  // 4. Secciones Obligatorias del Contrato Mínimo Viable
  const requiredH2 = [
    { key: 'reglas de ejecución', title: 'Reglas de ejecución' },
    { key: 'fuera de este corte', title: 'Fuera de este corte' },
    { key: 'dudas abiertas', title: 'Dudas abiertas' },
  ];

  for (const req of requiredH2) {
    const found = parsed.headings.find(
      (h) => h.level === 2 && normalizeText(h.text) === normalizeText(req.title)
    );
    if (!found) {
      const aliasFound = findHeadingByAlias(parsed.headings, 2, req.key);
      if (aliasFound && aliasFound.aliasUsed) {
        errors.push({
          line: aliasFound.match.lineNumber,
          rule: 'seccion-mal-nombrada',
          message: `Falta la sección obligatoria '## ${req.title}'. Se detectó '## ${aliasFound.aliasUsed}'. Usa el encabezado estándar para cumplir con el contrato.`,
          expected: `## ${req.title}`,
          found: `## ${aliasFound.aliasUsed}`,
          snippet: parsed.getSnippet ? parsed.getSnippet(aliasFound.match.lineNumber) : undefined,
          suggestion: `Renombra '## ${aliasFound.aliasUsed}' por '## ${req.title}'.`,
        });
      } else {
        const insertionLine = parsed.calculateInsertionLine
          ? parsed.calculateInsertionLine(req.key, requiredH2)
          : 1;
        errors.push({
          line: insertionLine,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en tasks.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
          snippet: parsed.getSnippet ? parsed.getSnippet(insertionLine) : undefined,
          suggestion: `Inserta la sección obligatoria '## ${req.title}'.`,
        });
      }
    }
  }

  // 4. Debe contener al menos una Fase H2
  const faseHeadings = parsed.headings.filter(
    (h) => h.level === 2 && /^Fase\s+\d+/i.test(h.text)
  );

  if (faseHeadings.length === 0) {
    errors.push({
      line: 1,
      rule: 'fase-requerida',
      message: "tasks.md debe contener al menos una sección de fase '## Fase 1: <Nombre>'.",
      expected: '## Fase 1: <Nombre>',
      found: 'Sin secciones de Fase',
      snippet: parsed.getSnippet ? parsed.getSnippet(1) : undefined,
      suggestion: "Agrega al menos una fase de tareas: '## Fase 1: Core Vertical Slice'.",
    });
  }

  // 5. Validación de tareas individuales
  const taskLines = parsed.lines.filter((l) =>
    /^\s*[-*]\s*\[\s*[xX ]\s*\]\s*(?:\*\*)?TASK-(\d+)/i.test(l.trimmed)
  );

  if (taskLines.length === 0) {
    errors.push({
      line: 1,
      rule: 'tasks-sin-tareas',
      message: "tasks.md debe contener al menos una tarea con formato '- [ ] **TASK-01: <título>**'.",
      expected: '- [ ] **TASK-01: Título de la tarea**',
      found: 'Sin tareas detectadas',
      snippet: parsed.getSnippet ? parsed.getSnippet(1) : undefined,
      suggestion: "Agrega tareas con formato: '- [ ] **TASK-01: <título de la rebanada vertical>**'.",
    });
  }

  for (const tl of taskLines) {
    const durationMatch = tl.trimmed.match(/\(\s*\d+\s*(?:-\s*\d+)?\s*(?:min(?:utos)?|horas?)\s*\)/i);
    if (durationMatch) {
      errors.push({
        line: tl.lineNumber,
        rule: 'task-duracion-ficticia-prohibida',
        message: `La tarea en línea ${tl.lineNumber} contiene una estimación de tiempo ficticia '${durationMatch[0]}'. VSDD exige Slicing Vertical estricto basado en comportamiento atómico comprobable, no en minutos o cronómetros de reloj.`,
        expected: '- [ ] **TASK-xx: <título descriptivo de la rebanada vertical>**',
        found: tl.trimmed,
        snippet: parsed.getSnippet ? parsed.getSnippet(tl.lineNumber) : undefined,
        suggestion: `Elimina '${durationMatch[0]}' del título de la tarea. VSDD evalúa comportamiento atómico, no duración estimada.`,
      });
    }

    // Validar campo obligatorio Test primero (TDD)
    const taskStartIndex = parsed.lines.findIndex((l) => l.lineNumber === tl.lineNumber);
    const nextTaskIndex = parsed.lines.findIndex(
      (l, idx) =>
        idx > taskStartIndex &&
        !l.inCodeBlock &&
        (/^\s*[-*]\s*\[\s*[xX ]\s*\]\s*(?:\*\*)?TASK-/i.test(l.trimmed) ||
         /^#{1,3}\s+/.test(l.trimmed))
    );
    const taskBlockLines = parsed.lines.slice(
      taskStartIndex + 1,
      nextTaskIndex !== -1 ? nextTaskIndex : parsed.lines.length
    );

    const hasTddField = taskBlockLines.some((l) => {
      const norm = normalizeText(l.trimmed);
      return norm.includes('test primero') || norm.includes('prueba primero');
    });
    if (!hasTddField) {
      errors.push({
        line: tl.lineNumber,
        rule: 'task-tdd-faltante',
        message: `La tarea en línea ${tl.lineNumber} no contiene el campo obligatorio '- **Test primero (TDD):**'.`,
        expected: '- **Test primero (TDD):** <especificación de la prueba>',
        found: 'Campo TDD ausente',
        snippet: parsed.getSnippet ? parsed.getSnippet(tl.lineNumber) : undefined,
        suggestion: "Agrega dentro de la tarea: '- **Test primero (TDD):** <suite o archivo de prueba que falla>'.",
      });
    }

    // Validar frontera de código puro: rechazar tareas explícitamente manuales
    let violatingLine = null;
    const isManualTitle =
      /(?:probar|verificar|testear)\s+(?:manualmente|a\s+mano)|(?:hacer\s+)?spike|(?:investigar|probar)\s+(?:alternativas|librer[ií]a|api|viabilidad)/i.test(
        tl.trimmed
      );

    if (isManualTitle) {
      violatingLine = tl;
    } else {
      const tddLine = taskBlockLines.find((l) => {
        const norm = normalizeText(l.trimmed);
        return norm.includes('test primero') || norm.includes('prueba primero');
      });
      if (tddLine) {
        const hasManualPhrase = /(?:probar|verificar|testear)\s+(?:manualmente|a\s+mano)/i.test(tddLine.trimmed);
        const tddClean = tddLine.trimmed.replace(/[*_`]/g, '');
        const tddValue = tddClean.replace(/^[^:]*:\s*/, '').trim();
        const hasBypassWord = /^(?:no\s+aplica|manual|a\s+mano|ningun[oa]|no\s+requiere|n\s*\/?\s*a)\b/i.test(tddValue);
        if (hasManualPhrase || hasBypassWord) {
          violatingLine = tddLine;
        }
      }
    }

    if (violatingLine) {
      errors.push({
        line: violatingLine.lineNumber,
        rule: 'task-no-automatizable',
        message: `La tarea en línea ${violatingLine.lineNumber} indica pruebas o verificación manual. tasks.md está reservado para código puro y pruebas automatizadas con TDD. Los spikes o pruebas manuales exploratorias deben resolverse en plan.md; las pruebas de humo finales pertenecen al Golden Path de verify.md.`,
        expected: '- **Test primero (TDD):** <prueba automatizada unitaria o de integración>',
        found: violatingLine.trimmed,
        snippet: parsed.getSnippet ? parsed.getSnippet(violatingLine.lineNumber) : undefined,
        suggestion: "Reemplaza la verificación manual por una prueba automatizada con TDD.",
      });
    }
  }

  // 6. Validación de Controles de Fase
  for (const fh of faseHeadings) {
    const faseNumMatch = fh.text.match(/^Fase\s+(\d+)/i);
    if (faseNumMatch) {
      const fNum = faseNumMatch[1];
      const hasControl = parsed.headings.some(
        (h) =>
          h.level === 3 &&
          new RegExp(`^Control de Fase\\s+${fNum}\\b`, 'i').test(h.text)
      );
      if (!hasControl) {
        errors.push({
          line: fh.lineNumber,
          rule: 'control-de-fase-faltante',
          message: `La sección '${fh.text}' no contiene su subsección obligatoria '### Control de Fase ${fNum}'.`,
          expected: `### Control de Fase ${fNum}`,
          found: 'Subsección de control ausente',
          snippet: parsed.getSnippet ? parsed.getSnippet(fh.lineNumber) : undefined,
          suggestion: `Agrega al final de la fase: '### Control de Fase ${fNum}' con sus checkboxes de auditoría y commit.`,
        });
      }
    }
  }

  // 7. Trazabilidad cruzada determinista con spec.md y plan.md (Cross-Artifact Linker)
  const featureDir = filePath ? path.dirname(filePath) : '.';
  validateCrossArtifactTraceability(parsed, featureDir, errors, warnings, options);
}

module.exports = {
  validateIdea,
  validateSpec,
  validatePlan,
  validateTasks,
};
