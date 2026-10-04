#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Diccionario de alias y sinónimos para detectar secciones mal nombradas
 */
const SECTION_ALIASES = {
  'casos límite': [
    'casos limite',
    'casos de borde',
    'casos excepcionales',
    'casos borde',
    'edge cases',
    'casos extremos',
  ],
  'criterios de finalización': [
    'criterios de finalizacion',
    'criterios de aceptacion',
    'criterios de éxito',
    'criterios de exito',
    'acceptance criteria',
    'criterios de aceptacion de la entrega',
  ],
  'árbol de cambios': [
    'arbol de cambios',
    'arbol de archivos',
    'archivos a modificar',
    'archivos modificados',
    'file tree',
    'mapa de archivos',
  ],
  'cobertura rf / rnf': [
    'cobertura rf / rnf',
    'cobertura rf/rnf',
    'cobertura',
    'matriz de cobertura',
    'tabla de cobertura',
    'cobertura de requisitos',
  ],
  'decisiones técnicas': [
    'decisiones tecnicas',
    'decisiones tecnicas y arquitectura',
    'decisiones arquitectonicas',
    'technical decisions',
  ],
  'requisitos funcionales': [
    'requisitos funcionales',
    'rf',
    'functional requirements',
  ],
  'requisitos no funcionales': [
    'requisitos no funcionales',
    'rnf',
    'non-functional requirements',
  ],
  'módulos y arquitectura': [
    'modulos y arquitectura',
    'modulos',
    'arquitectura de modulos',
    'arquitectura',
    'componentes',
  ],
  'estrategia de tests': [
    'estrategia de tests',
    'estrategia de pruebas',
    'plan de pruebas',
    'test strategy',
    'estrategia de testing',
  ],
  'reglas de ejecución': [
    'reglas de ejecucion',
    'reglas',
    'principios de ejecucion',
    'execution rules',
  ],
  'prerrequisitos y validaciones previas': [
    'prerrequisitos y validaciones previas (spikes)',
    'prerrequisitos y validaciones previas',
    'prerrequisitos',
    'spikes y prerrequisitos',
    'spikes',
  ],
  'fuera de alcance': [
    'fuera de alcance',
    'límites y exclusiones',
    'limites y exclusiones',
    'non-goals',
    'non goals',
    'exclusiones',
    'alcance negativo',
    'límites',
    'limites',
  ],
};

/**
 * Normaliza una cadena para comparaciones insensibles a acentos y mayúsculas
 */
