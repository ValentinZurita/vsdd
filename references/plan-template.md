# Plantilla de Plan Técnico (Plan Template)

El archivo `plan.md` guardado **debe cumplir obligatoriamente con el Contrato Mínimo Viable** conteniendo los encabezados requeridos que figuran a continuación, sin omitir secciones base ni alterar su orden lógico. Se permite agregar secciones complementarias (ej: migración de datos, rollback, infraestructura) si la complejidad del corte lo amerita, siempre que cumplan con la higiene sintáctica. Las líneas de instrucción (este bloque introductorio, los bloques **Llenar:**, **Forma:**, **Vacío:** y las ayudas entre corchetes angulares) nunca deben aparecer en el recapitulativo del chat ni en el archivo final. Inmediatamente tras escribirlo, se valida con `node scripts/vsdd-validate.js`.

Prohibido incluir código de producción. El contenido se enfoca en el **qué-técnico**: módulos, modelos de datos, contratos, decisiones técnicas (DT), árbol de archivos y estrategia de pruebas. Cada `RF` y `RNF` de `spec.md` debe aparecer obligatoriamente en la tabla de **Cobertura**. El `Estado` inicial es `en-revision` hasta que el usuario confirme con **Sí** a la pregunta de satisfacción (momento en el que pasa a `listo-para-tareas`).

Si una sección no aplica para este corte funcional, usar la palabra de relleno indicada en **Vacío:**. No inventar contenido.

---

# Plan <nnn> <Nombre de la funcionalidad>

Estado: <en-revision | listo-para-tareas>

Idea: `<nnn>-<slug>/idea.md`
Spec: `<nnn>-<slug>/spec.md`

## Alineación

**Llenar:** de 3 a 8 oraciones o viñetas concisas. Explicar cómo este plan técnico resuelve fielmente el problema original y el dolor del usuario definidos en `idea.md` y cumple los requisitos de `spec.md` sin sobre-ingeniería ni complejidad accidental. Si el proyecto cuenta con directrices arquitectónicas documentadas, certificar el cumplimiento de sus límites.

**Forma:** prosa breve o viñetas directas.

## Módulos y arquitectura

**Llenar:** qué partes o capas del sistema toca este corte (ej. dominio, aplicación, infraestructura, componentes de interfaz o adaptadores), adaptándose a la arquitectura real del repositorio descubierta dinámicamente. Distinguir qué módulos ya existen y cuáles son nuevos.

Cada bloque debe indicar explícitamente: **Cubre:** `RF-xx`, `RNF-xx`.

**Forma:**
- **<Módulo o componente>:** <responsabilidad técnica específica>. Cubre: RF-xx, RNF-xx

## Modelo de datos

**Llenar:** únicamente si este corte almacena o estructura información persistente o en memoria. Esquema observable de los registros en formato JSON o especificación de campos: tipos, identificadores y relaciones clave. Prohibido incluir migraciones SQL completas; definir la estructura conceptual de datos.

**Vacío:** `No aplica.`

**Forma:** bloque de código `json` seguido de un párrafo explicativo conciso.

## Algoritmos y lógica de negocio

**Llenar:** únicamente si una regla de negocio o cálculo requiere pasos secuenciales detallados que no justifican una decisión técnica independiente. Pseudocódigo claro en lenguaje de producto/técnico.

**Vacío:** `No aplica.`

## Contratos e interfaces

**Llenar:** únicamente si se definen interfaces públicas, tipos de entrada/salida (DTOs), puertos o eventos entre componentes que deban mantenerse estables para las tareas de desarrollo.

**Vacío:** `No aplica.`

## Decisiones técnicas

**Llenar:** cada disyuntiva técnica real donde existan dos o más alternativas defendibles. Numeración correlativa `DT-01`, `DT-02`, ... Toda decisión debe estar respaldada por evidencia técnica y buenas prácticas actuales de la industria. Prohibido inventar decisiones técnicas para llenar la sección.

Una decisión técnica sin alternativa descartada rigurosamente justificada se considera inválida.

**Vacío:** `Ninguna: el corte técnico no presentó disyuntivas con alternativas divergentes.`

**Forma:**

### DT-01 <Título corto de la decisión>
- **Decisión:** <qué enfoque se adopta>
- **Por qué es la mejor opción actual:** <justificación técnica basada en rendimiento, mantenibilidad, estándares actuales o simplicidad>
- **Alternativa descartada:** <enfoque alternativo considerado>
- **Por qué se descarta:** <motivo técnico concreto por el cual la alternativa no es óptima para este caso>
- **Cubre:** RF-xx, RNF-xx

