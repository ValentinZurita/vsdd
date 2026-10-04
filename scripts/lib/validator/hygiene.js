'use strict';

const { normalizeText } = require('./lexer');

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

module.exports = {
  SECTION_ALIASES,
  validateUniversalHygiene,
  findHeadingByAlias,
};
