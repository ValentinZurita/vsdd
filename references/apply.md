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
- **Conductor No Parchea Código:** El agente principal **nunca** edita código del proyecto, **nunca** aplica hallazgos del auditor y **nunca** pega reportes de auditoría en el chat. Se utilizan tres subagentes diferenciados:
  1. **Implementador:** Escribe tests y código para las tareas.
  2. **Auditor de Fase:** Revisa el diff de la fase (solo lectura).
  3. **Reparador:** Aplica correcciones técnicas si el auditor encuentra fallas.
  El reporte de auditoría se transfiere **únicamente** dentro del prompt del subagente reparador.
- **Transparencia Absoluta de Agentes y Modelos:**
  - **Obligatorio antes del despacho:** Imprimir visiblemente en el chat el aviso correspondiente antes de lanzar cada subagente:
    * `● [Subagente: Implementador] Ejecutando TASK-xx (<título>) con modelo: <modelo>...`
    * `● [Subagente: Auditoría de Fase N] Verificando diff de la fase con modelo: <modelo>...`
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
    1. Ejecutar `git restore . && git clean -fd` para limpiar cambios incompletos de la tarea en curso.
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

3. **Ejecución de Tarea (Subagente Implementador):**
   - Anunciar en chat: `● [Subagente: Implementador] Ejecutando TASK-xx (<título>) con modelo: <modelo>...`
   - Invocar subagente implementador con los paths a `idea.md`, `spec.md`, `plan.md`, `tasks.md`, directrices del proyecto y el identificador `TASK-xx`.
   - **Directrices Innegociables de Calidad y TDD:**
     * *Slicing Vertical:* Escribir primero el test que falla (Red) derivado del Example Mapping de `spec.md`, luego el código mínimo que lo hace pasar (Green), y refactorizar.
     * *Anti-Test-Smells:* Prohibido generar tests tautológicos/espejo, sobre-mockeo (mocks de mocks) o aserciones superficiales (ej. `toBeDefined`). Toda aserción debe validar el comportamiento observable del contrato.
     * *Árbol Cerrado:* Modificar únicamente los archivos autorizados en el árbol de `plan.md`.
   - El subagente verifica pruebas en verde, realiza el commit atómico y marca `- [x]` en `tasks.md`.
   - Checkpoint en chat: `✔ [TASK-xx OK] <título> · Commit: <hash>`.

4. **Cierre de Fase (Subagente Auditor y Reparador):**
   - Anunciar en chat: `● [Subagente: Auditoría de Fase N] Verificando diff de la fase con modelo: <modelo>...`
   - Invocar subagente auditor independiente (solo lectura, nivel Crítico) sobre el diff de la fase. No pegar el reporte en el chat.
   - **Evaluación del Auditor de Fase:** Confirma que el diff esté confinado al árbol del plan, que no haya sobre-ingeniería y rechaza activamente *test smells* (tests que validen perogrulladas, que espíen métodos internos en lugar de la API pública o que tengan mocks innecesarios).
   - Si el veredicto es `limpio`:
     - Anunciar en chat: `● [Subagente: Cierre de Fase N] Ejecutando pruebas (<comando>) con modelo: <modelo>...`
     - El subagente ejecuta el comando de pruebas y calidad del proyecto, realiza el commit de fase y marca el bloque de control en `tasks.md`.
     - Checkpoint en chat: `✔ [FASE-N OK] Pruebas verdes (<comando>) · Commit de fase: <hash>`.
   - Si hay hallazgos del auditor:
     - **Prohibido que el conductor edite código.**
     - Anunciar en chat: `● [Subagente: Reparador de Fase N] Aplicando correcciones con modelo: <modelo>...`
     - Invocar subagente reparador pasando el reporte exclusivamente en su prompt. El reparador aplica los fixes mínimos, valida TDD, comitea y devuelve archivos tocados.
     - Relanzar el auditor (máximo 2 iteraciones). Si persiste: frenar y reportar diagnóstico breve al usuario ($\le 5$ líneas).

5. **Fin de la Implementación:**
   Al completarse todas las tareas (`[x]`) y todos los controles de fase de `tasks.md`:
   - Actualizar la cabecera de `tasks.md` a `Estado: listo-para-verify`.
   - Si Engram está disponible, persistir estado con `mem_save topic_key: vsdd-apply-<slug>`.
   - Presentar resumen en el chat confirmando la conclusión de la implementación e invitar al usuario a iniciar la fase final de verificación: `vsdd verify`.

---

## Contrato de Salida

* **En el chat:** Avisos previos visibles antes del despacho de cada subagente, checkpoints breves con íconos sobrios (`✔`), cero volcados de terminal o diffs, y reporte final limpio.
* **En el disco:** Código modificado exclusivamente dentro del árbol de `plan.md`, tareas marcadas con `[x]` y commits atómicos limpios bajo Conventional Commits.
