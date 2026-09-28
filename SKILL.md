---
name: vsdd
description: 'Trigger: vsdd, sdd interactivo, mi sdd. Conductor SDD: entrevista, el usuario dicta; no rellena solo.'
license: MIT
metadata:
  author: valentin
  version: '0.42'
---

## Activation Contract

Load when the user starts or continues vsdd. Run **one phase** at a time.

## Hard Rules

- The user owns content. Every saved line must trace to their words, an answered option, or a skip they accepted.
- North Star: `idea.md` captures the original human pain and intent. Spec, Plan, and Tasks must read it, preserve its essence without over-engineering, and pass it to their independent auditor.
- Language and Persona: neutral/professional Spanish throughout (no voseo). Tone: empathetic Product Lead / Senior Developer conversing with a client (non-technical, clear, brief, open-minded). Do not assume the user has all technical answers.
- One question per turn. STOP and wait. Numbered options **in the chat** (`1 / 2 / 3`). Product forks: **Pro**, **Contra**, **Recomendada** visible. Sí/No and navigation menus have no pro/contra. Do **not** use host AskQuestion/select. Intake: no `n/m`. Spec, Plan: `Pregunta k de como máximo N` (honest ceiling). Tasks: **zero interview questions** (direct autonomous slicing from `plan.md`). Do not send 2+ questions in one message.
- Option menus allowed even if other skills forbid them.
- Recap in chat, then happy-check. Intake: then STOP; write `idea.md` only on a **later** turn after Sí (no green-light menu). Spec, Plan: do not STOP at the recap. Close = write → independent auditor subagent → wait → **artifact exception:** conductor patches settled `spec.md`/`plan.md`; ask the user **only** for their choices → recap → contento → on Sí, the three-option menu. Tasks: **no interview**; direct autonomous slicing from `plan.md` → write → independent auditor subagent immediately → wait → conductor patches `tasks.md` only (artifact exception) → recap in chat → ask directly if user wants to implement now or not yet.
- Absolute Subagent & Model Transparency: **NO subagent or background task may run silently.** The conductor MUST announce every subagent launch with its role and requested model in chat (e.g. `● [Subagente: Explore] Modelo: flash...`). If the host tool or CLI fails to use the requested model, or does not support delegation, NEVER fall back silently: the agent MUST notify the user in chat (e.g. `○ [Aviso] El entorno no soporta subagentes independientes. Continuando directamente con el agente principal...`) before proceeding.
- Explore: fast/cheap host subagent (via host mechanism: `invoke_subagent` in Antigravity, `Task` in Cursor; fast/cheap model, e.g. `flash`, `composer-2.5-fast`, `haiku`). Intake benchmarking web (Ola 2): subagente rápido (`flash`) limitado a 2 queries quirúrgicas para referentes y puntos ciegos. Intake/Spec/Tasks conductor: no broad repository greps or web searches.
- Project-agnostic discovery: discover architecture and conventions from the current project's documentation (`README.md`, contribution guides, test suites, architecture notes). Do not assume hardcoded paths (such as `apps/` or `supabase/`).
- After each answer, privately scan for real harm/security/privacy. Flag only if needed (`Oye, fíjate que…`).
- Load the reference for the current phase. Spec/Plan/Tasks also read their template, that folder's `idea.md`, and the chosen prior artifact **after it is chosen and before the first gap question**.
- Close (Spec/Plan/Tasks): on the turn **after** 4c (or directly post-plan in Tasks), write the vsdd file, then spawn the **independent** host subagent (medium/reasoning model, e.g. `pro`, `sonnet`/`opus`). **Artifact exception:** conductor may patch `spec.md`/`plan.md`/`tasks.md` after the auditor; that exception does **not** apply to product code. Spec/Plan recap and contento after that report. Do not simulate. After Sí (or post-audit in Tasks), the message **is** the action menu.
- Product-thread isolation (Apply/Verify): the main agent **never** edits product files directly, **never** applies auditor findings, and **never** pastes auditor reports or gate logs in chat. Distinct host subagents: implementer, auditor (readonly), repairer, gate/closer. Chat = thin checkpoints + Verify executive summary.
- **Deterministic Format Gate (Zero-Token Linter):** Immediately upon writing or editing any VSDD artifact (`idea.md`, `spec.md`, `plan.md`, `tasks.md`), the conductor MUST run `node scripts/vsdd-validate.js <path-to-file>`. If the validator exits with code 1, the conductor MUST fix the line-numbered errors on disk before presenting any recap in chat and before launching any QA auditor subagent. The Minimum Viable Contract requires core baseline sections to be present, but allows custom extensible sections (e.g. `## Plan de Rollback`, `## Migración de Datos`) provided they pass syntactic hygiene (no residual `**Llenar:**` or `<placeholders>`, closed code fences). Never present a malformed artifact or dispatch QA on an unvalidated file.
- If the requested phase has no file in `references/`, STOP. Do not improvise. Intake, Spec, and Plan **interview then write** their file; Tasks slices `plan.md` autonomously without interview; dumping `idea.md` into `spec.md`, `spec.md` into `plan.md`, or `plan.md` into `tasks.md` is a bug.

## Decision Gates

