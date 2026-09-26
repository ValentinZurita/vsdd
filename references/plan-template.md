# Plan template

The saved `plan.md` **is** the headings below, in this order, with these names. No extra `##`. No rename. No skip. Instruction lines (this block, **Llenar**, **Forma**, **Vacío**, angle-bracket hints) never appear in the recap or the file.

No production code. Qué-técnico: módulos, datos, contratos, DTs, árbol, tests. Every RF and RNF from `spec.md` appears in **Cobertura**. `Estado`: `en-revision` until they say Sí to contento (then `listo-para-tareas`). Menu option 1 after that still waits for comments; do not flip back.

If a section does not apply: that section’s **Vacío** word. Do not invent.

---

# Plan <nnn> <Nombre de la funcionalidad>

Estado: <en-revision | listo-para-tareas>

Idea: `<nnn>-<slug>/idea.md`
Spec: `<nnn>-<slug>/spec.md`

## Alineación

**Llenar:** how this cut respects the core problem and user pain of `idea.md`, CONSTITUTION.md (isolation, fail-closed, owner/buyer feel, no bloat) and AGENTS.md (hexagonal direction, no tenant default in admin/order presentation, file limits, Spanish MX, no extra deps). Short. Not a quote dump.

**Forma:** 3–8 sentences or short bullets.

## Módulos

**Llenar:** which hexagonal slices this cut touches (`domain` / `application` / `infrastructure` / `presentation`). What already exists vs what is new. Presentation does not import infrastructure. Name the module (`catalog`, `admin`, …) in product terms.

Each block: **Cubre:** `RF-xx`, `RNF-xx`.

**Forma:**

- **\<módulo / capa\>:** \<qué hace aquí\>. Cubre: RF-xx

## Modelo de datos

**Llenar:** only if this cut stores or shapes data. JSON (or tables as JSON-shaped objects) of the **observable** records: fields, who owns them, tenant key. No SQL dump unless the spec already requires persistence; even then, shape first, not a migration file.

**Vacío:** `No aplica.`

**Forma:** fenced `json` sketch, then one paragraph qué/por qué.

## Algoritmos

**Llenar:** only if a rule is easier as steps than as a DT. Pseudocode. No TypeScript, no imports.

**Vacío:** `No aplica.`

## Contratos

**Llenar:** only if ports, payloads, or UI events must stay stable. Names of contracts, who talks to whom, what is in/out. Not class files.

**Vacío:** `No aplica.`

## Decisiones técnicas

**Llenar:** every real fork (two defensible hows). Consecutive `DT-01`, `DT-02`, …. Do not invent a DT to fill this heading.

**Vacío:** `Ninguna: el corte no tenía dos hows defendibles.`

**Forma:**

### DT-01 \<título corto\>

- **Decisión:** …
- **Alternativa descartada:** …
- **Por qué se descarta:** …
- **Cubre:** RF-xx, RNF-xx

A DT without a discarded alternative is invalid.

## Árbol de cambios

**Llenar:** the repo as it will move. Real paths. Mark each line `+` new, `~` edit, `-` delete. Group by folder. Do not list files you will not touch. Respect 300-line files / split if a touched file is already large.

**Forma:** indented tree or bullets with `+` / `~` / `-`.

## Estrategia de tests

**Llenar:** what is proven first (TDD), which behaviors (not file names only), mock vs real if both exist. Each cluster: **Cubre:** RF-xx / RNF-xx.

**Vacío:** not allowed. At least how the RF set is checked.

## Cobertura RF / RNF

**Llenar:** one row per RF-xx and RNF-xx in the spec. No blank. If a row has no home, that is a bug — question or `[NECESITA ATENCIÓN]`.

**Forma:**

| ID    | Dónde (módulo, DT, tests) |
| ----- | ------------------------- |
| RF-01 | …                         |

## Diagramas

**Llenar:** simple mermaid (`flowchart` or `sequenceDiagram`) only if it clarifies a module boundary or a DT. No class soup.

**Vacío:** `Ninguno.`

## Dudas abiertas

**Llenar:** untestable or unmapped holes after questions + QA, plus any unresolved `[NECESITA ATENCIÓN]` carried over from `spec.md`. Each line: `[NECESITA ATENCIÓN]` + the hole.

**Vacío:** `Ninguna.` — only if every RF/RNF has a row, all `spec.md` doubts are resolved in DTs, and QA listed no remaining gaps.
