# Descomposición de Tareas (Tasks)

Convierte un plan técnico aprobado (`plan.md`) en un desglose estructurado de tareas (`tasks.md`) de forma **100% autónoma, sin preguntas de entrevista al usuario**. **Esta fase no modifica código de producto ni tests.** Prohibido inventar tareas que no hayan sido establecidas en el plan.

**Contrato de Tareas:**
Leer plan aprobado → estructurar tareas autónomamente en fases lógicas bajo Slicing Vertical con TDD estricto → redactar `tasks.md` inicial (`Estado: en-revision`) → despachar **Auditor Independiente de QA** (anunciando subagente y modelo) → el conductor aplica correcciones técnicas exclusivamente en `tasks.md` en disco (nunca código de producto) → persistir estado en memoria → presentar versión ejecutiva estructurada en el chat de la terminal → mostrar menú interactivo para pasar a implementación o ajustar.

---

## Reglas Innegociables

- **Sin entrevista al usuario:** El problema, la especificación y el plan arquitectónico ya están formalmente acordados. La descomposición en micro-tareas es una responsabilidad técnica del agente. No abrir cupos de preguntas ni consultar cómo dividir el trabajo.
- **Estructura por Fases y Foco en el Core Slice:** Las tareas se agrupan en fases secuenciales (`## Fase 1: ...`, `## Fase 2: ...`) respetando el grafo de dependencias de `plan.md`. Como directriz de arquitectura, la **Fase 1 debe enfocarse en poner en pie el Core Vertical Slice** (la columna vertebral de valor de `RF-01` de punta a punta con su test verificable), logrando un primer entregable funcional cuanto antes. Las fases posteriores se dedican al blindaje, casos límite, protecciones y pulido.
- **Slicing Vertical Estricto (Unidad Mínima Comprobable):** Cada tarea representa una rebanada vertical completa: su test automatizado que falla (Red) derivado del Example Mapping de `spec.md` (o proyectado mediante `vsdd oracle`), el código mínimo que lo hace pasar (Green) y refactorización. Al finalizar la tarea, el sistema compila y el test pasa en verde de forma aislada. Queda terminantemente prohibido el *Slicing Horizontal* (tareas desconectadas de "solo tipos", "solo interfaces" o "solo scaffolding"). La granularidad no se mide por cronómetros ficticios de minutos, sino por constituir la unidad atómica más pequeña de comportamiento observable verificable. Formato: `- [ ] **TASK-xx: <título de la rebanada vertical>**`.
- **TDD Estricto (Test Primero):** Cada tarea debe incluir obligatoriamente su especificación de `Test primero (TDD)` indicando la prueba automatizada que debe fallar antes de tocar código de producción. Cero tests tautológicos o aserciones superficiales.
- **Frontera de Código Puro (Sin tareas manuales ni spikes):** `tasks.md` está reservado exclusivamente para código de producción y pruebas automatizadas bajo TDD. Queda estrictamente prohibido incluir tareas de "probar manualmente", "configurar credenciales", "hacer spike" o "investigar alternativas". Si existían dudas previas o pruebas exploratorias, debieron quedar resueltas en `plan.md`; si existe verificación manual final, pertenece al Golden Path de `verify.md`.
- **Commits Atómicos y Sin Trailers de IA:**
  - Casilla de marcado para commit atómico por tarea (`- [ ] **Commit de tarea:**`).
  - Bloque de cierre por fase (`### Control de Fase N`) con auditoría y commit de fase.
  - Estándar Conventional Commits (`<tipo>(<alcance>): <descripción>`). Prohibido incluir trailers de IA o "Co-Authored-By".
- **Contrato Universal de Calidad y Pruebas:**
  - El comando de verificación de cada fase no está atado a herramientas propietarias; se basa dinámicamente en el comando de pruebas y calidad del proyecto (ej: `npm test`, `go test ./...`, `pytest`, `cargo test` o target de Makefile).
- **Cobertura Total:** Cada Decisión Técnica (`DT-xx`) del plan y cada requisito (`RF-xx` / `RNF-xx`) de la especificación debe estar cubierto explícitamente en el campo **Cubre** de alguna tarea (o listado en *Fuera de este corte*).
- **Preservación del Valor de la Idea:** Las primeras tareas deben priorizar la entrega temprana de valor y la validación del problema central plasmado en `idea.md`.
- **Prohibición de Tocar Código:** El conductor no crea, edita ni elimina archivos del código de producto o tests. El árbol de archivos a tocar proviene exclusivamente de `plan.md`.
- **Transparencia Absoluta de Agentes y Modelos:**
  - Anuncio visible en chat antes de despachar subagentes:
    `● [Subagente: Auditoría QA de Tareas] Verificando granularidad, dependencias y cobertura con modelo: <nombre-del-modelo>...`
  - Aviso inmediato si la herramienta falla:
    `▲ [Aviso] No fue posible despachar el subagente; el agente principal asume la tarea localmente.`

---

## Flujo de Ejecución Autónomo

1. **Verificación de Entrada:** Requerir `plan.md` con `Estado: listo-para-tareas`. Si no existe, indicar en una línea amable que primero se requiere completar la fase de Plan. Si ya existe `tasks.md`, ofrecer: 1) Revisar y continuar, 2) Regenerar tareas.
2. **Lectura de Contexto:** Leer las directrices del proyecto si existen (ej. `README.md`, `CONTRIBUTING.md`), `idea.md`, `spec.md` y `plan.md`. No imprimir volcados de texto en el chat.
3. **Generación Autónoma:** Con base en el árbol de archivos determinista y las decisiones técnicas de `plan.md`, redactar las tareas siguiendo estrictamente `tasks-template.md`:
   - Agrupar en Fases secuenciales lógicas.
   - Definir micro-tareas bajo **Slicing Vertical** atómico con requisitos observables.
   - Especificar el test que falla primero para cada una.
   - Asignar casillas de commit de tarea y bloques de control de fase con el comando de calidad del proyecto.
