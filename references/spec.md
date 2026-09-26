# Spec

Turn a saved idea into a spec. Do not plan, implement, commit, or `branch:init`. Do not copy `idea.md` into `spec.md`.

**Close contract (unskippable):** 4c → write `spec.md` → host **Task** QA (auditor independiente) → **wait for the report** → **artifact exception:** conductor patches settled `spec.md` (never `apps/`); **ask the user only for choices that are theirs** → recap + contento → on Sí, the 3-option menu. Recapping without a Task result, or ending without the menu, is a bug.

## Rules

- Questions: Rioplatense Spanish (voseo) matching persona, non-technical, brief. Artifact language strictly neutral Spanish (no voseo). No code, paths, filenames, or stack.
- One question. STOP. Wait. Options in the **chat** as `1 / 2 / 3` with **Pro**, **Contra**, **Recomendada**. **Never** host AskQuestion/select. Sí/No has no pro/contra.
- Each spec-gap question **starts** with `Pregunta k de como máximo N.` N is the complexity budget (5, 10, or 15). Say N in the same turn as Q1, before the question. Host 1/1 is still forbidden.
- Do not re-ask facts already settled in `idea.md`. Ask only holes that would make the spec untestable: errors, empty, permission, edge, out of this cut, done-when.
- Before the first **spec-gap** question (after the idea is chosen), the conductor **must** Read `CONSTITUTION.md`, `AGENTS.md`, and that `idea.md`. Picking which idea is allowed before those reads. No spec-gap question until then.
- Recap **is** the spec, in chat: locked headings from `spec-template.md` in that order, **fill rules applied, instruction text stripped**. No extra `##`. A recap that omits a heading, adds a heading, or leaves `<angle hints>` is invalid.
- Qué and por qué. Agent writes EARS from their answers using the template’s EARS shapes. They do not have to speak EARS. The RF set must cover the template’s comprobable list (who can/cannot, happy path, cannot proceed, empty/first time, what remains after). Missing coverage → question if budget remains; else `[NECESITA ATENCIÓN]`.
- `[NECESITA ATENCIÓN]` is required for every hole still untestable. Before writing, privately tick: quién puede/no, camino que sí, no puede seguir, vacío/primera vez, qué queda después. Each **unchecked** item → one Dudas line. Also: skips, cap-cuts, QA list (except dropped false positives). `Ninguna` only if all five ticks are checked **and** QA listed no remaining ambiguities. Do not invent extras.
- After every answer: privately check harm, security, privacy, trust. If none, settle. If yes: one short `Oye, fíjate que…` and wait. Skip unless it would actually hurt. If they keep the risk, it is settled.
- Diagramas: one simple mermaid, only if it clarifies a story they settled. Else `Ninguno.` At most one `¿Quieres un diagrama simple de esto?` inside the budget.
- **Close is invalid** unless all of these happened in order: (1) 4c “agregar algo”, (2) write, (3) host Task QA with a returned report, (4) user asked only for their decisions, (5) after Sí, the three-option menu. Do not simulate QA. Do not STOP after recap.

## Explore (conductor does none)

Same ban as Intake: conductor does not Grep/Glob/Web/product `Read`. **Do not** spawn Gentle `sdd-explore`.

**Allowed** on the conductor: this skill, `spec-template.md`, `CONSTITUTION.md`, `AGENTS.md`, `idea.md` / `spec.md` in that vsdd folder, short `mem_search`, list `docs/sdd/vsdd/` to pick the idea, write `spec.md` in the close (**artifact exception:** patches after QA on `spec.md` only, never `apps/`). Never paste Constitution or AGENTS.

**Wave 1** (idea loaded, same turn, silent): one `explore` host subagent Task (fast/cheap model, e.g. `composer-2.5-fast`, `flash`, `haiku`), thoroughness **quick**, **no web**. Prompt = idea text + “no seeds that break tenant isolation, fail-closed, or stack/how” + this shape, **≤12 lines**:

```text
Complejidad: 5 | 10 | 15
Q1: (hueco que impide una spec comprobable; 2-3 etiquetas)
Temas: (otros huecos, una etiqueta cada uno)
```

Empty or a dump: do **not** retry. Q1 from `idea.md` holes. Never paste.

**Wave 2** — after Wave-1 topics are done. Silent. Do **not** rubber-stamp. No topic checklist.

1. Would a short look at how this is done, how we are doing it, and what needs attention now change the next question? If leftovers are only local taste: **stop. No Task.**
2. One `explore` host subagent Task, same cheap model, **quick**, **with web**. Idea + settled spec answers (no tenants, paths, ids, copy, credentials). At most **2** generic queries on **that** subject. **≤12 lines**: `Nuevos` / `Saltar`.
3. Ask `Nuevos` (they count in the budget). Empty or skipped: say nothing. Never paste.

**Use or fail:** questions **are** those seeds. A generic “cuéntame los RF” while the report sits unused is a bug.

## Budget

From Wave-1 `Complejidad` (or `idea.md` if empty): **5** simple, **10** medium, **15** complex. N is a **ceiling**, not a promise (you may ask fewer). **Tell N** in the Q1 turn: `Como máximo N preguntas, una por turno. Puede ser menos. Al final te pregunto si quieres agregar algo.` Each spec-gap question: `Pregunta k de como máximo N.` Cap includes Wave-2 `Nuevos`. Cap-cut leftovers → `[NECESITA ATENCIÓN]`. Do **not** jump from Temas to recap; the only exit is 4c. **Always** 4c, labeled `Última (fuera del cupo):` + `¿Quieres agregar o aclarar algo, o lo dejamos así?` Skipping 4c is a bug.

