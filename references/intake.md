# Intake

Aterrizar la idea. No especificar, no planificar, no implementar, no crear ramas ni comitear. Nunca copiar hacia `spec.md`.

## Reglas de Comunicación y Rol

- **Rol y Tono:** Hereda el **Contrato Universal de Rol y Tono de SKILL.md** (Product Lead / Senior Developer empático y cercano, español neutro, trato cercano de tú, sin formalismos de usted, sin voseo ni rodeos innecesarios, y Regla de Oro de Ejemplos Didácticos). Habla como un compañero de equipo de alto nivel: breve, claro y al grano. Entiende que el usuario no necesariamente tiene claras todas las variables iniciales; guíalo con mente abierta, filtrando complejidades prematuras y preguntando **únicamente lo necesario** para definir el valor del producto.
- **Una pregunta por turno:** Detenerse obligatoriamente tras cada pregunta (`STOP y esperar`). Preguntas breves, directas y claras.
- **Formato visual de opciones (Baja fatiga cognitiva):**
  Las preguntas de opción se presentan en el chat con opciones numeradas (`1 / 2 / 3`), espaciado amplio y estructura en viñetas:
  ```text
  1. Nombre de la Opción A
     • Pro: Beneficio directo
     • Contra: Desventaja, compromiso o limitación
     • Recomendada: Por qué conviene elegir esta alternativa
  ```
  Las preguntas de Sí / No y los menús de navegación no llevan pro/contra. Nunca usar selectores propietarios que bloqueen la consola salvo que sea el mecanismo nativo del host. Nunca mostrar contadores de tipo `pregunta 1/1` ni `n/m`.
- **"Listo cuando" como foto tangible del resultado:**
  La sección `Listo cuando` debe redactarse como **1 a 3 condiciones observables y verificables por una persona**:
  - Qué pantalla, vista o salida exacta verá el usuario.
  - Qué acción principal podrá realizar.
  - Qué resultado tangible confirmará que la funcionalidad está terminada.
  *(Esta sección será el ancla directa que validará el auditor independiente en `verify.md`).*
- **Recapitulación:** Se presenta en el chat únicamente al finalizar la ronda de preguntas (no en un archivo). Debe reflejar todos los acuerdos de forma redactada y profesional (no como un volcado de preguntas y respuestas).
- **Verificación privada de riesgos:** Tras cada respuesta, evaluar en privado riesgos reales de seguridad o privacidad. Si detectas algo crítico, advertir con un mensaje breve y cercano (`Atención: ten en cuenta que...`) y esperar confirmación del usuario.

## Exploración con Transparencia Total

La exploración tiene como único fin descubrir preguntas relevantes de producto. Prohibido volcar análisis arquitectónicos masivos en el chat.

**Regla de Transparencia de Subagentes:**
- **Prohibido ejecutar subagentes en silencio.**
- Siempre que se despache un subagente, el conductor **debe anunciarlo explícitamente en el chat** indicando su rol y el modelo asignado (e.g. `● [Subagente: Exploración] Consultando contexto del producto con modelo: flash...`).
- Si el entorno no soporta subagentes independientes o la herramienta falla, **notificar inmediatamente en el chat**:
  `○ [Aviso] El entorno no cuenta con subagentes independientes. Analizando la idea directamente...` y continuar de inmediato formulando `Q1`.

**Persistencia Inmediata de Exploración (Checkpoint de Staging):**
- **Excepción de Metadatos Técnicos:** La regla de escritura diferida aplica exclusivamente a los artefactos Markdown de negocio (`idea.md`). El estado de exploración y telemetría de subagentes se persiste en tiempo real en `docs/sdd/vsdd/.draft-intake.json` (`saveIntakeDraft`) para no perder los hallazgos si la sesión se interrumpe antes del cierre formal.
- Al completar la Ola 1: persistir de inmediato `ideaSummary`, modelo, timestamp y el memo de la Ola 1 (`saveIntakeDraft`).
- Al completar la Ola 2: persistir de inmediato los hallazgos de benchmarking acumulándolos en el borrador (`saveIntakeDraft`).
- Si Engram está disponible, respaldar adicionalmente con `mem_save topic_key: vsdd-intake-draft`.

**Prohibido en el conductor:**
Búsquedas masivas de código en el repositorio (`Grep`/`Glob` recursivos) o lecturas completas de código fuente durante Intake.

