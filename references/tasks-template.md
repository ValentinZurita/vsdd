# Tasks template

The saved `tasks.md` **is** the headings below, in this order. Instruction lines never appear in the file.

**This phase does not touch product code.** Tasks are cut from `plan.md` only, anchored in `idea.md`. No new DTs, no new RFs. `Estado`: `en-revision` durante redacción; pasa a `listo-para-aplicar` tras auditoría independiente y correcciones autónomas aplicadas en disco. Al completarse todas las tareas en `apply`, pasa a `listo-para-verify`. Si el usuario pide ajustes manuales (Opción 2), se aplican en disco manteniendo `listo-para-aplicar`.

---

# Tasks <nnn> <Nombre de la funcionalidad>

Estado: <en-revision | listo-para-aplicar | listo-para-verify>

Idea: `<nnn>-<slug>/idea.md`
Plan: `<nnn>-<slug>/plan.md`

## Reglas de ejecución

- **Granularidad:** tareas pequeñas de 20 a 30 minutos máximo. Si una tarea excede este tiempo, se divide.
- **TDD estricto:** cada tarea define y ejecuta primero el test que falla antes de tocar código de producción.
- **Commits atómicos:** commit obligatorio al terminar cada tarea y cada fase, cumpliendo Commitlint estricto de AGENTS.md (What, Why, Impact, Validation; sin trailers de IA).
- **Control de calidad por fase:** al finalizar cada fase, un auditor independiente (solo lectura) revisa el código y emite reporte. Si hay hallazgos, un **subagente reparador distinto** (no el auditor, no el conductor) aplica los ajustes. El hilo principal no parchea `apps/`.

## Fase 1: <Nombre de la fase (ej: Dominio, Contratos y Datos)>

**Llenar:** tareas de la fase consecutivas (`TASK-01`, `TASK-02`, …). Cada tarea es un corte revisable de 20 a 30 min, test first. Priorizar entrega temprana de valor de `idea.md`.

- [ ] **TASK-01: <título corto (20-30 min)>**
  - **Qué:** observable, from the plan
  - **Cubre:** RF-xx, RNF-xx, DT-xx
  - **Archivos:** `+` / `~` / `-` subset of the plan árbol
  - **Test primero (TDD):** qué test falla antes de implementar el código
  - **Listo cuando:** comprobable without a tour of the repo
  - [ ] **Commit de tarea:** commit atómico según AGENTS.md (`<type>(<scope>): <desc>`)

### Control de Fase 1

- [ ] **Auditoría independiente de Fase 1:** subagente QA revisa código de la fase contra spec/plan (readonly). Si hay hallazgos, un subagente reparador (no el conductor) aplica ajustes; re-auditoría (máx. 2).
- [ ] **Commit de Fase 1:** commit de cierre de fase validado con `pnpm quality:gate`.

## Fase 2: <Nombre de la fase (ej: Aplicación e Integración / Servicios)>

- [ ] **TASK-02: <título corto (20-30 min)>**
  - **Qué:** observable, from the plan
  - **Cubre:** RF-xx, RNF-xx, DT-xx
  - **Archivos:** `+` / `~` / `-` subset of the plan árbol
  - **Test primero (TDD):** qué test falla antes de implementar
  - **Listo cuando:** comprobable
  - [ ] **Commit de tarea:** commit atómico según AGENTS.md (`<type>(<scope>): <desc>`)

### Control de Fase 2

- [ ] **Auditoría independiente de Fase 2:** subagente QA revisa código de la fase (readonly). Si hay hallazgos, un subagente reparador (no el conductor) aplica ajustes; re-auditoría (máx. 2).
- [ ] **Commit de Fase 2:** commit de cierre de fase validado con `pnpm quality:gate`.

## Fuera de este corte

**Llenar:** plan items explicitly not tasked (or `Nada: el plan cabe entero.`).

## Dudas abiertas

**Llenar:** `[NECESITA ATENCIÓN]` + hole (including unresolved items carried over from `plan.md`), or `Ninguna.`