## Prerrequisitos y validaciones previas (Spikes)

**Llenar:** únicamente si este corte tiene dependencias de entorno (.env, credenciales, accesos) o incertidumbre técnica que requiera un experimento o prueba manual rápida (spike ≤ 30 min) antes de comenzar a codificar.

Si se requiere un spike, registrar la pregunta concreta a responder y la prueba ejecutada. **El spike y los prerrequisitos deben quedar 100% resueltos antes de aprobar el plan y pasar a tasks.md.**

**Vacío:** `Ninguno: el entorno cuenta con todo lo necesario y no hay incertidumbre técnica previa.`

**Forma:**
- **Spike / Validación previa:** <pregunta a despejar o experimento ejecutado>. Resultado: <aprendizaje o confirmación>. Estado: <resuelto | no aplica>.
- **Prerrequisitos de entorno:** <variables de entorno, credenciales o configuración necesaria>. Estado: <listo | no aplica>.

## Árbol de cambios

**Llenar:** mapa exacto y determinista de los archivos que se crearán, modificarán o eliminarán. Rutas completas y reales del proyecto. Cada línea debe utilizar estrictamente uno de los tres prefijos:
`+` para archivo o directorio nuevo.
`~` para archivo existente que se modifica.
`-` para archivo existente que se elimina.
Prohibido usar párrafos conversacionales; este árbol es el blueprint directo para la descomposición atómica de tareas en `tasks.md`.

**Forma:** lista estructurada por carpetas:
- `+ ruta/al/archivo_nuevo.ext`
- `~ ruta/al/archivo_existente.ext`

## Estrategia de tests

**Llenar:** enfoque de pruebas (TDD: prueba primero, luego implementación). Describir qué comportamientos se verifican, cómo se prueban los casos límite y **mapear explícitamente cómo se valida cada una de las condiciones del "Listo cuando"** heredadas de `idea.md` y `spec.md`. Cada grupo de pruebas debe indicar qué requisitos cubre.

Adicionalmente, si la funcionalidad cuenta con superficie de interacción visible (CLI interactivo, Web, API o comandos con flags), definir la receta del **Paseo de Verificación Manual (Golden Path Walkthrough)** para que el desarrollador o el asistente de humo puedan verificar el flujo crítico en ≤ 2 minutos. Si el corte es puramente interno o headless, registrar `No aplica (cambio 100% interno cubierto por pruebas automatizadas)`.

**Vacío:** no permitido. Todo plan técnico debe definir cómo se comprueba el corte.

**Forma:** viñetas para suites automáticas y subsección estructurada para el Golden Path:
- **<Nombre de la suite o prueba>:** <qué comportamiento valida>. Valida Listo cuando: <condición observable>. Cubre: RF-xx.

### Paseo de Verificación Manual (Golden Path Walkthrough)
- **Superficie:** <CLI Interactivo | Web | API | Headless>
- **Duración estimada:** ≤ 2 minutos
- **Paso 1 (Arranque):** `<comando exacto o URL>`
- **Paso 2 (Acción):** `<input, clics o parámetros exactos>`
- **Paso 3 (Resultado esperado observable):** `<qué se debe observar en pantalla>`

## Cobertura RF / RNF

**Llenar:** tabla exhaustiva con una fila por cada `RF-xx` y `RNF-xx` de `spec.md`. Ningún requisito puede quedar sin ubicación (módulo, DT o test). Una fila sin cobertura constituye un defecto crítico.

**Forma:**

| ID | Dónde se resuelve (Módulo, DT, Tests) |
| :--- | :--- |
| RF-01 | Módulo X, DT-01, Prueba unitaria Y |
| RF-02 | Módulo Z, Prueba de integración W |

## Diagramas

**Llenar:** como máximo un diagrama simple en Mermaid (`flowchart` o `sequenceDiagram`) únicamente si clarifica la interacción entre módulos o el flujo de una decisión técnica.

**Vacío:** `Ninguno.`

## Dudas abiertas

**Llenar:** cualquier aspecto técnico pendiente de resolver tras la entrevista y la auditoría QA, o advertencias técnicas que deban resolverse durante la implementación. Cada línea inicia con `[NECESITA ATENCIÓN]` seguido del detalle.

**Vacío:** `Ninguna.` (únicamente si todos los RF/RNF tienen cobertura completa y no quedan incertidumbres de diseño).