## Loop

0. Need `idea.md` with `Estado: listo-para-spec`. None → one line: first Intake. One → use it. Several → numbered list in chat. Wait. Existing `spec.md` in that folder → numbered: seguir (jump directly to step 9/10, do not re-interview) / rehacer / otra idea. Wait.
1. **After the idea is chosen, before any spec-gap question**, Read `CONSTITUTION.md`, `AGENTS.md`, and that `idea.md`. Starting the interview without those three reads is a bug. Silent: drop options that would violate the Constitution; keep AGENTS limits (qué/por qué, no stack, Spanish MX). Do not paste those files. One line: vamos a cerrar huecos, una cosa a la vez.
2. Same turn, silent: Wave-1 + `mem_search`. Rank only those seeds (idea + Constitution, not a repo tour).
3. Same turn as Wave-1: one line with N, then Q1 as `Pregunta 1 de como máximo N.` Wait. A different Q1 is a bug.
4. Walk `Temas` (`¿Quieres decidir X?` or a fork with pro/contra), each as `Pregunta k de como máximo N.` Do not recap after Q1. After the last Tema (or when you would otherwise recap), go to 4b then **4c**. Never recap from here.
   4b. Wave 2 steps; walk `Nuevos` the same way.
   4c. **Always**, labeled `Última (fuera del cupo):` `¿Quieres agregar o aclarar algo, o lo dejamos así?` Wait. Do not recap before this. Do not write before this.
5. Off-menu answer: that is the decision; confirm in one line inside the next question.
6. Two answers contradict: one tie-break (last answer recommended). Recap only when the close starts.
7. Mid-loop they ask to save the spec: one line, `van k de N`. Do not skip 4c or QA.

## Close (do not skip, do not reorder)

8. On the turn **after** 4c is answered: privately tick the five comprobable items. Write `docs/sdd/vsdd/<nnn>-<slug>/spec.md` (template filled, instruction text stripped, `Estado: en-revision`). Unchecked ticks + skips + cap-cuts → **Dudas abiertas** as `[NECESITA ATENCIÓN]`. Collision: do not overwrite without them saying rehacer.
9. **Same turn, required:** invoke host subagent (using host mechanism: `invoke_subagent` in Antigravity, `Task` in Cursor; medium/reasoning model, e.g. `pro`, `sonnet`/`opus`; not the fast explorer, not Gentle). Readonly. Do **not** invent the report. **Do not recap, contento, or menu until the Task has returned.** Empty/tool failure: retry **once**. If the host tool repeatedly fails due to infrastructure/network, inform the user and offer: `1) Reintentar auditoría`, `2) Continuar bajo mi propio riesgo (skip manual documentado en Dudas abiertas como [NECESITA ATENCIÓN: auditoría técnica no ejecutada por fallo de entorno])`; otherwise treat as `bloquea`. Never paste the report. Prompt must include paths to `spec.md`, `idea.md`, `CONSTITUTION.md`, and `AGENTS.md`, and this shape only:

```text
Rol: QA de spec. No propongas soluciones ni reescribas la spec.
1) Ambigüedades que quedan
2) Contradicciones entre requisitos (y vs idea.md)
3) Casos límite no cubiertos
4) Conflictos con CONSTITUTION.md (y voz/límites de AGENTS.md: qué/por qué, sin stack)
Marca cada hallazgo: ajuste-de-spec | decide-el-usuario
Veredicto: limpio | ok-con-huecos | bloquea
Cada hallazgo: una línea, qué y dónde. Sin stack. ≤40 líneas.
```

10. When the report is back (**artifact exception:** patch `spec.md` only, never `apps/`): classify each finding. Drafting defect on **already settled** facts (`ajuste-de-spec`) → patch `spec.md`. Needs a product choice (`decide-el-usuario`) → one question, STOP, wait, then resume here. Constitution fork → question; if the spec violates a rule they already accepted, patch. Drop false positives only with a private reason. Do not add features to “fix” QA. Every QA ambiguity you did not ask → add to Dudas (patch the file **before** recap). At most **3** QA-driven user questions; leftovers that are theirs → Dudas unless Constitution **blocks**. Then recap the spec in chat (template headings). Same message: `¿Estás contento con esta spec?` Sí / No. Wait. No → one question on what to change; patch `spec.md` on disk with the agreed change before recapping; recap again only after that answer.
11. The turn whose user message is Sí: ensure `spec.md` reflects all recap changes and set `Estado: listo-para-plan`. `mem_save` `topic_key: vsdd-spec-<slug>`, `type: decision`, `title: "vsdd spec <slug>"`, `content: spec summary`. If you patched after QA, **one** line of what changed. Then the message **must be** this menu (numbered, no pro/contra) and wait — nothing else except that one patch line:

```text
Quedó spec.md lista para revisar.
1. Revisar la spec
2. Pasar a planificación
3. Lanzar otra verificación independiente
```

1 → wait for their comments (still Spec); on user comments: patch `spec.md` on disk, route to step 10 (recap + happy-check). 2 → **Plan**: read `references/plan.md` and start that phase (same folder). 3 → spawn QA again (step 9), **wait for the report**, then 10–11. Ending Spec without this menu is a bug.

## Output

Questions: `Pregunta k de como máximo N` + current question. Exit only via 4c. Next turn: write, Task QA, **wait**, recap, contento. Sí turn: menu (revisar / planificación / otra verificación). Option 2 starts Plan. No product code.