function normalizeText(text) {
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
  const rawLines = content.split(/\r?\n/);
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
        const headingText = headingMatch[2].trim();
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

/**
 * Valida la higiene sintáctica universal (sin placeholders ni marcadores de plantilla)
 */
function validateUniversalHygiene(parsed, errors) {
  // 1. Bloque de código sin cerrar
  if (parsed.unclosedCodeBlock) {
    errors.push({
      line: parsed.unclosedCodeBlock,
      rule: 'codigo-sin-cerrar',
      message: `Bloque de código abierto en línea ${parsed.unclosedCodeBlock} que no fue cerrado con triples comillas (\`\`\`).`,
      expected: 'Bloque de código cerrado con ```',
      found: 'Bloque sin cerrar al final del archivo',
    });
  }

  // 2. Marcadores de instrucción residuales de las plantillas
  const templateInstructionRegex = /\*\*(Llenar|Forma|Vacío|Vacio):\*\*/i;
  // 3. Placeholders angulares específicos sin resolver
  const unreplacedPlaceholderRegex =
    /<(?:en-revision\s*\|\s*listo-para-[a-z]+|listo-para-[a-z]+|nnn|slug|Nombre de la funcionalidad|tipo\(alcance\)|cualidad de experiencia|condición observable|condicion observable|rol o tipo de usuario|acción permitida|accion permitida|acción restringida|accion restringida|acción o capacidad|accion o capacidad|beneficio o valor esperado|Verbo en infinitivo[^>]*|evento|estado|situación errónea|situacion erronea|daño o acción indebida|daño o accion indebida|mensaje o protección visible|mensaje o proteccion visible|valor o acción de prueba|valor o accion de prueba|valor de prueba|salida visible o confirmación|salida visible o confirmacion|salida observable|salida visible|salida esperada|qué ve exactamente el usuario|que ve exactamente el usuario|resultado observable|situación excepcional|situacion excepcional|Qué enfoque[^>]*|Motivo justificado[^>]*|Funcionalidades[^>]*|Comportamientos[^>]*)>/i;

  for (const lineObj of parsed.lines) {
    if (templateInstructionRegex.test(lineObj.text)) {
      const match = lineObj.text.match(templateInstructionRegex);
      errors.push({
        line: lineObj.lineNumber,
        rule: 'marcador-plantilla-residual',
        message: `Se encontró el marcador de instrucción residual '${match[0]}'. Debes redactar el contenido real y eliminar la instrucción de la plantilla.`,
        expected: 'Contenido redactado sin marcadores de instrucción',
        found: match[0],
      });
    }

    if (unreplacedPlaceholderRegex.test(lineObj.text)) {
      const match = lineObj.text.match(unreplacedPlaceholderRegex);
      errors.push({
        line: lineObj.lineNumber,
        rule: 'placeholder-sin-resolver',
        message: `Se encontró el marcador angular sin resolver '${match[0]}'. Debes sustituirlo por el valor real.`,
        expected: 'Valor concreto resuelto',
        found: match[0],
      });
    }
  }
}

/**
 * Busca si un encabezado coincide con una clave esperada o sus alias
 */
function findHeadingByAlias(headings, level, targetKey) {
  const normTarget = normalizeText(targetKey);
  const aliases = SECTION_ALIASES[targetKey] || [];

  for (const h of headings) {
    if (h.level !== level) continue;
    if (h.normalized === normTarget) {
      return { match: h, isExact: true };
    }
    for (const alias of aliases) {
      if (h.normalized === normalizeText(alias)) {
        return { match: h, isExact: false, aliasUsed: h.text };
      }
    }
  }
  return null;
}

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
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    errors.push({
      line: h1 ? h1.lineNumber + 1 : 2,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: listo-para-spec' o 'Estado: en-revision'.",
      expected: 'Estado: listo-para-spec',
      found: 'No declarada',
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
        });
      } else {
        errors.push({
          line: 1,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en idea.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
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
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    errors.push({
      line: h1 ? h1.lineNumber + 1 : 2,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: <en-revision | listo-para-plan>'.",
      expected: 'Estado: en-revision o Estado: listo-para-plan',
      found: 'No declarada',
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
      });
    }
  }

  // 3. Secciones Obligatorias del Contrato Mínimo Viable
  const requiredH2 = [
    { key: 'contexto y objetivos', title: 'Contexto y objetivos', accepted: ['contexto y objetivos'] },
    { key: 'requisitos funcionales', title: 'Requisitos funcionales', accepted: ['requisitos funcionales'] },
    { key: 'casos límite', title: 'Casos límite', accepted: ['casos limite'] },
    { key: 'requisitos no funcionales', title: 'Requisitos no funcionales', accepted: ['requisitos no funcionales'] },
    { key: 'fuera de alcance', title: 'Fuera de alcance', accepted: ['fuera de alcance', 'limites y exclusiones'] },
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
        });
      } else {
        errors.push({
          line: 1,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en spec.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
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
        });
      } else {
        const hasEars = rfBullets.some((b) =>
          /\b(siempre|cuando|si|debe)\b/i.test(b.trimmed)
        );
        if (!hasEars) {
          errors.push({
            line: rfh.lineNumber,
            rule: 'rf-sintaxis-ears-faltante',
            message: `'${rfh.text}' no contiene criterios redactados bajo sintaxis EARS ('Siempre', 'Cuando', 'Si', 'debe').`,
            expected: 'Viñeta con sintaxis EARS (Siempre / Cuando / Si / debe)',
            found: rfBullets.map((b) => b.trimmed).join('; '),
          });
        }
      }
    }

    // Validar presencia de Example Mapping como oráculo TDD en Requisitos Funcionales
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
      return rfLines.some((l) =>
        /^\s*[-*]\s+\*\*ejemplo\s+concreto:?\*\*/i.test(l.trimmed)
      );
    });

    if (!hasExampleMapping) {
      errors.push({
        line: rfSection.lineNumber,
        rule: 'spec-example-mapping-faltante',
        message: "En '## Requisitos funcionales', al menos un requisito debe contener un ejemplo concreto ('- **Ejemplo concreto:** Entrada: ... → Resultado observable: ...') que actúe como oráculo independiente para las pruebas TDD.",
        expected: '- **Ejemplo concreto:** Entrada: <valor> → Resultado observable: <salida>',
        found: 'Sin viñetas de ejemplo concreto en requisitos funcionales',
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
        });
      } else {
        const minIndent = Math.min(...bullets.map((b) => b.text.match(/^(\s*)/)[1].length));
        const topLevelBullets = bullets.filter((b) => b.text.match(/^(\s*)/)[1].length <= minIndent + 1);

        for (const bullet of topLevelBullets) {
          if (!/^\s*[-*]\s+\*\*alternativa\s+descartada:?\*\*:?/i.test(bullet.trimmed)) {
            errors.push({
              line: bullet.lineNumber,
              rule: 'spec-decisiones-formato-invalido',
              message: "En '## Decisiones y alternativas descartadas', cada alternativa debe comenzar con '- **Alternativa descartada:** <enfoque>' y contener '• Por qué se descarta: <justificación>'.",
              expected: '- **Alternativa descartada:** <enfoque>',
              found: bullet.trimmed,
            });
          }
        }
      }
    }
  }

  // 7. Validación de Límites y exclusiones (Non-Goals y Anti-Goals)
  const limitesSection = parsed.headings.find(
    (h) => h.level === 2 && normalizeText(h.text) === 'limites y exclusiones'
  );
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
      });
    }
    if (!hasAntiGoals) {
      errors.push({
        line: limitesSection.lineNumber,
        rule: 'spec-anti-goals-faltante',
        message: "En '## Límites y exclusiones', falta la subsección obligatoria '### Anti-objetivos e invariantes prohibidas (Anti-Goals)'.",
        expected: '### Anti-objetivos e invariantes prohibidas (Anti-Goals)',
        found: 'Subsección ausente',
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
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    errors.push({
      line: h1 ? h1.lineNumber + 1 : 2,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: <en-revision | listo-para-tareas>'.",
      expected: 'Estado: en-revision o Estado: listo-para-tareas',
      found: 'No declarada',
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
      });
    }
  }

  // 3. Trazabilidad requerida: Idea y Spec
  const hasIdeaRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Idea:\s*\S+/i.test(l.trimmed));
  const hasSpecRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Spec:\s*\S+/i.test(l.trimmed));
  if (!hasIdeaRef || !hasSpecRef) {
    errors.push({
      line: h1 ? h1.lineNumber + 2 : 3,
      rule: 'referencias-origen-requeridas',
      message: "plan.md debe incluir referencias de trazabilidad 'Idea: <ruta>' y 'Spec: <ruta>'.",
      expected: "Idea: '<ruta>/idea.md' y Spec: '<ruta>/spec.md'",
      found: `Idea: ${hasIdeaRef ? 'OK' : 'FALTA'}, Spec: ${hasSpecRef ? 'OK' : 'FALTA'}`,
    });
  }

  // 4. Secciones Obligatorias del Contrato Mínimo Viable
  const requiredH2 = [
    { key: 'módulos y arquitectura', title: 'Módulos y arquitectura' },
    { key: 'prerrequisitos y validaciones previas', title: 'Prerrequisitos y validaciones previas (Spikes)' },
    { key: 'árbol de cambios', title: 'Árbol de cambios' },
    { key: 'estrategia de tests', title: 'Estrategia de tests' },
    { key: 'cobertura rf / rnf', title: 'Cobertura RF / RNF' },
    { key: 'decisiones técnicas', title: 'Decisiones técnicas' },
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
        });
      } else {
        errors.push({
          line: 1,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en plan.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
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
      });
    } else {
      const minIndent = Math.min(...allBullets.map((b) => b.text.match(/^(\s*)/)[1].length));
      const topLevelBullets = allBullets.filter((b) => b.text.match(/^(\s*)/)[1].length <= minIndent + 1);

      for (const bullet of topLevelBullets) {
        // Tolerancia: viñeta con backticks o comillas (- `+ ruta`, - `~ ruta`, - + ruta)
        const cleanedBulletText = bullet.text.replace(/\\/g, '');
        const hasValidPrefix = /^\s*[-*]\s+[`'"]?[+~-][\s`'"]\s*\S+/.test(cleanedBulletText);
        if (!hasValidPrefix) {
          errors.push({
            line: bullet.lineNumber,
            rule: 'arbol-prefijo-invalido',
            message: `En '## Árbol de cambios', cada archivo debe tener prefijo '+ ' (nuevo), '~ ' (modificado) o '- ' (eliminado).`,
            expected: "- `+ ruta/archivo` o - `~ ruta/archivo`",
            found: bullet.trimmed,
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
      });
    }
  }

  // 7. Validación de Decisiones Técnicas (campos obligatorios en DT-xx)
  const dtHeadings = parsed.headings.filter(
    (h) => h.level === 3 && /^DT-?\d+/i.test(h.text)
  );
  for (const dth of dtHeadings) {
    // Buscar líneas entre este DT y el siguiente encabezado
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
    const hasBestOption = dtLines.some((l) =>
      normalizeText(l.trimmed).includes('por que es la mejor opcion')
    );
    const hasAlternative = dtLines.some((l) =>
      normalizeText(l.trimmed).includes('alternativa descartada')
    );
    const hasWhyDiscarded = dtLines.some((l) =>
      normalizeText(l.trimmed).includes('por que se descarta')
    );

    if (!hasDecision) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-decision-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Decisión:**'.`,
        expected: '- **Decisión:** <enfoque>',
        found: 'Campo ausente',
      });
    }
    if (!hasBestOption) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-mejor-opcion-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Por qué es la mejor opción:**'.`,
        expected: '- **Por qué es la mejor opción:** <justificación>',
        found: 'Campo ausente',
      });
    }
    if (!hasAlternative) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-alternativa-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Alternativa descartada:**'.`,
        expected: '- **Alternativa descartada:** <enfoque alternativo>',
        found: 'Campo ausente',
      });
    }
    if (!hasWhyDiscarded) {
      errors.push({
        line: dth.lineNumber,
        rule: 'dt-campo-por-que-descarta-faltante',
        message: `'${dth.text}' no contiene el campo obligatorio '- **Por qué se descarta:**'.`,
        expected: '- **Por qué se descarta:** <motivo técnico>',
        found: 'Campo ausente',
      });
    }
  }
}

