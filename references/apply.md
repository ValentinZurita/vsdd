# Implementación por Fases (Apply)

Ejecuta las tareas de `tasks.md` en código real bajo TDD estricto y commits atómicos. **Esta fase sí modifica código del proyecto, pero únicamente los archivos estrictamente autorizados en el árbol de `plan.md`.**

---

## Reglas Innegociables

- **Git Guard previo obligatorio:** Antes de despachar el primer subagente, verificar `git status -s`. Si el árbol de trabajo tiene archivos modificados o sin seguimiento ajenos al flujo actual, DETENERSE (STOP) de inmediato y solicitar al usuario que los comitee o guarde antes de comenzar.
- **Lectura previa y Thin Thread:** El conductor lee **únicamente** los encabezados de `tasks.md` (fase activa y primer `TASK` pendiente). Prohibido cargar el repositorio completo en el contexto del hilo principal. Los archivos `idea.md`, `spec.md`, `plan.md` y las guías del proyecto se pasan como **rutas en el prompt del subagente**, no como volcado de texto.
- **Árbol Cerrado:** Queda estrictamente prohibido crear o modificar archivos fuera del árbol aprobado en `plan.md`.
- **TDD Estricto:** Para cada tarea, escribir primero la prueba automatizada que debe fallar antes de tocar código de producción. Comprobar que falle por el motivo esperado y luego implementar el código mínimo indispensable para ponerla en verde.
- **Precondición de Código Puro:** Todas las tareas son unidades de código automatizadas bajo TDD. Se asume que todos los prerrequisitos de entorno (.env, accesos) y spikes técnicos exploratorios quedaron 100% resueltos en la fase de Plan. Si una tarea resulta imposible de automatizar o requiere intervención manual no prevista, pausar de inmediato y regresar al Plan para reajustar.
- **Commits Atómicos por Tarea:** Cada tarea completada se comitea de inmediato cumpliendo Conventional Commits (`<tipo>(<alcance>): <descripción>`), sin trailers de IA ni Co-Authored-By. El **subagente implementador** marca `- [x]` en `tasks.md`. El conductor nunca marca casillas de producto.
- **Conductor No Parchea Código y Separación de Roles (Test Harness):** El agente principal **nunca** edita código del proyecto, **nunca** aplica hallazgos del auditor y **nunca** pega reportes de auditoría en el chat. Se separan estrictamente los roles:
  1. **Autor de Tests:** Diseña las pruebas automatizadas sobre el contrato público y las sella en estado Rojo con `vsdd harness seal <ruta-test> --task <task-id>`. Prohibido editar código de producción.
  2. **Implementador:** Recibe el contexto por trazabilidad mediante `vsdd harness brief <task-id>`, escribe el código de producción sin tocar el test sellado y verifica con `vsdd harness verify <task-id>` (o presenta reclamo formal con `vsdd harness appeal <task-id> --reason "<motivo>"`).
  3. **Tribunal de Fase (3+1 en 1 sola llamada):** Al cierre de fase, un único despacho evalúa las 3 sillas del Jurado (*Fiscal del Contrato*, *Cazador de Trampas* y *Artesano de Código*) y emite sentencia del *Juez* (solo lectura).
  4. **Reparador:** Aplica correcciones técnicas si el Tribunal encuentra fallas.
  5. **Analista (Cortacircuitos `2+1`):** Si el Implementador falla en el segundo intento, `vsdd harness verify` ejecuta `git restore` sobre los archivos productivos de la tarea para un tercer intento limpio (`2+1`). Si el tercer intento falla, revierte a limpio y presenta la ficha didáctica del **Analista** (máximo 12 líneas, 0 bloques de código, una analogía de la vida cotidiana y 3 opciones numeradas de resolución).
  El reporte de auditoría se transfiere **únicamente** dentro del prompt del subagente reparador.
