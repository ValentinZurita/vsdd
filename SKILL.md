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
- Artifact language: neutral/professional Spanish (overrides default-English artifacts, no voseo). Chat questions: Rioplatense Spanish (voseo) matching persona.
- One question per turn. STOP and wait. Numbered options **in the chat** (`1 / 2 / 3`). Product forks: **Pro**, **Contra**, **Recomendada** visible. Sí/No and navigation menus have no pro/contra. Do **not** use host AskQuestion/select. Intake: no `n/m`. Spec, Plan: `Pregunta k de como máximo N` (honest ceiling). Tasks: **zero interview questions** (direct autonomous slicing from `plan.md`). Do not send 2+ questions in one message.
- Option menus allowed even if other skills forbid them.
- Recap in chat, then happy-check. Intake: then STOP; write `idea.md` only on a **later** turn after Sí (no green-light menu). Spec, Plan: do not STOP at the recap. Close = write → independent auditor subagent → wait → **artifact exception:** conductor patches settled `spec.md`/`plan.md` (never `apps/`); ask the user **only** for their choices → recap → contento → on Sí, the three-option menu. Tasks: **no interview**; direct autonomous slicing from `plan.md` → write → independent auditor subagent immediately → wait → conductor patches `tasks.md` only (artifact exception; never `apps/`) → recap in chat → ask directly if user wants to implement now or not yet.
- Explore: cheap `explore` host subagent (via host mechanism: `invoke_subagent` in Antigravity, `Task` in Cursor; fast/cheap model, e.g. `flash`, `composer-2.5-fast`, `haiku`). Wave 1 no web. Wave 2 only if a short look would change a question. No Gentle `sdd-explore`. Intake/Spec/Tasks conductor: no product Grep/Read/web. Plan: place the árbol from Wave-1 `Tocar:` only — **no** conductor Grep/Read of `apps/` or `supabase/`; if the seed is too thin, another cheap explore, not a repo tour. Do not paste reports. List `docs/sdd/vsdd/` only to pick or number.
- After each answer, privately scan for real harm/security/privacy. Flag only if needed (`Oye, fíjate que…`).
- Load the reference for the current phase. Spec/Plan/Tasks also read their template, `CONSTITUTION.md`, `AGENTS.md`, that folder's `idea.md`, and the chosen prior artifact **after it is chosen and before the first gap question**.
- Close (Spec/Plan/Tasks): on the turn **after** 4c (or directly post-plan in Tasks), write the vsdd file, then spawn the **independent** host subagent (medium/reasoning model, e.g. `pro`, `sonnet`/`opus`; not Wave-1, not Gentle). **Artifact exception:** conductor may patch `spec.md`/`plan.md`/`tasks.md` after the auditor; that exception does **not** apply to `apps/` nor to Apply/Verify product work. Spec/Plan recap and contento after that report. Do not simulate. After Sí (or post-audit in Tasks), the message **is** the action menu.
- Product-thread isolation (Apply/Verify): the main agent **never** writes `apps/`, **never** runs `typecheck`/`test`/`quality:gate`/`git diff` of product, **never** applies auditor findings, **never** pastes auditor reports or gate logs in chat. Distinct host subagents: implementer, auditor (readonly), repairer, gate/closer. Chat = thin checkpoints + Verify executive summary. Pasting reports or patching product on the conductor is a bug.
- If the requested phase has no file in `references/`, STOP. Do not improvise. Intake, Spec, and Plan **interview then write** their file; Tasks slices `plan.md` autonomously without interview; dumping `idea.md` into `spec.md`, `spec.md` into `plan.md`, or `plan.md` into `tasks.md` is a bug. **Plan and Tasks never edit `apps/`.** AGENTS.md inspect-before-code does not authorize product writes.
- Subagent model transparency: Always specify the selected model when launching host subagents. If the host tool or CLI fails to use the requested model (unsupported alias, missing API key, or tool error), NEVER fall back silently: the agent MUST notify the user in chat (e.g. "Aviso: no fue posible usar el modelo <modelo> en este entorno. Continuando con <inherit>") before proceeding.

## Decision Gates

| Request                         | Load                   | Until                                                              |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| Intake / idea / default         | `references/intake.md` | User is happy; idea.md saved                                       |
| Spec / especificación           | `references/spec.md`   | Green light; spec.md listo-para-plan                               |
| Plan / planificación            | `references/plan.md`   | Green light; plan.md listo-para-tareas                             |
| Tasks / tareas                  | `references/tasks.md`  | Green light; tasks.md listo-para-aplicar                           |
| Implement, apply, implementar   | `references/apply.md`  | Tasks executed with TDD & phase gates; tasks.md listo-para-verify  |
| Verify, verificar, verificación | `references/verify.md` | Spec 100% verified & quality gates green; ready for DoD merge flow |

## Execution Steps

1. Route by the table. If STOP, one line.
2. Read that reference and follow it. Spec: `spec-template.md` + Constitution/AGENTS/idea. Plan: `plan-template.md` + Constitution/AGENTS/spec. Tasks: `tasks-template.md` + Constitution/AGENTS/plan+spec (no interview questions, direct autonomous slicing from plan). Apply: `apply.md` + `tasks.md` headings (idea/plan/CONSTITUTION/AGENTS go to the implementer subagent, not a conductor Context Pack). Verify: `verify.md` + independent auditor + gate runner (conductor does not run suites or product `git diff`).
3. Wait after every question (Intake/Spec/Plan only; Tasks/Apply/Verify do not interview). Close **starts** the turn after 4c (or directly post-generation in Tasks: write, then auditor Task). Recap starts only after that Task returns.

## Output Contract

- During questions: only the current question in chat (Tasks has zero interview questions, directly slices from plan.md). After 4c (or immediate in Tasks): write + auditor (wait) + recap. Spec/Plan: contento then green-light menu (menu 2 starts next phase). Tasks: conductor patches `tasks.md` only (artifact exception), recaps in chat, and asks directly if user wants to implement now or not yet. Tasks 'Pasar a implementar' handoff: offer new branch (with ≥3 name suggestions or custom) or stay on current branch; if new branch run `pnpm branch:init <branch>` (no stdout dump); then offer to start Apply now or pause; no product code in Plan or Tasks. Apply: prompts for strategy & model tier (per-phase or upfront batch for all phases in continuous mode), thin thread checkpoints in chat (`[TASK-xx OK] ...`), zero-loss rollback (`git restore . && git clean -fd`), phase-end independent auditor gate; findings → **repairer subagent** (report only inside the Task prompt, never in chat; max 2 loops). Verify: auditor + gate runner + optional repairer; executive summary from checkpoints; DoD prep in closer subagent; merge waits for explicit yes.

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