/**
 * Validador de trazabilidad cruzada (Cross-Artifact Linker) entre tasks.md, spec.md y plan.md
 */
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
            const issue = {
              line: tasksEstadoLine ? tasksEstadoLine.lineNumber : 1,
              rule: 'trazabilidad-rf-huerfano',
              message: `El requisito '${id}${info.title ? ': ' + info.title : ''}' definido en spec.md no está cubierto por ninguna tarea en tasks.md.`,
              expected: `Al menos una tarea cubriendo '${id}'`,
              found: 'Requisito sin tarea asignada',
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
      if (/^##\s+.*[Áá]rbol de cambios/i.test(line.trimmed)) {
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
    });
  }

  // 2. Metadata Estado
  const estadoLine = parsed.lines.find((l) =>
    !l.inCodeBlock && /^\s*Estado:\s*([a-zA-Z0-9_-]+)/i.test(l.trimmed)
  );
  if (!estadoLine) {
    errors.push({
      line: h1 ? h1.lineNumber + 1 : 2,
      rule: 'metadata-estado-requerida',
      message: "Falta la línea de metadata 'Estado: <en-revision | listo-para-aplicar | listo-para-verify | completado>'.",
      expected: 'Estado: listo-para-aplicar',
      found: 'No declarada',
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
      });
    }
  }

  // 3. Trazabilidad requerida: Idea y Plan
  const hasIdeaRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Idea:\s*\S+/i.test(l.trimmed));
  const hasPlanRef = parsed.lines.some((l) => !l.inCodeBlock && /^\s*Plan:\s*\S+/i.test(l.trimmed));
  if (!hasIdeaRef || !hasPlanRef) {
    errors.push({
      line: h1 ? h1.lineNumber + 2 : 3,
      rule: 'referencias-origen-requeridas',
      message: "tasks.md debe incluir referencias de trazabilidad 'Idea: <ruta>' y 'Plan: <ruta>'.",
      expected: "Idea: '<ruta>/idea.md' y Plan: '<ruta>/plan.md'",
      found: `Idea: ${hasIdeaRef ? 'OK' : 'FALTA'}, Plan: ${hasPlanRef ? 'OK' : 'FALTA'}`,
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
        });
      } else {
        errors.push({
          line: 1,
          rule: 'seccion-obligatoria-faltante',
          message: `Falta la sección obligatoria '## ${req.title}' en tasks.md.`,
          expected: `## ${req.title}`,
          found: 'Sección ausente',
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
    });
  }

  // 5. Validación de tareas individuales
  const taskLines = parsed.lines.filter((l) =>
    /^\s*[-*]\s*\[\s*[xX ]\s*\]\s*\*\*TASK-(\d+)/i.test(l.trimmed)
  );

  if (taskLines.length === 0) {
    errors.push({
      line: 1,
      rule: 'tasks-sin-tareas',
      message: "tasks.md debe contener al menos una tarea con formato '- [ ] **TASK-01: <título>**'.",
      expected: '- [ ] **TASK-01: Título de la tarea**',
      found: 'Sin tareas detectadas',
    });
  }

  for (const tl of taskLines) {
    // Validar rechazo de duración ficticia en minutos u horas (Slicing Vertical estricto)
    const durationMatch = tl.trimmed.match(/\(\s*\d+\s*(?:-\s*\d+)?\s*(?:min(?:utos)?|horas?)\s*\)/i);
    if (durationMatch) {
      errors.push({
        line: tl.lineNumber,
        rule: 'task-duracion-ficticia-prohibida',
        message: `La tarea en línea ${tl.lineNumber} contiene una estimación de tiempo ficticia '${durationMatch[0]}'. VSDD exige Slicing Vertical estricto basado en comportamiento atómico comprobable, no en minutos o cronómetros de reloj.`,
        expected: '- [ ] **TASK-xx: <título descriptivo de la rebanada vertical>**',
        found: tl.trimmed,
      });
    }

    // Validar campo obligatorio Test primero (TDD)
    const taskStartIndex = parsed.lines.findIndex((l) => l.lineNumber === tl.lineNumber);
    const nextTaskIndex = parsed.lines.findIndex(
      (l, idx) =>
        idx > taskStartIndex &&
        !l.inCodeBlock &&
        (/^\s*[-*]\s*\[\s*[xX ]\s*\]\s*\*\*TASK-/i.test(l.trimmed) ||
         /^#{1,3}\s+/.test(l.trimmed))
    );
    const taskBlockLines = parsed.lines.slice(
      taskStartIndex + 1,
      nextTaskIndex !== -1 ? nextTaskIndex : parsed.lines.length
    );

    const hasTddField = taskBlockLines.some((l) =>
      normalizeText(l.trimmed).includes('test primero')
    );
    if (!hasTddField) {
      errors.push({
        line: tl.lineNumber,
        rule: 'task-tdd-faltante',
        message: `La tarea en línea ${tl.lineNumber} no contiene el campo obligatorio '- **Test primero (TDD):**'.`,
        expected: '- **Test primero (TDD):** <especificación de la prueba>',
        found: 'Campo TDD ausente',
      });
    }

    // Validar frontera de código puro: rechazar tareas explícitamente manuales o spikes no automatizables
    let violatingLine = null;
    const isManualTitle =
      /(?:probar|verificar|testear)\s+(?:manualmente|a\s+mano)|(?:hacer\s+)?spike|(?:investigar|probar)\s+(?:alternativas|librer[ií]a|api|viabilidad)/i.test(
        tl.trimmed
      );

    if (isManualTitle) {
      violatingLine = tl;
    } else {
      const tddLine = taskBlockLines.find((l) =>
        normalizeText(l.trimmed).includes('test primero')
      );
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
        });
      }
    }
  }

  // 6. Trazabilidad cruzada determinista con spec.md y plan.md (Cross-Artifact Linker)
  const featureDir = filePath ? path.dirname(filePath) : '.';
  validateCrossArtifactTraceability(parsed, featureDir, errors, warnings, options);
}