- **Transparencia Absoluta de Agentes y Modelos:**
  - **Obligatorio antes del despacho:** Imprimir visiblemente en el chat el aviso correspondiente antes de lanzar cada subagente:
    * `● [Subagente: Autor de Tests] Preparando y sellando pruebas de TASK-xx con modelo: <modelo>...`
    * `● [Subagente: Implementador] Ejecutando TASK-xx (<título>) con modelo: <modelo>...`
    * `● [Subagente: Auditoría / Tribunal de Fase N] Evaluando 3 lentes (Fiscal, Cazador, Artesano) y sentencia del Juez con modelo: <modelo>...`
    * `● [Subagente: Reparador de Fase N] Aplicando correcciones con modelo: <modelo>...`
    * `● [Subagente: Cierre de Fase N] Ejecutando pruebas (<comando>) con modelo: <modelo>...`
  - **Fallback transparente:** Si el entorno o CLI no soporta el modelo solicitado o produce un error al inicializarlo, emitir de inmediato un aviso visible en el chat explicando el motivo:
    `▲ [Aviso] No fue posible usar el modelo '<modelo>' en este entorno. Continuando con el modelo activo '<inherit>'.`
- **Contrato Universal de Calidad y Pruebas:**
  - El cierre de cada fase se valida ejecutando el comando de pruebas y calidad real del proyecto detectado dinámicamente (`npm test`, `go test ./...`, `pytest`, `cargo test`, Makefile target, etc.). Prohibido invocar comandos monorrepo propietarios fijos.
- **Ergonomía Visual en Terminal:**
  - Prohibido pegar salidas crudas de `git diff`, árboles masivos o volcados de logs en el chat.
  - Al hilo principal solo se envían checkpoints breves y estructurados:
    * `✔ [TASK-xx OK] <título> · Commit: <hash>`
    * `✔ [FASE-N AUDIT] Código limpio y verificado`
    * `✔ [FASE-N OK] Pruebas verdes (<comando>) · Commit de fase: <hash>`
- **Cancelación Segura (Zero-Loss):**
  - Si el usuario indica "para", "stop" o interrumpe la ejecución:
    1. Revertir únicamente los cambios incompletos de los archivos tocados en la tarea en curso (`git restore <archivos_tarea>`), evitando limpiezas destructivas globales.
    2. Las tareas anteriores quedan 100% preservadas en sus respectivos commits previos.
    3. Asegurar que `tasks.md` en disco conserve marcadas `[x]` las tareas completadas y `[ ]` la interrumpida.
    4. Informar al usuario el punto exacto de guardado y cómo retomar ejecutando `vsdd apply`.

---

## Niveles de Razonamiento (Tiers Abstractos)

Para evitar acoplar la skill a nombres efímeros de modelos de proveedores, se clasifica el trabajo por niveles de razonamiento y se consulta al usuario su preferencia:

- **Nivel Bajo (Mecánico):** DTOs, interfaces simples, exportaciones (`index`), mocks, estilos básicos. Modelos rápidos y económicos (ej: `flash`, `haiku`).
- **Nivel Medio (Estándar):** Servicios de aplicación, componentes de interfaz, hooks, consultas y lógica CRUD. Modelos balanceados de producción diaria (ej: `sonnet`).
- **Nivel Alto (Razonamiento Profundo):** Entidades de dominio, algoritmos de negocio complejos, seguridad, autenticación, arquitecturas distribuidas, TDD con invariantes. Modelos avanzados de deliberación (ej: `pro`, `opus`).
- **Nivel Crítico (Auditoría Independiente):** Verificación adversaria, análisis de regresión y cumplimiento de contratos. Modelos de razonamiento máximo sin condescendencia.

---

## Flujo de Ejecución

1. **Lectura de la Siguiente Tarea:**
   Leer únicamente los encabezados de `tasks.md`: fase activa y primer `- [ ]`. No escanear el código del proyecto.
2. **Selección de Estrategia y Configuración de Modelos:**
   Presentar en el chat:

```text
Listo para implementar tareas de tasks.md.
¿Cómo prefieres ejecutar?
1. Por Fases [Recomendada] (ejecuta una fase completa con micro-commits, auditoría al final y frena).
2. Tarea por Tarea (ejecuta 1 sola tarea de slicing vertical, comitea y pregunta antes de seguir).
3. Modo Continuo (avanza fase tras fase con auditorías automáticas hasta completar tasks.md).
```

