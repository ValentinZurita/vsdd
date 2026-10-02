# Plantilla de Tareas (Tasks Template)

El archivo `tasks.md` guardado **debe contener exactamente** los encabezados que figuran a continuación, en este orden. Las líneas de instrucción (este bloque introductorio y las ayudas de formato) nunca deben aparecer en el archivo final.

**Esta fase no modifica código del producto ni tests.** Las tareas se desprenden exclusivamente del `plan.md` aprobado, ancladas en `idea.md`. Prohibido inventar nuevas decisiones técnicas o requisitos funcionales. El `Estado` inicial es `en-revision` durante la redacción autónoma; pasa a `listo-para-aplicar` tras la auditoría independiente y las correcciones autónomas aplicadas en disco. Al completarse todas las tareas en la fase de implementación (`apply`), pasa a `listo-para-verify`.

---

# Tareas <nnn> <Nombre de la funcionalidad>

Estado: <en-revision | listo-para-aplicar | listo-para-verify>

Idea: `<nnn>-<slug>/idea.md`
Plan: `<nnn>-<slug>/plan.md`

## Reglas de ejecución

- **Granularidad:** tareas pequeñas orientadas a Slicing Vertical (comportamiento atómico comprobable). Si una tarea abarca más de una unidad de valor observable, se subdivide.
- **TDD estricto:** cada tarea define y ejecuta primero la prueba automatizada que debe fallar antes de tocar código de producción.
- **Código puro y automatizable:** cada tarea debe ser 100% ejecutable mediante código y pruebas automatizadas (TDD). Prohibido incluir tareas manuales, spikes de investigación exploratoria o configuraciones manuales de entorno. Todo prerrequisito debe haberse resuelto previamente en `plan.md`.
- **Commits atómicos:** commit obligatorio al terminar cada tarea y cada fase, bajo el estándar Conventional Commits (`<tipo>(<alcance>): <descripción>`), sin trailers de IA ni Co-Authored-By.
- **Control de calidad por fase:** al finalizar cada fase, un auditor independiente (solo lectura) revisa el código implementado contra spec y plan. Los ajustes los aplica un subagente reparador independiente (el agente conductor nunca edita código de producto). La fase se cierra validando con el comando de pruebas y calidad del proyecto.

## Fase 1: <Nombre de la fase (ej: Dominio, Contratos y Datos)>

- [ ] **TASK-01: <título descriptivo y conciso>**
  - **Qué:** <comportamiento observable derivado del plan>
  - **Cubre:** RF-xx, RNF-xx, DT-xx
  - **Archivos:** <rutas completas del árbol del plan con prefijos `+`, `~`, `-`>
  - **Test primero (TDD):** <especificación concreta del test que debe fallar antes de implementar>
  - **Listo cuando:** <criterio observable que confirma la tarea completada>
  - [ ] **Commit de tarea:** `<tipo>(<alcance>): <descripción>`

### Control de Fase 1

- [ ] **Auditoría independiente de Fase 1:** subagente QA revisa código de la fase contra spec/plan (solo lectura). Si hay hallazgos, un subagente reparador aplica los ajustes y se relanza la auditoría (máximo 2 iteraciones).
- [ ] **Commit de Fase 1:** commit de cierre de fase validado con el comando de pruebas/calidad del proyecto (ej: `npm test`, `go test ./...`, etc.).

## Fase 2: <Nombre de la fase (ej: Aplicación e Integración / Servicios)>

- [ ] **TASK-02: <título descriptivo y conciso>**
  - **Qué:** <comportamiento observable derivado del plan>
  - **Cubre:** RF-xx, RNF-xx, DT-xx
  - **Archivos:** <rutas completas del árbol del plan con prefijos `+`, `~`, `-`>
  - **Test primero (TDD):** <especificación concreta del test que debe fallar antes de implementar>
  - **Listo cuando:** <criterio observable que confirma la tarea completada>
  - [ ] **Commit de tarea:** `<tipo>(<alcance>): <descripción>`

### Control de Fase 2

- [ ] **Auditoría independiente de Fase 2:** subagente QA revisa código de la fase (solo lectura). Si hay hallazgos, un subagente reparador aplica los ajustes y se relanza la auditoría (máximo 2 iteraciones).
- [ ] **Commit de Fase 2:** commit de cierre de fase validado con el comando de pruebas/calidad del proyecto.

## Fuera de este corte

Elementos del plan expresamente no incluidos en esta entrega (o registrar: `Nada: el plan cabe entero en esta entrega.`).

## Dudas abiertas

Aspectos técnicos pendientes de resolver: cada línea inicia con `[NECESITA ATENCIÓN]` seguido del detalle, o registrar `Ninguna.`.