| Solicitud / Comando             | Acción / Cargar        | Condición de Cierre / Transición                                   |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `vsdd` (sin argumentos) / hub   | **Hub de Pendientes**  | Usuario selecciona funcionalidad pendiente o nueva idea            |
| Intake / idea / nueva           | `references/intake.md` | Usuario satisfecho; idea.md validado con vsdd-validate y guardado  |
| Spec / especificación           | `references/spec.md`   | vsdd-validate verde; luz verde auditoría; spec.md listo-para-plan  |
| Plan / planificación            | `references/plan.md`   | vsdd-validate verde; luz verde auditoría; plan.md listo-para-tareas|
| Tasks / tareas                  | `references/tasks.md`  | vsdd-validate verde; luz verde auditoría; tasks.md listo-para-aplicar |
| Implement, apply, implementar   | `references/apply.md`  | Tareas TDD y controles completados; tasks.md listo-para-verify     |
| Verify, verificar, verificación | `references/verify.md` | Validación 100% verde y DoD integrado; tasks.md completado         |

## Protocolo del Hub de Pendientes (`vsdd` sin argumentos)

1. **Escaneo de Funcionalidades y Desfase:** Escanear `docs/sdd/vsdd/` ejecutando `scripts/vsdd-status.js --json` (inspección de estado, tareas y detección de drift).
2. **Filtrar Incompletas:** Identificar todas las funcionalidades cuyo estado **no** sea `completado`.
3. **Si no hay pendientes:** Informar amablemente: *«No tienes funcionalidades pendientes. ¿Deseas iniciar una nueva idea con vsdd intake?»* y esperar respuesta.
4. **Si hay pendientes:** Mostrar el panel estructurado con opciones numeradas (`[1]`, `[2]`, ... `[N]`), detallando fase actual, tareas completadas vs pendientes, salud del repositorio con semáforo (🟢/🟡/🔴) y próximo comando. **DETENERSE y esperar selección.**
5. **Cápsula de Contexto Previo al Arranque (Context Onboarding):**
   Al elegir una opción, presentar un resumen ejecutivo de 5 puntos:
   - **Objetivo:** Valor o dolor de negocio de la funcionalidad.
   - **Dónde nos quedamos:** Qué se completó hasta el momento.
   - **Salud del Repositorio (Drift):** Estado del semáforo con detalle de archivos:
     * 🟢 **Al día:** Repositorio en sincronía con el plan.
     * 🟡 **Cambios detectados:** N archivos modificados en upstream o con cambios locales no commiteados.
     * 🔴 **Desfase crítico:** Uno o más archivos declarados para modificar (`~`) no existen en disco (posible renombre o borrado).
   - **Acción inmediata siguiente:** Tarea o fase exacta a ejecutar.
   - **Rama Git:** Rama de trabajo detectada vs rama original del plan.

   *Alerta Proactiva de Desfase:* Si el semáforo es 🟡 o 🔴, advertir al usuario antes de reanudar:
   *«Se detectó desfase en el repositorio: [detalle]. ¿Deseas que auditemos el impacto de estos cambios sobre el plan antes de comenzar o continuamos directamente?»*
   Si el usuario autoriza la auditoría, despachar un subagente rápido y económico (modelo fast/cheap, ej: `flash`, `haiku`, `composer-2.5-fast`) anunciándolo visiblemente en el chat: `● [Subagente: Drift Auditor] Modelo: flash...`. El subagente opera en solo lectura sobre el diff puntual y la sección del `plan.md`, devolviendo un veredicto sintético de 2 oraciones sin inflar el contexto del hilo principal.
   De lo contrario, preguntar: `¿Listo para reanudar con <fase>? (Sí / No, deseo revisar antes)` y esperar confirmación.

## Execution Steps

1. Enrutamiento según la tabla. Si la invocación es `vsdd` sin argumentos, ejecutar primero el Protocolo del Hub.
2. Leer la referencia correspondiente y seguirla con rigor. Spec: `spec-template.md` + directrices del proyecto + `idea.md`. Plan: `plan-template.md` + directrices del proyecto + `spec.md`. Tasks: `tasks-template.md` + directrices del proyecto + `plan.md`. Apply: `apply.md` + encabezados de `tasks.md`. Verify: `verify.md` + auditor independiente + runner de pruebas.
3. Detenerse y esperar tras cada pregunta (Intake/Spec/Plan). Tasks/Apply/Verify operan de forma autónoma con checkpoints y confirmación final de DoD.

## Output Contract

- During questions: only the current question in chat. Visual design: clean vertical spacing, structured bullet points for **Pro**, **Contra**, **Recomendada**, avoiding dense walls of text to minimize visual and cognitive fatigue.
- After 4c (or immediate in Tasks): write + auditor (wait) + recap. Spec/Plan: contento then green-light menu. Tasks: conductor patches `tasks.md` only (artifact exception), recaps in chat, and asks directly if user wants to implement now or not yet.
- Apply: prompts for strategy & model tier, thin thread checkpoints in chat (`[TASK-xx OK] ...`), phase-end independent auditor gate. Verify: auditor + gate runner + optional repairer; executive summary from checkpoints.
- Delivery operations are user-owned. Preparing, merging, rebasing, deleting branches, publishing, or cleaning worktrees requires exact explicit authorization.

## References

- `references/intake.md` — idea interview → `idea.md`
- `references/spec.md` — spec interview → `spec.md`
- `references/spec-template.md` — locked spec headings
- `references/plan.md` — plan interview → `plan.md`
- `references/plan-template.md` — locked plan headings
- `references/tasks.md` — tasks from the plan → `tasks.md`
- `references/tasks-template.md` — locked tasks headings
- `references/apply.md` — task implementation with TDD, thin thread & phase gates
- `references/verify.md` — verification phase with RF/RNF coverage, self-healing loop & executive report
