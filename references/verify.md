# Verify

Validar de forma exhaustiva que la funcionalidad implementada cumple al 100% con la especificación, los requisitos funcionales y no funcionales, los criterios de finalización de `idea.md` y los quality gates del monorepo. Si algo falla, un bucle autónomo repara y comitea hasta alcanzar luz verde.

**El conductor no verifica producto.** Diffs, matriz RF/RNF, suites y `quality:gate` corren en subagentes. Chat = checkpoints + resumen ejecutivo. Pegar logs, `git diff` o reportes de auditoría es un bug.

## Reglas Innegociables

- **Git Guard previo obligatorio:** Antes de despachar subagentes, verificar `git status -s`. Si el árbol tiene cambios pendientes ajenos a la verificación, STOP y exigir que el usuario los comitee o guarde.
- **Precondición de entrada:** Requerir que `tasks.md` esté en `Estado: listo-para-verify` y que no existan tareas pendientes (`- [ ]`). Si no, indicar que primero corre `vsdd apply`.
- **Conductor no parchea producto:** El agente principal **nunca** escribe bajo `apps/`, **nunca** corre `pnpm typecheck` / `pnpm test` / `pnpm quality:gate`, **nunca** inspecciona `git diff` de producto y **nunca** pega reportes ni stdout de gates en el chat. Tres subagentes distintos: auditor (readonly, nivel Crítico), runner de gates, reparador. El merge a `codex/work` espera confirmación explícita en el hilo; el trabajo pesado de DoD va a un closer.
- **Trazabilidad estricta RF / RNF:** Cada RF y RNF de `spec.md` debe estar mapeado a código y test. Lo construye el **auditor**, no el conductor.
- **Validación de la Idea:** El auditor confirma que la entrega satisface `idea.md` sin sobre-ingeniería. El conductor no re-audita.
- **Gates obligatorios (en subagente):** Luz verde solo si el runner reporta 0 errores en `pnpm typecheck`, `pnpm test` y `pnpm quality:gate`.
- **Bucle de Auto-Corrección (Self-Healing):** Si el auditor o el runner fallan:
  1. Invocar **subagente reparador** (aviso de modelo, fallback transparente). El conductor **no** aplica el fix.
  2. El reparador aplica el mínimo dentro del árbol de `plan.md`, commit atómico Commitlint (`fix(<scope>): ...`), y re-ejecuta gates.
  3. Relanzar auditor + runner (máximo **2** iteraciones). Si persiste: STOP. Diagnóstico = ≤5 líneas de causa (nombre de test o regla), no logs.
- **Resumen Ejecutivo al grano:** Solo lo que el usuario necesita. Gotchas: máximo 3 viñetas, una línea cada una.

## Flujo de Verificación

1. **Entrada y Git Guard (conductor):**
   - `git status -s`. Si hay suciedad ajena, STOP.
   - Comprobar `tasks.md`: `Estado: listo-para-verify` y cero `- [ ]`.
2. **Auditor independiente (subagente, nivel Crítico, readonly).** Paths: `idea.md`, `spec.md`, `plan.md`, `tasks.md`, `CONSTITUTION.md`, `AGENTS.md`. Diff de la rama vs origen. No pegar el reporte. Checkpoint: `[VERIFY AUDIT] limpio` o `[VERIFY AUDIT] k hallazgos`. Empty/tool failure: retry once; si persiste, menú `1) Reintentar` / `2) Continuar bajo propio riesgo`.

```text
Rol: auditor independiente de verificación. Readonly. No propongas parches. No reescribas.
1) Cada RF-xx: archivo impl + test + PASS/FAIL (una línea)
2) Cada RNF-xx: evidencia + PASS/FAIL (una línea)
3) Criterios Listo cuando / idea.md: cumplido o hueco
4) Diff fuera del árbol de plan.md, o sobre-ingeniería vs idea.md
Veredicto: limpio | ok-con-huecos | bloquea
≤40 líneas. No pegar stdout ni git diff.
```

3. **Runner de gates (subagente distinto).** Ejecuta `pnpm typecheck`, `pnpm test`, `pnpm quality:gate`. Checkpoint: `[VERIFY GATE] typecheck X · tests n/n · gate X`.

```text
Rol: runner de gates. No editar código.
Ejecutar typecheck, test y quality:gate.
Devolver solo: typecheck PASS/FAIL, tests X/Y, gate PASS/FAIL.
Si FAIL: ≤5 líneas (nombre de test o regla). Sin log completo.
```

4. **Reparación (si auditor ≠ limpio o runner ≠ PASS):**
   - Pasar hallazgos **solo** en el prompt del Task (nunca en chat). No reutilizar el auditor como reparador.
   - Checkpoint: `[VERIFY FIX] <causa breve> → commit (<hash>) → gate <PASS|FAIL>.`
   - Volver a pasos 2–3. Máximo 2 vueltas.

```text
Rol: reparador de verify. No auditar. No ensanchar el alcance.
Hallazgos (literal, solo en este prompt):
<reporte compacto del auditor y/o del runner>
Árbol autorizado: <paths de plan.md>
Fix mínimo, TDD, Commitlint AGENTS.md, re-ejecutar gates.
Devolver solo: archivos, hash, gate PASS/FAIL.
```

5. **Resumen ejecutivo (conductor, con los checkpoints; sin re-leer `apps/`):**

```text
## Verificación de Funcionalidad: <Nombre de la Funcionalidad>

### 1. Estado de la Especificación
- Requisitos Funcionales (RF): X/X cubiertos y validados con tests.
- Requisitos No Funcionales (RNF): X/X verificados.
- Criterios de "Listo cuando" e idea.md: 100% cumplidos.

### 2. Evidencia de Calidad (Quality Gate)
- TypeScript: 0 errores (typecheck PASS).
- Tests: X pruebas en verde (Vitest PASS).
- Quality Gate: 100% VERDE (lint, límites AST, tenant isolation).

### 3. Lo que debes saber (Notas técnicas y Runtime)
- <Máximo 3 viñetas, una línea. Si no hay: Ninguna.>

### 4. Próximo Paso (Definition of Done)
¿Deseas cerrar e integrar esta rama hacia codex/work?
1. Iniciar integración y merge hacia codex/work (según AGENTS.md §5)
2. Mantener la rama abierta para pruebas manuales
```

- `mem_save` `topic_key: vsdd-verify-<slug>`.

6. **DoD hacia `codex/work` (si elige 1):**
   - Lanzar **subagente closer** (no mergea): `pnpm branch:summary`, completar `resumen.md`, `git fetch origin`, rebase + gate si `codex/work` avanzó. Checkpoint: `[VERIFY DOD] commits / archivos / gate`.

```text
Rol: closer DoD. No mergear. No borrar ramas.
branch:summary, resumen.md, fetch, rebase+gate si hace falta.
Devolver ≤10 líneas: commits, archivos, gate PASS/FAIL. Sin dump.
```

- Presentar ese resumen corto. **Esperar confirmación explícita.**
- Tras el sí: el conductor ejecuta solo `git switch codex/work && git merge --no-ff <rama>` (un comando; no dump). Luego pregunta si borrar la rama local (`git branch -d <rama>`).