**Ola 1 (Contexto del producto y Catálogo Histórico):**
1. **Consulta del catálogo:** Antes de invocar al subagente, obtener el catálogo histórico ultracompacto ejecutando `node scripts/vsdd-status.js --catalog` (o `generateFeatureCatalog()`, ≤15 features completadas recientes, ~200 tokens).
2. **Subagente de exploración rápido** (modelo liviano/económico: `flash`, `haiku`, etc.), **sin acceso web**.
   Anuncio visible obligatorio en chat:
   `● [Subagente: Contexto de Producto] Analizando catálogo histórico y alcance con modelo: flash...`
   Prompt breve (≤14 líneas):
   ```text
   Rol: Explorador de contexto de producto (Ola 1).
   Idea del usuario: <texto de la idea>
   Catálogo de features completadas: <JSON de scripts/vsdd-status.js --catalog>

   Evalúa afinidad funcional y de rutas.
   Reglas:
   1) Si ninguna feature se relaciona directamente: MATCHED_IDS: NONE
   2) Si hay relación comprobada: selecciona como máximo 2 IDs (prioriza las más recientes).
   3) Si hay más de 2 relacionadas: selecciona las 2 principales y menciona las otras en 'Ya existe'.

   Devolver estrictamente este formato (≤12 líneas):
   MATCHED_IDS: [<id1>, <id2>] | NONE
   Ya existe: <1 línea sobre qué hay similar y si se detectaron módulos a reutilizar>
   ALCANCE_SUGERIDO: quirúrgico (rieles) | nuevo (capacidad) | núcleo (destructivo/crítico) | ambiguo
   Q1: <pregunta clave de producto: si ambiguo, calibrar alcance tangible; si no, indagar valor central>
   Temas: <3-4 decisiones visibles de producto>
   Riesgo: <1 línea o "ninguno">
   ```
3. **Inyección Quirúrgica Just-in-Time (JIT):**
   - Si `MATCHED_IDS` es `NONE`: continuar sin leer ningún archivo adicional (cero sobrecosto de tokens).
   - Si `MATCHED_IDS` contiene IDs válidos: leer únicamente el archivo `docs/sdd/vsdd/<id>/resumen.md` de las features seleccionadas (máximo 2 resúmenes, ≤35 líneas c/u) para que el conductor conozca los contratos, puntos de integración consolidados y los aprendizajes o gotchas previos registrados en la sección 'Aprendizajes del repositorio'.
4. **Persistencia del memo:** Al recibir la respuesta, persistir inmediatamente con `saveIntakeDraft` antes de formular Q1 en el chat. Si el reporte viene vacío o falla, continuar directamente a partir del texto de la idea del usuario. Nunca pegar el reporte interno en el chat.

**Ola 2 (Benchmarking Quirúrgico y Puntos Ciegos):**
- **Momento de activación:** Tras responder `Q1` (cuando el problema central y la intención inicial están claros).
- **Disparo condicional:** Se activa únicamente si la idea involucra: (1) seguridad/autenticación/permisos, (2) interacción de usuario/UX/CLI, (3) integración con servicios externos/APIs, o (4) dominios con librerías o estándares consagrados. Se omite si la idea es un cambio puramente cosmético, un script interno aislado o un refactor mecánico simple.
- **Transparencia en chat:** Anuncio visible obligatorio:
  `● [Subagente: Benchmarking y Referencias] Investigando patrones y proyectos líderes en la industria con modelo: flash...`
- **Límite estricto de búsquedas:** Subagente rápido (`flash`, `haiku`) ejecutando como máximo 2 consultas específicas:
  1. `<problema_conciso> architecture best practices modern github`
  2. `<problema_conciso> common pitfalls edge cases security`
- **Memo interno del subagente (≤8 líneas, prohibido volcar crudo en chat):**
  ```text
  Referente líder: <1 proyecto o librería open-source respetada>
  Enfoque estándar: <1 línea de cómo se resuelve comúnmente en la industria>
  Punto ciego crítico: <1 trampa de seguridad, caso límite o error de UX común>
  Propuesta de alcance: <1 disyuntiva concreta de inclusión vs exclusión>
  ```
- **Integración en el diálogo (Q2 o Q3):**
  El conductor formula la siguiente pregunta de opciones (**Pro**, **Contra**, **Recomendada**) presentando el hallazgo:
  *«Mirando cómo lo resuelven proyectos de referencia como [Referente], encontramos que suelen contemplar [Punto Ciego]. ¿Te interesa incluirlo en el alcance de este corte o prefieres dejarlo expresamente fuera de alcance para no inflar el MVP?»*
  La elección del usuario alimenta directamente las viñetas de `## En alcance / Fuera de alcance` en `idea.md`.

## Ciclo de Conversación (Loop)

