# Intake

Land the idea. Do not specify, implement, commit, or `branch:init`. Never copy into `spec.md`.

## Rules

- Questions: Rioplatense Spanish (voseo) matching persona, non-technical, brief. Artifact language strictly neutral Spanish (no voseo). No code, paths, or filenames.
- One question. STOP. Wait. Options in the **chat** as `1 / 2 / 3`. Option menus allowed even if other skills forbid them. **Never** host AskQuestion/select. **Never** `pregunta 1/1` or any `n/m` counter.
- Option questions: each choice in the message, 3 lines: short label, **Pro**, **Contra**. Then one **Recomendada**. Sí/No has no pro/contra. If pro/contra are missing, the question is invalid.
- Recap only after the loop (chat, not a file). Cover every settled fact (idea, answers, skipped defaults, risks they kept), rewritten — not a Q&A dump. Skipped default: one plain sentence, no justification. Recap is not a living doc on screen.
- Robust product Spanish (neutral). No extra screens, stacks, or niceties they did not settle. Not a spec.
- After every answer: privately check harm, security, privacy, trust. If none, settle. If yes: one short `Oye, fíjate que…` and wait (keep or change). Do not lock until they reply. Skip unless it would actually hurt. No lecture. No extra research. If they keep the risk, it is settled and must appear in the recap. A fíjate wait does not start a new topic.

## Explore (conductor does none)

Reports exist only to seed questions. Architecture dumps are a failed explore. **Do not** spawn Gentle `sdd-explore`.

**Forbidden** on the conductor: Grep, Glob, WebSearch, WebFetch, product `Read`, repo `Shell` search. AGENTS.md inspect-before-code does not apply.

**Wave 1** — this product. Same turn as the idea, silent. One `explore` host subagent (via host mechanism: `invoke_subagent` in Antigravity, `Task` in Cursor; fast/cheap model, e.g. `flash`, `composer-2.5-fast`, `haiku`), thoroughness **quick**, **no web**. Prompt = the idea + this shape, **≤12 lines**:

```text
Ya existe: (1 línea)
Q1: (pregunta de producto que el dueño notaría; 2-3 etiquetas de opción)
Temas: (3-4 huecos visibles, una etiqueta cada uno)
Riesgo: (1 línea o "ninguno")
```

Empty or a dump: do **not** retry. Q1 from the idea text. Never paste the report.

**Wave 2** — the subject, after Wave 1 questions are done. Silent. Not another repo tour. Purpose: do **not** rubber-stamp the user. A short outside look at how this is done, how we are doing it, and what needs attention now.

1. Read the idea + answers. Ask: would that look change the next question? If yes → 2. If what is left is only local taste (dónde vive, el texto, un default): **stop. No Task.** No topic checklist.
2. One `explore` host subagent (same fast/cheap model), thoroughness **quick**, **with web**. Tell it: idea + settled facts (no tenants, paths, ids, copy, credentials). Search at most **2** generic queries about **that** subject: how people do it, how this compares, _qué necesita atención ahora_. Not a market survey. Return **≤12 lines**:

```text
Nuevos: (1-3 preguntas que aún no hicimos, de ese contraste o actualidad)
Saltar: (ya decidido, o nada nuevo)
```

3. Ask `Nuevos`. If you skipped step 2, or the report is empty: say nothing and continue. Do not retry. Never paste.

Scope moved: redo the wave you are in (1 = no web, 2 = web only if step 1 still says yes).

**Use or fail:** Q1 **is** Wave-1 `Q1`. Next questions **are** Wave-1 `Temas`, then Wave-2 `Nuevos` if that report exists. Do not invent a generic question while a report sits unused.

**Allowed** on the conductor: this skill + `intake.md`; short `mem_search`; list `docs/sdd/vsdd/` only when numbering; write `idea.md` only after a later-turn Sí to the happy-check.

## Implications (private)

Rank only the report seeds (plus the idea). Do not walk a separate list. Ask a topic if two paths are defensible and the user would notice; else lock a default on No. Order: visible > breakage > cost/ops. Keep **3–5** from Wave 1 including Q1; Wave-2 `Nuevos` are extra only if still valuable.

## Loop

0. `idea.md` only after happy-check Sí. A cut intake restarts (one line). Resume saved ideas via `mem_search` `vsdd-intake-`. Several → numbered list in chat (each + Nueva). Wait.
1. Capture their idea. If there is no idea yet, that is question 1. Else one line: vas a elegir una cosa a la vez.
2. Once an idea exists, same turn, silent: Wave-1 explore + `mem_search`. Rank only those seeds.
3. Q1 = Wave-1 `Q1`, options + pro/contra in the chat. Wait. A different Q1 is a bug.
4. Do **not** recap after Q1. Walk Wave-1 `Temas`, each as `¿Quieres decidir X?` Sí / No, lo dejo simple. No → recommended default, settled. Sí → options + pro/contra in the chat, then wait.
   4b. When Wave-1 topics are done: run Wave 2 steps 1–3. Then walk `Nuevos` like step 4. Cap 8 topics across both waves; Sí/No plus that topic’s options = one. Fíjate sits on the current topic. If the cap cuts, lock remaining defaults, then one last (outside the cap): `¿Quieres decidir algo más o lo dejamos así?`
5. Off-menu (after the harm check): that is the decision; confirm in one line inside the next question. Do not re-show the menu.
6. Pasted spec: idea material. Mark decided gaps settled; ask only holes. Do not copy to `spec.md` or into the recap verbatim.
7. Two answers contradict: one tie-break (those two; last answer recommended). Then continue remaining topics. Recap only when the loop is done.
8. Mid-loop save or spec ask: one line with how many remain. Do not write spec or `idea.md`. Scope moved: new explore for the current wave (1 = no web, 2 = with web); still no recap until the end.
9. Private fact list, then recap once per round so an unread Q&A still recovers every fact. Four headings. A few sentences each if needed. Missing fact → rewrite once.

```markdown
## Problema

## Qué vamos a hacer

## En alcance / Fuera de alcance

## Listo cuando
```

10. Recap in chat (four headings). Same message, only this question: `¿Estás contento con esta idea?` Sí / No. **STOP. No Write. No `idea.md`.** Direct edits to the recap count as the change. No → one question on what to change, save draft checkpoint to Engram (`mem_save topic_key: vsdd-intake-draft-<slug>`) to survive context compactions, recap again only after that answer. Repeat until Sí, or they say leave it open. Do not force a save.
11. On the turn whose user message is Sí: create `docs/sdd/vsdd/` if needed. Write `docs/sdd/vsdd/<nnn>-<slug>/idea.md` (four headings + `Estado: listo-para-spec`). `slug` = short kebab from the idea. `nnn` = max+1, pad 3; none → `001`; collision → increment once, then stop one line. Foreign feature HEAD: one-line note. `mem_save` `topic_key: vsdd-intake-<slug>`, `type: decision`, `title: "vsdd idea <slug>"`, `content: idea summary`. STOP. Writing `idea.md` in the recap turn is a bug.

## Output

Questions: current question only, in chat, with pro/contra. End: recap + happy-check, no file. After a later Sí: `idea.md`. No spec, commit, or `branch:init`.