4. **Escritura Inicial y Compuerta de Formato:** Guardar `docs/sdd/vsdd/<nnn>-<slug>/tasks.md` en disco (`Estado: en-revision`).
   - **Compuerta Determinista de Formato (Obligatoria):** Ejecutar inmediatamente `vsdd validate docs/sdd/vsdd/<nnn>-<slug>/tasks.md`. Si el validador emite algún error (campos TDD faltantes o controles de fase omitidos), el conductor debe corregirlos en disco de inmediato. Queda estrictamente prohibido despachar la auditoría de QA sobre un archivo que no pase `vsdd-validate` con código 0.
5. **Auditoría Independiente de QA (Subagente Obligatorio):**
   Despachar un subagente auditor independiente (modelo analítico de alto razonamiento, ej: `pro` o `sonnet`):
   Anunciar en chat: `● [Subagente: Auditoría QA de Tareas] Verificando dependencias, TDD y slicing vertical con modelo: <modelo>...`
   Si el subagente falla tras un reintento, avisar en consola y realizar la revisión de forma local.
   El auditor evalúa:
   1) Requisitos o DTs del plan sin tarea asignada.
   2) Tareas con archivos que no pertenecen al árbol del plan.
   3) Orden de tareas que vulnere el grafo de dependencias técnicas.
   4) Alineación con la entrega de valor de `idea.md`.
   5) Slicing Vertical vs Horizontal: rechazar tareas de "solo tipos", "solo interfaces" o scaffolding que no entreguen comportamiento comprobable de punta a punta, tareas sin especificación TDD o fases sin bloque de control.
   6) Detección de tareas manuales: rechazar de inmediato cualquier tarea que exija pruebas manuales, spikes de investigación o configuraciones de entorno fuera del código automatizable.
6. **Correcciones Autónomas en `tasks.md`:** El conductor lee el reporte del auditor (sin pegarlo crudo en el chat) y corrige directamente `tasks.md` en disco (subdivide tareas extensas, ajusta dependencias y completa mapeos). Prohibido editar código del producto.
   - Actualizar cabecera a `Estado: listo-para-aplicar`.
   - Actualizar `context.json` en la carpeta de la funcionalidad (`saveFeatureContext`) registrando el estado `listo-para-aplicar` y el timestamp actual.
   - Si Engram está disponible, persistir estado con `mem_save topic_key: vsdd-tasks-<slug>`.
   - Si el proyecto usa Git, preguntar cordialmente al usuario si desea registrar un commit convencional de documentación o prefiere continuar sin commitear:
     *«¿Deseas que prepare un commit de git (`docs(sdd): aprobar tareas para <slug>`) o prefieres continuar sin commitear?»*
7. **Presentación Ejecutiva en Terminal y Menú de Transición:**
   Mostrar en el chat una vista ejecutiva estructurada con:
   - Resumen de Fases planificadas.
   - Conteo total de tareas de slicing vertical y cobertura de requisitos (ej. `8 tareas de slicing vertical · 100% RF/RNF cubiertos`).
   - Ajustes automáticos aplicados tras la auditoría QA.
   - Formular directamente la pregunta de transición:

```text
╭────────────────────────────────────────────────────────╮
│  ✔ Desglose de tareas auditado y listo para aplicar    │
│    Archivo: docs/sdd/vsdd/<nnn>-<slug>/tasks.md        │
╰────────────────────────────────────────────────────────╯

¿Cuál es el siguiente paso que deseas realizar?
1. Pasar a la implementación (vsdd apply)
2. Revisar o ajustar tareas manualmente
3. Lanzar otra auditoría independiente de QA
```

- **Opción 1 (Pasar a la implementación):**
  - **Estrategia universal de ramas:** Preguntar: `¿Dónde prefieres trabajar la implementación?`:
    - `1) Crear una nueva rama Git`
    - `2) Trabajar en la rama actual (<rama_actual>)`
  - **Si elige 1 (nueva rama):** Detectar la rama base del repositorio (`main`, `master` o la activa) y proponer 3 sugerencias con formato convencional (`feat/<scope>-<desc>` o `fix/<scope>-<desc>`) o permitir escribir una personalizada. Tras confirmar, ejecutar `git checkout -b <rama>` reportando en una sola línea que la rama está lista.
  - **Si elige 2 (rama actual):** Confirmar que se continúa en `<rama_actual>`.
  - **En ambos casos:** Preguntar amablemente: `¿Deseas arrancar la implementación ahora mismo o prefieres pausar aquí?`:
    - `1) Iniciar implementación ahora`: Cargar inmediatamente `references/apply.md`.
    - `2) Pausar aquí`: Reportar que el entorno y `tasks.md` quedan listos para retomar en cualquier momento ejecutando `vsdd apply`.
- **Opción 2 (Revisar o ajustar tareas):** Esperar comentarios del usuario; al recibir observaciones, aplicar los cambios en `tasks.md` en disco y volver a presentar el menú.
- **Opción 3 (Lanzar otra auditoría):** Re-ejecutar paso 5, aplicar correcciones y volver al paso 7.

---

## Contrato de Salida

* **En el chat:** Cero preguntas durante la redacción, aviso visible del subagente auditor y su modelo, síntesis ejecutiva estructurada para terminal y menú interactivo de transición.
* **En el disco:** Ningún archivo de producto o tests modificado. Únicamente se genera y actualiza `tasks.md` dentro de `docs/sdd/vsdd/<nnn>-<slug>/`.