/**
 * Detecta el tipo de artefacto a partir del nombre o contenido
 */
function detectArtifactType(filePath, content) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'idea.md') return 'idea';
  if (base === 'spec.md') return 'spec';
  if (base === 'plan.md') return 'plan';
  if (base === 'tasks.md') return 'tasks';

  if (/^#\s+Idea\b/im.test(content)) return 'idea';
  if (/^#\s+Spec\b/im.test(content)) return 'spec';
  if (/^#\s+Plan\b/im.test(content)) return 'plan';
  if (/^#\s+(Tareas|Tasks)\b/im.test(content)) return 'tasks';

  return 'unknown';
}

/**
 * Valida un archivo individual de VSDD
 */
function validateFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return {
      filePath,
      valid: false,
      type: 'unknown',
      errors: [
        {
          line: 1,
          rule: 'archivo-no-encontrado',
          message: `El archivo '${filePath}' no existe en disco.`,
        },
      ],
      warnings: [],
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return validateContent(content, filePath, options);
}

/**
 * Valida el contenido de un artefacto en memoria
 */
function validateContent(content, filePath = 'document.md', options = {}) {
  const type = options.type || detectArtifactType(filePath, content);
  const errors = [];
  const warnings = [];

  const parsed = parseMarkdownLines(content);

  // 1. Higiene universal
  validateUniversalHygiene(parsed, errors);

  // 2. Validación de contrato según tipo
  switch (type) {
    case 'idea':
      validateIdea(parsed, errors, warnings);
      break;
    case 'spec':
      validateSpec(parsed, errors, warnings);
      break;
    case 'plan':
      validatePlan(parsed, errors, warnings);
      break;
    case 'tasks':
      validateTasks(parsed, errors, warnings, filePath, options);
      break;
    default:
      errors.push({
        line: 1,
        rule: 'tipo-artefacto-desconocido',
        message: `No se pudo determinar el tipo de artefacto VSDD para '${filePath}'. Nombres esperados: idea.md, spec.md, plan.md, tasks.md.`,
        expected: 'idea.md | spec.md | plan.md | tasks.md',
        found: path.basename(filePath),
      });
  }

  return {
    filePath,
    type,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida una carpeta de funcionalidad (e.g. docs/sdd/vsdd/001-login)
 */
function validateFeatureDir(dirPath, options = {}) {
  const results = [];
  const filesToCheck = ['idea.md', 'spec.md', 'plan.md', 'tasks.md'];

  for (const fileName of filesToCheck) {
    const fullPath = path.join(dirPath, fileName);
    if (fs.existsSync(fullPath)) {
      results.push(validateFile(fullPath, options));
    }
  }

  return results;
}

/**
 * Formatea el reporte de validación para la terminal
 */
function formatReport(results) {
  const lines = [];
  lines.push('================================================================================');
  lines.push('  VSDD Format Validator (v0.42.0) - Compuerta Determinista');
  lines.push('================================================================================\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const res of results) {
    lines.push(`📄 Archivo: ${res.filePath} (Tipo: ${res.type})`);
    if (res.errors.length === 0 && res.warnings.length === 0) {
      lines.push('   ✅ APROBADO: Estructura y sintaxis conformes al contrato.');
    } else {
      for (const err of res.errors) {
        totalErrors++;
        lines.push(`   ❌ [ERROR] Línea ${err.line}: ${err.message}`);
        if (err.expected && err.found) {
          lines.push(`      • Esperado: ${err.expected}`);
          lines.push(`      • Encontrado: ${err.found}`);
        }
      }
      for (const warn of res.warnings) {
        totalWarnings++;
        lines.push(`   ⚠️  [AVISO] Línea ${warn.line}: ${warn.message}`);
      }
    }
    lines.push('');
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Resumen: ${totalErrors} error(es), ${totalWarnings} aviso(s).`);
  if (totalErrors === 0) {
    lines.push('Resultado: LUZ VERDE TOTAL ✅ (Listo para QA auditor y recapitulativo)');
  } else {
    lines.push('Resultado: REPROBADO ❌ (Corrige las líneas señaladas antes de continuar)');
  }
  lines.push('--------------------------------------------------------------------------------');

  return {
    output: lines.join('\n'),
    totalErrors,
    totalWarnings,
  };
}

// Ejecución CLI si se invoca directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const targetPath = args.find((a) => !a.startsWith('--')) || 'docs/sdd/vsdd';

  const resolvedPath = path.resolve(process.cwd(), targetPath);

  if (!fs.existsSync(resolvedPath)) {
    if (isJson) {
      console.log(
        JSON.stringify({
          valid: false,
          error: `Ruta no encontrada: ${targetPath}`,
        })
      );
    } else {
      console.error(`Error: La ruta '${targetPath}' no existe en disco.`);
    }
    process.exit(2);
  }

  const stat = fs.statSync(resolvedPath);
  let results = [];

  if (stat.isFile()) {
    results.push(validateFile(resolvedPath));
  } else {
    // Si es un directorio, verificar si contiene artefactos directamente o si contiene carpetas de features
    const directResults = validateFeatureDir(resolvedPath);
    if (directResults.length > 0) {
      results = directResults;
    } else {
      // Escaneo recursivo de carpetas hijas
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subDir = path.join(resolvedPath, entry.name);
          const subResults = validateFeatureDir(subDir);
          results.push(...subResults);
        }
      }
    }
  }

  if (results.length === 0) {
    if (isJson) {
      console.log(JSON.stringify({ valid: true, message: 'No hay archivos para validar' }));
    } else {
      console.log(`No se encontraron artefactos VSDD para validar en '${targetPath}'.`);
    }
    process.exit(0);
  }

  const hasErrors = results.some((r) => r.errors.length > 0);

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          valid: !hasErrors,
          results,
        },
        null,
        2
      )
    );
  } else {
    const report = formatReport(results);
    console.log(report.output);
  }

  process.exit(hasErrors ? 1 : 0);
}

module.exports = {
  validateFile,
  validateContent,
  validateFeatureDir,
  validateCrossArtifactTraceability,
  parseMarkdownLines,
  formatReport,
  SECTION_ALIASES,
};
