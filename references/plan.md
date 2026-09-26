# Plan

Turn a green-lit spec into a plan. **This phase does not touch product code** (no edits under `apps/`, no tests written, no migrations applied). Do not implement, commit, or `branch:init`. Do not copy `spec.md` into `plan.md`. Only write/patch `plan.md` in the vsdd folder.

**Close contract (unskippable):** 4c → write `plan.md` → **auditor independiente** (host Task) → **wait for the report** → **artifact exception:** conductor patches settled `plan.md` (never `apps/`); **ask the user only for choices that are theirs** → recap + contento → on Sí, the 3-option menu. Recapping without a Task result, or ending without the menu, is a bug.

## Rules

- Questions: Rioplatense Spanish (voseo) matching persona, brief. Artifact language strictly neutral Spanish (no voseo). This phase **may** name a module or a path when the fork is where work lands. No production code in chat. **Never** host AskQuestion/select.
- Product/tech forks in chat as `1 / 2 / 3` with **Pro**, **Contra**, **Recomendada**. Sí/No has no pro/contra.
- Each plan-gap question **starts** with `Pregunta k de como máximo N.` N from complexity (5, 10, or 15). Say N in the Q1 turn. Host 1/1 is forbidden. N is a **ceiling**.
- Do not re-ask product facts settled in `spec.md`. Ask only **how** holes: where it lives, data or not, a how-fork if two are defensible, how it is tested. Do not invent a DT when there is no fork.
- After the spec is chosen, **before** the first plan-gap question, Read `CONSTITUTION.md`, `AGENTS.md`, that folder's `idea.md` (the essence anchor), and that `spec.md` (`Estado: listo-para-plan`). Starting without reading all four is a bug. Do not paste them.
- Recap **is** the plan, in chat: `plan-template.md` headings only, instructions stripped. No extra `##`. A recap that omits a heading, adds a heading, or leaves `<angle hints>` is invalid.
- Every RF and RNF from the spec must appear in **Cobertura**. Missing row → question if budget remains; else `[NECESITA ATENCIÓN]`.
- Before writing, privately tick: every RF has a home, every RNF has a home, every DT has a discarded alternative, árbol uses `+`/`~`/`-`, tests exist, every `[NECESITA ATENCIÓN]` from `spec.md` is resolved in a DT or preserved in Dudas abiertas, the plan preserves the core intent and scope of `idea.md` without over-engineering. Unchecked → Dudas.
- After every answer: harm check (`Oye, fíjate que…` only if needed).
- Diagramas: simple mermaid only if it clarifies a boundary or DT. Else `Ninguno.`
- **Close is invalid** unless: (1) 4c, (2) write, (3) independent auditor Task with a returned report, (4) user asked only for their decisions, (5) after Sí, the menu. Do not simulate the auditor. Do not STOP after recap.

## Explore

**Do not** spawn Gentle `sdd-explore`. Wave-1/2 reports are question seeds; never paste.

**Allowed** on the conductor: this skill, `plan-template.md`, `CONSTITUTION.md`, `AGENTS.md`, `idea.md` / `spec.md` / `plan.md` in that vsdd folder, short `mem_search`, list `docs/sdd/vsdd/` to pick. **No conductor Grep/Read of `apps/` or `supabase/`.** Place the árbol from Wave-1 `Tocar:` (and Wave-2 if it ran). If that seed is too thin, another cheap explore subagent — not a repo tour on the conductor. AGENTS.md inspect-before-code does not authorize writes. No package installs. The only write is `plan.md`.

**Wave 1** (spec loaded, same turn, silent): one `explore` host subagent Task (fast/cheap model, e.g. `composer-2.5-fast`, `flash`, `haiku`), thoroughness **quick**, **no web**. Prompt = spec (RF list + corte) + “where this would land; no novel stacks” + this shape, **≤12 lines**:

```text
Complejidad: 5 | 10 | 15
Q1: (fork técnico que el dueño notaría; 2-3 etiquetas)
Temas: (otros how-holes, una etiqueta cada uno)
Tocar: (módulos o carpetas ya existentes, 1 línea)
```

Empty or a dump: do **not** retry. Q1 from spec how-holes. Never paste.

**Wave 2** — after Wave-1 topics. Same anti-rubber-stamp as Spec. Skip if leftovers are local taste. If it runs: cheap host subagent Task, **quick**, **with web**, ≤2 generic queries, `Nuevos` / `Saltar`. `Nuevos` count in the budget.

**Use or fail:** questions **are** those seeds.

## Budget

**5** simple (one module, spec sharp), **10** medium, **15** complex. Tell N at Q1: `Como máximo N preguntas, una por turno. Puede ser menos. Al final te pregunto si quieres agregar algo.` Cap-cut leftovers → `[NECESITA ATENCIÓN]`. Only exit from Temas is 4c. **Always** 4c, labeled `Última (fuera del cupo):` `¿Quieres agregar o aclarar algo, o lo dejamos así?`