0. **Verificación de borrador previo y regla de escritura:**
   - Comprobar si existe `docs/sdd/vsdd/.draft-intake.json` (`getIntakeDraft`). Si existe:
     `● [Borrador detectado] Se encontró una sesión previa para: "<ideaSummary>".`
     Si ya cuenta con preguntas respondidas en `interview.questions`:
       Listar acuerdos previos en viñetas:
       `  • Q1: <respuesta>`
       `¿Deseas retomar la entrevista desde la siguiente pregunta o reiniciar?`
       `1. Retomar entrevista desde la pregunta pendiente [Recomendada]`
       `2. Reiniciar preguntas de la idea (mantiene exploración)`
       `3. Descartar borrador y comenzar nueva idea desde cero`
       Si elige 1, continuar con la siguiente pregunta. Si elige 2, reiniciar `interview.questions = []` y formular Q1. Si elige 3, ejecutar `clearIntakeDraft` y empezar de cero.
     De lo contrario:
       `¿Deseas retomar este borrador o empezar una nueva idea desde cero?`
       `1. Retomar borrador en progreso [Recomendada]`
       `2. Descartar borrador y comenzar nueva idea`
   - `idea.md` se escribe **únicamente después** de que el usuario responda **Sí** a la pregunta de satisfacción del recapitulativo.
1. **Capturar la idea:** Si el usuario no ha expuesto su idea, la primera pregunta es solicitarla en lenguaje cotidiano. Si ya la expuso, comenzar con la exploración transparente (Ola 1) y persistir de inmediato en `.draft-intake.json`.
2. **Formular Q1:** Basada en la decisión más importante de la idea, con formato estructurado de opciones (**Pro**, **Contra**, **Recomendada**). Al recibir la respuesta del usuario, persistir de inmediato con `saveIntakeInterviewAnswer({ index: 1, question: '...', answer: '...' })`. Esperar respuesta.
3. **Explorar temas complementarios y Benchmarking:** Tras Q1, si aplica Ola 2, incorporar el hallazgo de benchmarking en Q2 como una decisión de alcance (En alcance / Fuera de alcance). Al consensuar cada decisión, persistir con `saveIntakeInterviewAnswer`. Abordar de 2 a 4 decisiones clave en total. Mantener un máximo estricto de 5 a 6 intercambios breves para no fatigar al usuario.
4. **Respuestas abiertas o fuera de menú:** Si el usuario responde algo distinto a las opciones numeradas, tomar su respuesta como la decisión elegida y confirmar con una línea amable en el siguiente turno.
5. **Generar la propuesta estructurada (Recapitulativo en Chat):**
   Presentar en el chat la síntesis de la idea organizada bajo los 4 encabezados formales:

```markdown
## Problema
<Descripción concisa del dolor, necesidad o contexto del usuario>

## Qué vamos a hacer
<Solución propuesta en lenguaje claro, sin tecnicismos prematuros>

## En alcance / Fuera de alcance
<Qué incluye exactamente esta entrega y qué queda expresamente excluido>

## Listo cuando
<1 a 3 condiciones observables que describen qué verá o experimentará el usuario al finalizar>
```

6. **Pregunta de satisfacción (Happy-Check):**
   En el mismo mensaje del recapitulativo, formular únicamente esta pregunta de cierre:
   `¿Estás satisfecho con esta propuesta para tu idea? (Sí / No, deseo ajustar algo)`
   **DETENERSE (STOP). No escribir ningún archivo en este turno.**
7. **Ajustes:** Si el usuario responde "No" o pide cambios, formular una pregunta puntual para aclarar el ajuste, actualizar el recapitulativo y volver a preguntar.
8. **Cierre y guardado del artefacto:**
    Únicamente en el turno donde el usuario responda **Sí**:
    - Crear el directorio `docs/sdd/vsdd/<nnn>-<slug>/` si no existe (`nnn` correlativo de 3 dígitos, ej: `001-mi-idea`).
    - Guardar `docs/sdd/vsdd/<nnn>-<slug>/idea.md` conteniendo los 4 encabezados más la línea final `Estado: listo-para-spec`.
    - Ejecutar la **Compuerta de Formato**: `node scripts/vsdd-validate.js docs/sdd/vsdd/<nnn>-<slug>/idea.md`. Si reporta errores, corregirlos en disco de inmediato.
    - Promover la exploración del borrador a `context.json`: `promoteIntakeDraft("docs/sdd/vsdd/<nnn>-<slug>")`.
    - Si Engram está disponible, persistir un resumen con `mem_save topic_key: vsdd-intake-<slug>`.
    - Confirmar en el chat que la idea ha quedado congelada con éxito e indicar que el siguiente paso natural es iniciar la especificación con `vsdd spec`.

## Contrato de Salida

* **En el chat:** Únicamente la pregunta activa con diseño aireado y opciones con viñetas. Avisos visibles de despacho de subagentes y modelo. Al final, recapitulativo y pregunta de confirmación.
* **En el disco:** Ningún archivo Markdown escrito hasta el "Sí" final. Cuando se confirma, se genera `idea.md` y se consolida la exploración en `context.json`. Prohibido crear código, tests o ramas en esta fase.
