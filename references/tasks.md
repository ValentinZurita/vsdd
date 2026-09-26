# Tasks

Convertir un plan aprobado en `tasks.md` de forma **100% autónoma, sin preguntas de entrevista al usuario**. **Esta fase no modifica código del producto bajo `apps/`.** Do not invent work the plan did not settle.

**Contrato de Tareas:** Leer plan → generar tareas autónomamente en fases lógicas con TDD y micro-tareas (20-30 min) → escribir `tasks.md` → **auditor independiente inmediato** → **excepción de artefacto:** el conductor corrige `tasks.md` en disco (nunca `apps/`) → presentar resumen en chat preguntando directamente si pasar a la implementación o aún no.

## Reglas Innegociables

- **Sin entrevista al usuario:** El plan, la spec y la idea ya están aprobados. El corte de tareas es responsabilidad técnica del agente. No hacer preguntas de slicing ni abrir cupos de preguntas.
- **Estructura por Fases lógicas:** Las tareas se agrupan en fases secuenciales (`## Fase 1: ...`, `## Fase 2: ...`) siguiendo el grafo de dependencias de `plan.md` (dominio/contratos/datos antes de servicios e interfaces).
- **Granularidad estricta (20-30 min):** Cada tarea debe ser una micro-tarea de **20 a 30 minutos máximo**. Si una tarea excede ese tiempo, subdividirla. Formato: `- [ ] **TASK-xx: <título> (20-30 min)**`.
- **TDD estricto:** Cada tarea debe incluir su especificación de `Test primero (TDD)` con el test concreto que debe fallar antes de tocar código de producción.
- **Commits atómicos por tarea y por fase:** Casilla de marcado para commit atómico por tarea (`- [ ] **Commit de tarea:**`) y bloque de cierre por fase (`### Control de Fase N`) con auditoría y commit de fase.
- **Cobertura total:** Cada DT de `plan.md` y cada RF/RNF de `spec.md` debe estar mapeado en el **Cubre** de alguna tarea (o explícitamente en _Fuera de este corte_).
- **Preservación del valor:** Las tareas deben entregar y validar de forma prioritaria la esencia humana plasmada en `idea.md`.
- **No tocar código ni producto:** Prohibido crear, editar o borrar archivos bajo `apps/`. Prohibido Grep/Read de producto; el árbol sale de `plan.md`.

## Flujo Autónomo

1. **Verificación de entrada:** Requerir `plan.md` con `Estado: listo-para-tareas`. Si no existe, indicar en una línea que primero se requiere completar la fase de Plan. Si existe `tasks.md`, preguntar si se desea revisar/continuar o regenerar.
2. **Lectura de contexto:** Leer `CONSTITUTION.md`, `AGENTS.md`, `idea.md`, `spec.md` y `plan.md`. No imprimir su contenido en el chat.
3. **Generación autónoma:** Con base en el árbol de archivos y decisiones técnicas de `plan.md`, estructurar las tareas siguiendo `tasks-template.md`:
   - Agrupar en Fases secuenciales.
   - Definir micro-tareas (20-30 min) con requisitos observables.
   - Definir test que falla primero para cada una.
   - Agregar casillas de commit de tarea y bloques de control de fase.
4. **Escritura inicial:** Guardar `docs/sdd/vsdd/<nnn>-<slug>/tasks.md` en disco (`Estado: en-revision`).
5. **Auditoría independiente inmediata (Subagente):** Invocar host subagent con modelo de razonamiento (`pro`, `sonnet`/`opus`, no Wave-1, no Gentle). Paths: `tasks.md`, `plan.md`, `spec.md`, `idea.md`, `CONSTITUTION.md`, `AGENTS.md`. Reintento automático en caso de fallo técnico.

```text
Rol: auditor independiente de tareas. No propongas soluciones. No reescribas.
1) DT, RF o RNF del plan/spec sin TASK (ni Fuera)
2) TASK con archivos que no están en el árbol del plan
3) Orden que rompe dependencias del plan
4) Conflictos con CONSTITUTION.md / AGENTS.md
5) Tareas o secuencia que desvirtúan o postergan la entrega del valor central de idea.md
6) Tareas cuyo alcance técnico exceda 30 min (exigir subdividir), sin casilla [ ], sin Test primero (TDD), o fases sin control de auditoría/commit
Veredicto: limpio | ok-con-huecos | bloquea
Cada hallazgo: una línea técnica y concreta.
```

6. **Excepción de artefacto — correcciones en `tasks.md`:** El conductor lee el reporte del auditor (no lo pega en chat) y corrige inmediatamente `tasks.md` en disco (subdivide tareas grandes, ajusta dependencias, completa tests y mapeos). Nunca `apps/`. Actualizar `Estado: listo-para-aplicar`. Persistir en memoria (`mem_save topic_key: vsdd-tasks-<slug>`).
7. **Presentación y Menú de Implementación:** Mostrar en chat el resumen de fases y micro-tareas generadas (con una línea de ajustes aplicados tras auditoría) y preguntar directamente:

```text
Quedó tasks.md auditado y listo. ¿Quieres pasar a la implementación o aún no?
1. Pasar a implementar
2. Aún no, revisar o ajustar tareas
3. Lanzar otra auditoría independiente
```

- **Opción 1 (Pasar a implementar):**
  - **Estrategia de rama:** preguntar `¿Dónde prefieres trabajar la implementación?`:
    - `1) Crear una nueva rama`
    - `2) Trabajar en la rama actual (<rama_actual>)`
  - **Si elige 1 (nueva rama):** proponer al menos 3 sugerencias con formato AGENTS.md (`feat/<scope>-<desc>` o `fix/<scope>-<desc>`) o permitir que el usuario escriba la suya. Tras confirmación, ejecutar `pnpm branch:init <rama>` (no pegar stdout; una línea: rama lista).
  - **Si elige 2 (rama actual):** confirmar que se continúa en `<rama_actual>` (un `git branch --show-current`; no dump) sin ejecutar `branch:init`.
  - **En ambos casos:** reportar que el entorno está listo y preguntar: `¿Deseas arrancar la implementación ahora mismo o prefieres pausar aquí?`:
    - `1) Iniciar implementación ahora`: cargar inmediatamente `references/apply.md`.
    - `2) Pausar aquí`: reportar que la rama y `tasks.md` quedan listos para retomar en cualquier momento con `vsdd apply`.
- **Opción 2 (Aún no, revisar o ajustar tareas):** esperar comentarios del usuario; cuando indique ajustes: aplicar cambios en `tasks.md` en disco y volver a presentar este menú.
- **Opción 3 (Lanzar otra auditoría):** re-ejecutar paso 5 (auditor independiente), aplicar correcciones (paso 6) y volver al paso 7.

## Output

From the plan only. No product code. Zero user questions during drafting. Menu asks directly whether to implement now or not yet.