## Loop

0. Need `spec.md` with `Estado: listo-para-plan`. None → one line: first Spec. One folder → use it. Several → numbered list. Wait. Existing `plan.md` → seguir (jump directly to step 9/10, do not re-interview) / rehacer / otra spec. Wait.
1. After the spec is chosen, Read `CONSTITUTION.md`, `AGENTS.md`, `idea.md`, that `spec.md`. One line: vamos a cerrar el cómo sin perder la esencia de la idea, una cosa a la vez.
2. Same turn, silent: Wave-1 + `mem_search`. Rank only those seeds.
3. Same turn: one line with N, then Q1 as `Pregunta 1 de como máximo N.` Wait.
4. Walk `Temas` with `Pregunta k de como máximo N.` Never recap from here; go 4b then **4c**.
   4b. Wave 2; walk `Nuevos`.
   4c. **Always** `Última (fuera del cupo):` `¿Quieres agregar o aclarar algo, o lo dejamos así?` Wait. Do not write before this.
5. Off-menu: that is the decision; confirm in the next question.
6. Contradict: one tie-break (last answer recommended).
7. Mid-loop save ask: `van k de N`. Do not skip 4c or the auditor.

## Close (do not skip, do not reorder)

8. Turn **after** 4c: tick RF/RNF/DT/árbol/tests. Write `docs/sdd/vsdd/<nnn>-<slug>/plan.md` (template filled, `Estado: en-revision`). Unchecked → Dudas `[NECESITA ATENCIÓN]`. Collision: no overwrite unless rehacer.
9. **Same turn — auditor independiente, required.** Host subagent (using host mechanism: `invoke_subagent` in Antigravity, `Task` in Cursor; medium/reasoning model, e.g. `pro`, `sonnet`/`opus`; not the fast explorer, not Gentle). Readonly. **Wait for the report.** Do not invent it. Empty/tool failure: retry once. If the host tool repeatedly fails due to infrastructure/network, inform the user and offer: `1) Reintentar auditoría`, `2) Continuar bajo mi propio riesgo (skip manual documentado en Dudas abiertas como [NECESITA ATENCIÓN: auditoría técnica no ejecutada por fallo de entorno])`; otherwise treat as `bloquea`. Never paste the report to the user. Prompt paths: `plan.md`, `spec.md`, `idea.md`, `CONSTITUTION.md`, `AGENTS.md`, and:

```text
Rol: auditor independiente del plan. No propongas soluciones. No reescribas el plan.
1) RF/RNF de la spec sin fila en Cobertura
2) DT sin alternativa descartada
3) Árbol que no cuadra con Módulos, o código de más
4) Conflictos con CONSTITUTION.md y AGENTS.md (hexágono, tenant, límites, voz)
5) Desviación, sobre-ingeniería o conflicto con la intención y problema de idea.md
Veredicto: limpio | ok-con-huecos | bloquea
Cada hallazgo: una línea, qué y dónde. ≤40 líneas.
Marca cada hallazgo: ajuste-del-plan | decide-el-usuario
```

10. **Artifact exception (conductor patches `plan.md` only, never `apps/`)** when the report is back:
    - `ajuste-del-plan` (wording, missing coverage row, árbol path, DT already implied by spec/answers) → patch `plan.md`. Do not ask.
    - `decide-el-usuario` (two hows still defensible, or Constitution fork they did not settle) → **one** question, STOP, wait, then resume. That is the only reason to interrupt them after the auditor.
    - False positives: drop with a private reason. Do not add features “to satisfy QA”.
    - Unasked leftover holes → Dudas `[NECESITA ATENCIÓN]` (patch **before** recap). At most **3** user questions from this report; more leftovers → Dudas unless Constitution **blocks**.
    - Then recap the plan in chat. `¿Estás contento con este plan?` Sí / No. Wait. No → one question on what to change; patch `plan.md` on disk with agreed changes before recapping again; repeat until Sí.
11. Sí turn: ensure `plan.md` reflects all recap changes and set `Estado: listo-para-tareas`. `mem_save` `topic_key: vsdd-plan-<slug>`, `type: decision`, `title: "vsdd plan <slug>"`, `content: plan summary`. At most one line of what the auditor caused to change. Then **only** this menu:

```text
Quedó plan.md listo. El código del producto no se tocó.
1. Revisar el plan
2. Aprobar y pasar a tareas
3. Lanzar otra auditoría independiente
```

1 → wait for their comments (still Plan); on user comments: patch `plan.md` on disk, route to step 10 (recap + happy-check). 2 → **Tasks**: read `references/tasks.md` and start that phase (same folder). 3 → another independent auditor (step 9), wait, then 10–11. Ending Plan without this menu is a bug.

## Output

Questions: `Pregunta k de como máximo N` + current question. Exit only via 4c. Next turn: write, independent auditor, wait, patch or ask only their choices, recap, contento. Sí turn: menu (revisar / tareas / otra auditoría). No product code.
