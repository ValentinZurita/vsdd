# Apply

Ejecutar las tareas de `tasks.md` en código real bajo TDD estricto y commits atómicos. **Esta fase sí modifica código del producto bajo `apps/`, pero únicamente los archivos autorizados en el árbol de `plan.md`.**

## Reglas Innegociables

- **Git Guard previo obligatorio:** Antes de despachar el primer subagente, verificar `git status -s`. Si el árbol de trabajo tiene archivos modificados o untracked ajenos a vsdd, STOP inmediato y exigir al usuario que los comitee o guarde antes de arrancar.
- **Lectura previa:** El conductor lee **solo** headings de `tasks.md` (fase activa y TASK pendiente). `idea.md`, `plan.md`, `CONSTITUTION.md` y `AGENTS.md` van como **paths en el prompt del implementador**, no como Context Pack del hilo.
- **Árbol cerrado:** Prohibido crear o editar archivos fuera del árbol aprobado en `plan.md`.
- **TDD estricto:** Para cada tarea, escribir primero el test que falla antes de tocar código de producción. Verificar que falle por el motivo correcto y luego implementar el código mínimo para ponerlo en verde.
- **Commits atómicos por tarea:** Cada tarea completada se comitea de inmediato cumpliendo Commitlint de `AGENTS.md` (What, Why, Impact, Validation; sin trailers de IA). El **subagente implementador** marca `- [x]` en `tasks.md`. El conductor no marca casillas de producto.
- **Hilo limpio (Thin Thread):** El trabajo pesado, comandos de terminal y edición de archivos corren en subagente. Al hilo principal de chat solo se envían checkpoints breves: `[TASK-xx OK] test pasó -> commit feat(...) -> [x] marcado`.
- **Conductor no parchea producto:** El agente principal **nunca** escribe bajo `apps/`, **nunca** aplica hallazgos del auditor y **nunca** pega el reporte de auditoría en el chat. Tres subagentes distintos: implementador (tareas), auditor (solo lectura) y reparador (hallazgos → parches). El reporte se pasa **solo** dentro del prompt del Task reparador. Que el conductor “retome y corrija” es un bug: contamina el contexto.
- **Cancelación segura (Zero-Loss):** Si el usuario dice "para", "stop" o interrumpe, el conductor puede ejecutar `git restore . && git clean -fd` (única mutación git permitida en el hilo; no dump). Luego:
  1. Las tareas anteriores quedan 100% preservadas en sus commits previos de Git.
  2. Asegurar que `tasks.md` en disco conserve marcadas `[x]` las tareas completadas y `[ ]` la interrumpida.
  3. Informar al usuario el punto exacto de guardado y cómo retomar (`vsdd apply`).
- **Control de cierre de fase:** Al terminar las tareas de una fase, invocar al auditor independiente de fase (subagente en nivel Crítico / razonamiento profundo, **solo lectura**). Si el auditor falla por red/entorno, reintentar una vez y ofrecer reintento o continuar bajo propio riesgo. Si hay hallazgos: lanzar un **subagente reparador** distinto (modelo de la fase; no el auditor; no el conductor). Máximo 2 iteraciones auditor→reparador; si persiste, frenar y reportar al usuario. El quality:gate y el commit de cierre de fase también corren en subagente.

## Niveles de Razonamiento (Tiers Abstractos)

Para evitar acoplar la skill a nombres efímeros de proveedores que cambian constantemente, la skill clasifica el trabajo por **niveles de razonamiento** y consulta al usuario qué modelo prefiere según el cliente o entorno que esté utilizando:

- **Nivel Bajo (Mecánico):** DTOs, interfaces simples, barrel exports (`index.ts`), mocks, css modules básicos. Modelos rápidos o económicos.
- **Nivel Medio (Estándar):** Servicios de aplicación, Server Actions, componentes React, custom hooks, consultas y lógica CRUD. Modelos balanceados de producción diaria.
- **Nivel Alto (Razonamiento Profundo):** Entidades de dominio DDD, algoritmos de negocio, seguridad, autenticación, arquitecturas complejas, TDD estricto con tests de invariantes. Modelos con capacidad avanzada de deliberación/thinking.
- **Nivel Crítico (Auditoría Independiente):** Verificación adversaria, AST, linting estricto, análisis de regresión y cumplimiento de contratos. Modelos de razonamiento máximo sin condescendencia.

> **Regla de Asignación y Fallback Transparente:** Por cada fase, el agente evalúa la complejidad técnica, recomienda el nivel necesario y le pregunta al usuario qué modelo desea usar. Al lanzar el subagente se pasa dicho modelo a la herramienta del host. **Si el entorno, CLI o API key no soporta el modelo solicitado o produce un error al inicializarlo, el agente NUNCA debe ocultarlo ni hacer fallback silencioso:** debe emitir un aviso visible en el chat explicando el motivo (ej. `Aviso: No fue posible usar el modelo '<modelo>' en este entorno (<motivo>). Continuando con el modelo activo '<inherit>'`) antes de proceder con la ejecución.

## Flujo de Ejecución

1. **Siguiente tarea (sin Context Pack):** Del `tasks.md`, leer solo headings: fase activa y primer `- [ ]`. No Grep `apps/`. No sintetizar el plan de ejecución en el conductor.
2. **Pregunta de Estrategia y Configuración de Modelos:**
   Presentar al usuario:

```text
Listo para implementar tareas de tasks.md.
¿Cómo prefieres ejecutar?
1. Por Fases [Recomendada] (ejecuta una fase completa con micro-commits, auditoría al final y frena).
2. Tarea por Tarea (ejecuta 1 sola micro-tarea de 20-30 min, comitea y pregunta antes de seguir).
3. Modo Continuo (avanza fase tras fase con auditorías automáticas hasta completar tasks.md).
```

- **Si elige 1 (Por Fases) o 2 (Tarea por Tarea):**
  Presentar la fase activa, su nivel recomendado de razonamiento con motivo, y solicitar el modelo a utilizar (o Enter para `inherit`).
- **Si elige 3 (Modo Continuo):**
  El agente presenta el desglose de **todas las fases pendientes**, con la recomendación de nivel de razonamiento y motivo para cada una, y solicita la elección de modelo para cada fase en un solo turno:

```text
Modo Continuo seleccionado. Configuración de modelos por fase:
- Fase 1 (<Nombre>): Nivel recomendado [Bajo | Medio | Alto] (<motivo breve>)
- Fase 2 (<Nombre>): Nivel recomendado [Bajo | Medio | Alto] (<motivo breve>)
- Fase 3 (<Nombre>): Nivel recomendado [Bajo | Medio | Alto] (<motivo breve>)

Indica el modelo para cada fase (ej. "Fase 1: <modelo>, Fase 2: <modelo>, Fase 3: <modelo>")
o presiona Enter (o escribe "actual") para usar el modelo activo [inherit] en todas las fases.
```

3. **Ejecución de Tarea (Subagente con modelo seleccionado):**
   - Invocar subagente **implementador** especificando el modelo configurado. Si el host o CLI no soporta el modelo o emite error de inicialización, emitir aviso en el chat y continuar con el modelo activo (`inherit`). El conductor no implementa: espera y emite el checkpoint. Prompt del implementador: paths a `idea.md`, `plan.md`, `tasks.md`, `CONSTITUTION.md`, `AGENTS.md` + TASK-xx.
   - El subagente escribe el test que falla, implementa en archivos autorizados, valida tipos/linter, hace el commit atómico según `AGENTS.md` y marca `- [x]` en `tasks.md`.
   - Checkpoint en el hilo principal: `[TASK-xx OK] <título> comiteado (<hash>).`
4. **Si el usuario interrumpe:** Ejecutar `git restore . && git clean -fd`, asegurar que `tasks.md` conserve las casillas completadas y confirmar estado limpio.
5. **Cierre de Fase (el conductor no edita `apps/`):**
   - Lanzar subagente **auditor** independiente (nivel Crítico, **readonly**) sobre el diff de la fase. Si el host no soporta el modelo solicitado, avisar al usuario en el chat y continuar con el modelo activo (`inherit`). Paths: `tasks.md`, `plan.md`, `spec.md`, `idea.md`, `CONSTITUTION.md`, `AGENTS.md`. Empty/tool failure: retry once. Si la herramienta del host falla repetidamente por entorno o red, informar al usuario y ofrecer: `1) Reintentar auditoría`, `2) Continuar bajo mi propio riesgo (documentado en el commit de fase como [SKIP-AUDITORIA: fallo de entorno técnico])`; de lo contrario tratar como bloquea. No pegar el reporte. Checkpoint: `[FASE-N AUDIT] limpio` o `[FASE-N AUDIT] k hallazgos. Reparador en curso.`
   - Si el veredicto es `limpio`: ir al subagente de cierre.
   - Si hay hallazgos: **prohibido que el conductor los aplique.** Lanzar un **subagente reparador** (modelo de la fase; no reutilizar el auditor; no simular). Pasar el reporte **solo** en el prompt del Task (nunca en chat; no re-leer `apps/` para “entender” el hallazgo). Árbol de `plan.md`, TDD y Commitlint. Esperar. Checkpoint: `[FASE-N FIX] k hallazgos aplicados (<hashes>).` Relanzar el auditor (cuenta 1 iteración; máximo 2). Si persiste: STOP y diagnóstico al usuario (≤5 líneas, sin log).

```text
Rol: reparador de fase. No auditar. No ensanchar el alcance.
Hallazgos del auditor (literal, solo en este prompt; nunca en chat):
<pegar el reporte>
Árbol autorizado: <paths de plan.md>
Cerrar cada hallazgo con el mínimo (TDD, árbol cerrado, Commitlint AGENTS.md).
Devolver solo: archivos tocados, hashes de commit, tests en verde.
```

- Subagente de cierre: `pnpm quality:gate` 100% verde, commit de fase, marcar `Control de Fase N` en `tasks.md`. Checkpoint: `[FASE-N OK] gate verde → commit (<hash>).`
- Si la estrategia fue opción 1: frenar y presentar reporte al usuario. Si fue opción 3: continuar automáticamente con la siguiente fase usando el modelo preconfigurado para esa fase.

6. **Fin de Implementación:**
   Al completarse todas las tareas (`[x]`) y todos los controles de fase de `tasks.md`:
   - Actualizar la cabecera de `tasks.md` a `Estado: listo-para-verify`.
   - Persistir estado en memoria (`mem_save topic_key: vsdd-apply-<slug>`).
   - Presentar resumen en chat reportando éxito y recomendando avanzar a la fase de verificación: `vsdd verify`.