- **Si elige 1 (Por Fases) o 2 (Tarea por Tarea):**
  Presentar la fase activa, su nivel recomendado de razonamiento con motivo, y solicitar el modelo a utilizar (o presionar Enter para `inherit`).
- **Si elige 3 (Modo Continuo):**
  Presentar el desglose de todas las fases pendientes con su nivel recomendado y solicitar la configuración de modelos en un solo turno.

3. **Ejecución de Tarea (Separación Autor de Tests + Implementador bajo `vsdd harness`):**
   - **Paso 3a — Subagente Autor de Tests (Red Gate + Candado SHA-256):**
     * Anunciar en chat: `● [Subagente: Autor de Tests] Preparando y sellando pruebas de TASK-xx con modelo: <modelo>...`
     * Despachar al **Autor de Tests**: obtiene el contexto de la tarea con `vsdd harness brief TASK-xx` (y opcionalmente consulta `vsdd oracle <id> --dry-run` como guía declarativa).
     * Redacta en el archivo de pruebas únicamente los casos activos de `TASK-xx` sobre la interfaz pública (sin tocar código de producción y **sin dejar bloques `.todo` ni `.skip`** en el archivo) respetando las 4 Fronteras Negativas:
       1. **Prohibido el test espejo:** No recalcular la lógica dentro del test; usar los valores concretos esperados de `spec.md`.
       2. **Prohibido espiar las entrañas (Cero White-Box):** Evaluar únicamente entradas y salidas públicas.
       3. **Prohibido mockear la memoria:** Los test doubles se reservan exclusivamente para frontera I/O.
       4. **Prohibido el test cosmético:** Cero `toBeDefined` / `not.toBeNull` vacíos; comprobar valores observables reales.
     * Ejecuta `vsdd harness seal <ruta-test> --task TASK-xx` para verificar que el test falle en Rojo y sellar su hash SHA-256 en `context.json`.
   - **Paso 3b — Subagente Implementador (Green + Higiene Estructural):**
     * Anunciar en chat: `● [Subagente: Implementador] Ejecutando TASK-xx (<título>) con modelo: <modelo>...`
     * Despachar al **Implementador**: lee su contexto con `vsdd harness brief TASK-xx`, implementa el código mínimo de producción dentro de los archivos autorizados de la tarea **sin modificar el archivo de pruebas sellado**, y ejecuta `vsdd harness verify TASK-xx`.
     * **Si `vsdd harness verify TASK-xx` aprueba en Verde (Exit 0):** el Implementador realiza el commit atómico bajo Conventional Commits, marca `- [x]` en `tasks.md` y devuelve el checkpoint `✔ [TASK-xx OK] <título> · Commit: <hash>`.
     * **Arbitraje de Apelaciones (`vsdd harness appeal`):** Si el Implementador detecta que el test sellado contradice `spec.md`, ejecuta `vsdd harness appeal TASK-xx --reason "<motivo>"` y se detiene. El Conductor contrasta el reclamo contra `spec.md`:
       - *Si la apelación es válida:* ejecuta `vsdd harness appeal TASK-xx --resolve approved` (abre el candado SHA-256), despacha al **Autor de Tests** para corregir y re-sellar el test en Rojo (`vsdd harness seal`), y reanuda al Implementador.
       - *Si la apelación es inválida:* ejecuta `vsdd harness appeal TASK-xx --resolve rejected` (mantiene candado y consume 1 intento) e instruye al Implementador a corregir el código productivo.
     * **Cortacircuitos `2+1` y Analista:** Si el 2.º intento de `vsdd harness verify` falla, el arnés restaura automáticamente a limpio los archivos productivos de la tarea para un 3.er intento limpio. Si el 3.er intento falla (`blocked_analyst`), el Conductor **SE DETIENE**, muestra en el chat la ficha didáctica del **Analista** (máximo 12 líneas, 0 bloques de código, una analogía cotidiana y 3 opciones numeradas de resolución) y espera decisión del usuario.

