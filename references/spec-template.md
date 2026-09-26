# Spec template

The saved `spec.md` **is** the headings below, in this order, with these names. No extra `##`. No rename. No skip. Instruction lines (this block, **Llenar**, **Forma**, angle-bracket hints) never appear in the recap or the file.

Every sentence traces to `idea.md` or a spec answer. Qué and por qué. No stack, architecture, routes, or filenames. `Estado`: `en-revision` until they say Sí to contento (then `listo-para-plan`). Menu option 1 after that still waits for comments; do not flip back.

If a section has nothing settled: use that section’s **Vacío** word. Do not invent.

---

# Spec <nnn> <Nombre de la funcionalidad>

Estado: <en-revision | listo-para-plan>

## Contexto y objetivos

**Llenar:** 2–5 sentences. What pain this cut removes, why it is worth doing now, what “better” means for the person who uses it. Not a tour of screens.

**Forma:** prose, not bullets.

### Usuarios y actores

**Llenar:** each kind of person (or system acting for a person) that this cut touches. For each: what they can do here, and what they must not be able to do. Include “who never sees this” if that was settled.

**Forma:**

- <rol>: <puede …>. No <no puede …>.

### Historias de usuario

**Llenar:** one story per settled outcome that a rol cares about. Benefit in their words. No story for a skip they accepted.

**Forma:**

- Como <rol> quiero <acción> para <beneficio>

## Requisitos funcionales

**Llenar:** the whole of this cut, split into RF items. One RF = one comprobable behavior (one actor + one outcome, or one rule that always holds). Do not map 1:1 to interview questions. Merge repeats. Split if two outcomes.

**Número:** `RF-01`, `RF-02`, … consecutive, two digits. Title: short product language (verb + what changes for the user).

**Criterios:** one or more EARS bullets under that RF. Each bullet is condition + `debe` + **observable** result (what someone sees, cannot do, or is told). Never how it is built.

**EARS (elige la forma que calce; se pueden mezclar en un RF):**

- Siempre: `<esto> debe <resultado>`
- Evento: `Cuando <ocurre X>, <esto> debe <resultado>`
- Estado: `Si <está X>, <esto> debe <resultado>`
- No deseado: `Si <X no debe pasar>, <esto> no debe <daño>; debe <protección visible>`

**El conjunto de RFs tiene que dejar comprobables (aquí o en Casos límite, no duplicar de más):**

- Quién puede y quién no
- El camino que sí termina bien
- No puede seguir (falta algo, no tiene permiso, choca con otra cosa, falló)
- No hay nada / primera vez / no hay qué mostrar
- Qué queda después (sigue valiendo, se deshace, se entiende el fallo)

**Forma:**

### RF-01 <verbo + qué cambia>

- Cuando <evento>, <esto> debe <resultado observable>
- Si <estado>, <esto> debe <resultado observable>

## Casos límite

**Llenar:** stresses that are not the happy path: empty, first time, already exists, two at once, stale, partial, interrupted, no permission, failure in the middle. Only settled ones. If an edge is already an EARS bullet, do not paste it again; name it only if it still needs a separate check.

**Vacío:** `Ninguno más allá de los RF.`

**Forma:** bullets. Each: if <situación>, then <resultado observable>.

## Requisitos no funcionales

**Llenar:** only qualities the user would notice and did settle: how fast it must feel, how clear, how much it must hold, how much they must trust it, language/tone. Not libraries, servers, or file layout.

**Vacío:** `Ninguno más allá de lo observable en los RF.`

**Forma:** bullets. Each: <calidad> debe <criterio comprobable sin stack>.

## Fuera de alcance

**Llenar:** what this cut will not do, including skips they accepted. One line each, no justification.

**Vacío:** `Nada más de lo ya dicho en la idea.`

## Criterios de finalización

**Llenar:** the cut is done when a person can **see and check** the stories without help from the implementer. Phrase as observable outcomes. No ticket language, no “code merged”.

**Forma:** bullets starting with `Se puede comprobar que…`

## Diagramas

**Llenar:** at most one simple mermaid (`flowchart` or `sequenceDiagram`) that supports a settled story (who does what, in what order, what happens if it cannot). No class diagrams, no schema.

**Vacío:** `Ninguno.`

## Dudas abiertas

**Llenar:** every hole still untestable. Source: unchecked comprobable ticks (quién puede/no, camino que sí, no puede seguir, vacío/primera vez, qué queda después), skips, cap-cuts, QA list. Each line: `[NECESITA ATENCIÓN]` + the hole. Do not invent extras. Do not hide real holes.

**Vacío:** `Ninguna.` — only if there is no such hole.