4. **Cierre de Fase (Subagente Tribunal de Fase 3+1 y Reparador):**
   - Anunciar en chat: `● [Subagente: Auditoría / Tribunal de Fase N] Evaluando 3 lentes (Fiscal, Cazador, Artesano) y sentencia del Juez con modelo: <modelo>...`
   - Invocar en **1 sola llamada** al subagente auditor independiente (solo lectura, nivel Crítico) sobre el diff de la fase y `context.json`. No pegar el reporte en el chat.
   - **Las 3 Sillas del Jurado + Sentencia del Juez:**
     1. **Fiscal del Contrato:** Confirma que todos los `RF`/`DT` de la fase estén cumplidos y que el diff esté 100% confinado al árbol de `plan.md` sin sobre-ingeniería.
     2. **Cazador de Trampas:** Verifica en `context.json` que las tareas de la fase tengan sus candados `verified` y rechaza cualquier violación a las 4 fronteras negativas (tests espejo, white-box, mocks en memoria, aserciones cosméticas o hardcoding).
     3. **Artesano de Código:** Audita higiene estructural (funciones $\le 50$ líneas efectivas, anidamiento $\le 3$ niveles, cero `catch` vacíos y cero supresores de tipos/linter).
     4. **Sentencia del Juez:** Emite veredicto sintético (`limpio` | `requiere-reparacion`).
   - Si el veredicto es `limpio`:
     - Anunciar en chat: `● [Subagente: Cierre de Fase N] Ejecutando pruebas (<comando>) con modelo: <modelo>...`
     - El subagente ejecuta el comando de pruebas y calidad del proyecto, realiza el commit de fase y marca el bloque de control en `tasks.md`.
     - Checkpoint en chat: `✔ [FASE-N OK] Pruebas verdes (<comando>) · Commit de fase: <hash>`.
   - Si hay hallazgos del Tribunal:
     - **Prohibido que el conductor edite código.**
     - Anunciar en chat: `● [Subagente: Reparador de Fase N] Aplicando correcciones con modelo: <modelo>...`
     - Invocar subagente reparador pasando el reporte exclusivamente en su prompt. El reparador aplica los fixes mínimos dentro del árbol autorizado, valida pruebas e higiene, comitea y devuelve archivos tocados.
     - Relanzar el Tribunal (máximo 2 iteraciones). Si persiste: frenar y reportar diagnóstico breve al usuario ($\le 5$ líneas).

5. **Fin de la Implementación y Menú de Transición:**
   Al completarse todas las tareas (`[x]`) y todos los controles de fase de `tasks.md`:
   - Actualizar la cabecera de `tasks.md` a `Estado: listo-para-verify`.
   - Si Engram está disponible, persistir estado con `mem_save topic_key: vsdd-apply-<slug>`.
   - Presentar en la terminal el menú de transición de 3 opciones:

```text
╭────────────────────────────────────────────────────────╮
│  ✔ Implementación completada con éxito                 │
│    Todas las tareas en verde bajo TDD y commits limpios│
╰────────────────────────────────────────────────────────╯

¿Cuál es el siguiente paso que deseas realizar?
1. Pasar a la verificación final (vsdd verify)
2. Revisar diff de la rama antes de verificar
3. Pausar aquí y retomar la verificación luego
```

- **DETENERSE (STOP). Prohibido iniciar o encadenar `vsdd verify` automáticamente en el mismo turno.** Esperar la elección explícita del usuario.
- Opción 1: Iniciar la fase de verificación cargando `references/verify.md`.
- Opción 2: Ejecutar `git diff --stat <rama_base>` y esperar comentarios.
- Opción 3: Confirmar que el estado quedó guardado en `Estado: listo-para-verify` y listo para retomar con `vsdd verify`.

---

## Contrato de Salida

* **En el chat:** Avisos previos visibles antes del despacho de cada subagente, checkpoints breves con íconos sobrios (`✔`), cero volcados de terminal o diffs, y reporte final limpio.
* **En el disco:** Código modificado exclusivamente dentro del árbol de `plan.md`, tareas marcadas con `[x]` y commits atómicos limpios bajo Conventional Commits.
