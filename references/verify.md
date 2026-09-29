# Verificación y Cierre (Verify)

Valida de forma exhaustiva que la funcionalidad implementada cumple al 100% con la especificación (`spec.md`), los requisitos funcionales (`RF`) y no funcionales (`RNF`), el contrato observable del **"Listo cuando"** de `idea.md` y las pruebas de calidad del proyecto. Si algo falla, un bucle autónomo repara y comitea hasta alcanzar luz verde.

**El conductor no verifica código directamente.** Diffs, matriz de requisitos, suites de tests y gates corren en subagentes especializados. El hilo principal de chat únicamente gestiona checkpoints breves, el informe ejecutivo estilizado y la confirmación humana de cierre. Pegar logs masivos, `git diff` o reportes crudos de auditoría en la terminal es considerado un defecto.

---

## Reglas Innegociables

- **Git Guard previo obligatorio:** Antes de despachar subagentes, verificar `git status -s`. Si el árbol tiene cambios pendientes ajenos a la verificación, DETENERSE (STOP) y solicitar al usuario que los comitee o guarde.
- **Precondición de entrada:** Requerir que `tasks.md` esté en `Estado: listo-para-verify` y que no existan tareas pendientes (`- [ ]`). Si no, indicar que primero debe ejecutarse `vsdd apply`.
- **Conductor No Modifica Código de Producto:** El agente principal **nunca** edita archivos de la aplicación, **nunca** ejecuta directamente suites de pruebas masivas, **nunca** inspecciona `git diff` de producto en el hilo principal y **nunca** pega reportes de auditoría en el chat. Se utilizan subagentes diferenciados:
  1. **Auditor de Verificación (solo lectura, nivel Crítico):** Valida RFs, RNFs y el "Listo cuando".
  2. **Runner de Calidad:** Ejecuta el comando de pruebas y calidad del proyecto.
  3. **Reparador:** Aplica correcciones técnicas mínimas si hay fallos.
  4. **Closer (DoD):** Prepara la consolidación hacia la rama base.
  5. **Asistente Golden Path (modo asistido opcional):** Ejecuta simulación de humo en segundo plano con modelo económico recomendado (`flash` / `haiku`).
- **Trazabilidad Estricta y Validación del "Listo cuando":**
  - Cada `RF-xx` y `RNF-xx` de `spec.md` debe estar mapeado a código y pruebas automatizadas.
  - El auditor debe verificar explícitamente el cumplimiento de las 1 a 3 condiciones observables del **"Listo cuando"** heredadas de `idea.md` y formalizadas en los criterios de finalización de `spec.md`.
- **Contrato Universal de Calidad:**
  - Las pruebas se validan ejecutando el comando propio del proyecto detectado dinámicamente (`npm test`, `go test ./...`, `pytest`, `cargo test`, Makefile target, etc.). Prohibido invocar comandos propietarios fijos de monorrepos.
- **Transparencia Absoluta de Agentes y Modelos:**
  - **Obligatorio antes del despacho:** Imprimir visiblemente en el chat el aviso correspondiente antes de lanzar cada subagente:
    * `● [Subagente: Auditoría Final de Verificación] Verificando requisitos y Listo cuando con modelo: <modelo>...`
    * `● [Subagente: Runner de Calidad] Ejecutando pruebas (<comando>) con modelo: <modelo>...`
    * `● [Subagente: Reparador de Verificación] Aplicando correcciones con modelo: <modelo>...`
    * `● [Subagente: Preparación DoD] Consolidando entrega hacia <rama_base> con modelo: <modelo>...`
    * `● [Subagente: Asistente Golden Path] Ejecutando simulación de humo con modelo económico: <modelo>...`
  - **Fallback transparente:** Si un modelo no está soportado o la inicialización falla:
    `▲ [Aviso] No fue posible despachar el subagente; el agente principal asume la tarea localmente.`
- **Soberanía del Entorno y Seguridad (No-Invasion):**
  - Prohibido que la IA intente controlar periféricos de escritorio, teclado físico, cursor de mouse o ventanas activas del usuario sin consentimiento explícito. Toda simulación interactiva se ejecuta en subprocesos aislados (pipes, background runners, curl).
- **Eficiencia Radical de Costos en Modo Asistido:**
  - Para simulaciones mecánicas de humo solicitadas por el usuario ("Pruébalo tú"), jamás utilizar modelos pesados (Opus o Pro); despachar obligatoriamente modelos rápidos y económicos (`flash` o `haiku`).
- **Bucle de Auto-Corrección (Self-Healing):**
  - Si el auditor detecta discrepancias o el runner reporta pruebas fallidas:
    1. Invocar **subagente reparador** pasando los hallazgos exclusivamente en su prompt.
    2. El reparador aplica la corrección mínima dentro del árbol autorizado de `plan.md`, realiza un commit atómico bajo Conventional Commits y re-ejecuta pruebas.
    3. Relanzar auditor y runner (máximo **2** iteraciones). Si el fallo persiste: STOP y presentar diagnóstico breve al usuario ($\le 5$ líneas, sin volcados de logs).
- **Ergonomía Visual en Terminal (Thin Thread):**
  - Informe final presentado en el chat estructurado en bloques claros y sintetizados. Gotchas o advertencias técnicas: máximo 3 viñetas breves.

---

## Flujo de Verificación

1. **Entrada y Git Guard (conductor):**
   - Ejecutar `git status -s`. Si hay modificaciones ajenas pendientes, STOP.
   - Comprobar que en `tasks.md` todas las tareas estén completadas (`[x]`).
2. **Auditoría Independiente de Requisitos y Contrato (Subagente):**
   - Anunciar en chat: `● [Subagente: Auditoría Final de Verificación] Verificando requisitos y Listo cuando con modelo: <modelo>...`
   - Despachar subagente auditor independiente (solo lectura, nivel Crítico). Paths: `idea.md`, `spec.md`, `plan.md`, `tasks.md` y directrices del proyecto detectadas dinámicamente. Evalúa diff de la rama actual vs. rama base.
   - Checkpoint en chat: `✔ [VERIFY AUDIT] Requisitos verificados` o `▲ [VERIFY AUDIT] k discrepancias detectadas`.

```text
Rol: auditor independiente de verificación. Solo lectura. No propongas parches ni reescribas código.
1) Cada RF-xx: archivo impl + test + PASS/FAIL (una línea)
2) Cada RNF-xx: evidencia observable + PASS/FAIL (una línea)
3) Criterios "Listo cuando" de idea.md / spec.md: cumplido o pendiente
4) Diff fuera del árbol de plan.md, o sobre-ingeniería innecesaria vs idea.md
Veredicto: limpio | ok-con-huecos | bloquea
≤40 líneas. Prohibido volcar stdout o diffs crudos.
```

3. **Runner de Calidad y Pruebas del Proyecto (Subagente):**
   - Anunciar en chat: `● [Subagente: Runner de Calidad] Ejecutando pruebas (<comando>) con modelo: <modelo>...`
   - Despachar subagente runner para ejecutar el comando de pruebas y calidad del proyecto.
   - Checkpoint en chat: `✔ [VERIFY GATE] Pruebas verdes (<comando>) · 0 fallos`.

```text
Rol: runner de calidad del proyecto. No editar código.
Ejecutar el comando de pruebas y calidad del proyecto.
Devolver solo: comando ejecutado, PASS/FAIL y resumen de pruebas (ej: 10/10 PASS).
Si FAIL: ≤5 líneas indicando el nombre exacto del test que falló. Sin logs completos.
```

4. **Reparación (si auditor ≠ limpio o runner ≠ PASS):**
   - Si existen discrepancias:
     - Anunciar en chat: `● [Subagente: Reparador de Verificación] Aplicando correcciones con modelo: <modelo>...`
     - Invocar subagente reparador pasando los hallazgos en su prompt.
     - Checkpoint en chat: `✔ [VERIFY FIX] <causa breve> → Commit: <hash> → Pruebas: PASS`.
     - Relanzar pasos 2 y 3 (máximo 2 iteraciones).

```text
Rol: reparador de verificación. No ensanchar el alcance.
Hallazgos: <reporte compacto del auditor y/o del runner>
Árbol autorizado: <rutas del plan.md>
Fix mínimo estricto, TDD, Conventional Commits y validación de pruebas.
Devolver solo: archivos tocados, hash de commit y resultado de pruebas.
```

5. **Informe Ejecutivo en Terminal (Conductor):**
   Al alcanzar luz verde en auditoría y pruebas, presentar en el chat el informe ejecutivo estructurado con la guía de verificación manual (Golden Path):

```text
╭────────────────────────────────────────────────────────╮
│  ✔ Verificación de Funcionalidad: <Nombre>             │
│    Estado: 100% VERDE · Calidad Validada               │
╰────────────────────────────────────────────────────────╯

1. Cobertura de Requisitos y Contrato:
   ✔ Requisitos Funcionales (RF): X/X cubiertos y validados con pruebas
   ✔ Requisitos No Funcionales (RNF): X/X verificados
   ✔ Contrato "Listo cuando": 100% cumplido (X/X condiciones observables comprobadas)

2. Evidencia de Calidad del Proyecto:
   ✔ Pruebas del proyecto (<comando>): PASS (0 errores)

3. 🚶‍♂️ Guía de Verificación Manual (Golden Path en ≤ 2 min):
   Superficie: [CLI Interactivo | Web | API | Headless]
   (Si es Headless/Interno: "No requiere verificación manual de usuario; 100% automatizado vía pruebas de integración")

   • [ARRANCAR]: Copia y ejecuta:
     $ <comando exacto o URL local>
   • [INTERACCIÓN]: Acción concreta:
     <qué escribir, teclear o cliquear paso a paso>
   • [QUÉ DEBES VER CON TUS OJOS]: Criterio observable inequívoco:
     ✔ Éxito: Verás <mensaje o componente esperado>.
     ✖ Fallo: Si aparece <error conocido>, la prueba falló.

4. Notas Técnicas y Runtime:
   • <Máximo 3 viñetas breves de contexto útil. Si no hay: Ninguna.>

5. Próximo Paso (Definition of Done):
   Rama activa: <rama_actual> · Rama base: <rama_base>

   ¿Cómo deseas proceder con la entrega de esta funcionalidad?
   1. Lo probé y funcionó perfecto → Integrar y fusionar hacia <rama_base> (git merge --no-ff)
   2. Confío en los tests automáticos / Sin tiempo ahora → Integrar y fusionar directamente
   3. ¿Prefieres que yo simule el Golden Path en segundo plano? Escribe: "Pruébalo tú"
      (Ejecuta subagente asistente con modelo económico recomendado: flash)
   4. Mantener la rama abierta para revisión manual o Pull Request
   5. Relanzar verificación completa
```

- **Si el usuario elige "Pruébalo tú" (Modo Asistido):**
  1. Anunciar en chat: `● [Subagente: Asistente Golden Path] Ejecutando simulación de humo en segundo plano con modelo económico: flash...`
  2. Despachar subagente asistente con modelo rápido (`flash` / `haiku`). El subagente ejecuta el comando de prueba en subproceso no destructivo (buffer/pipe/curl) sin invadir el monitor del usuario y confirma la salida observable.
  3. Checkpoint en chat: `✔ [ASISTENTE GOLDEN PATH] Simulación exitosa: Salida observable confirmada.`
  4. Devolver el control al menú de DoD (Opciones 1 o 4).

- Persistir estado en memoria: `mem_save topic_key: vsdd-verify-<slug>`.

6. **Consolidación y Definition of Done (si elige Opción 1 o 2):**
   - Anunciar en chat: `● [Subagente: Preparación DoD] Consolidando entrega hacia <rama_base> con modelo: <modelo>...`
   - Despachar subagente closer para inspeccionar commits y diff de la rama vs. `<rama_base>` (`git log --oneline <rama_base>..<rama>`, `git diff --stat <rama_base>..<rama>`).
   - Presentar en chat el resumen conciso (número de commits y archivos modificados) y **solicitar confirmación explícita antes de fusionar**:
     `¿Confirmas la integración definitiva de esta rama hacia <rama_base>? (Sí / No)`
   - **Tras confirmación con "Sí":**
     - El conductor ejecuta: `git checkout <rama_base> && git merge --no-ff <rama_actual>`.
     - **Cláusula de aborto por conflictos:** Si el comando `git merge` reporta conflictos de fusión, DETENERSE de inmediato, ejecutar `git merge --abort`, notificar al usuario y devolver el control para resolución manual asistida.
     - Si la fusión es exitosa:
       1. **Generación automática del artefacto permanente de cierre (`resumen.md`):**
          Escribir en `docs/sdd/vsdd/<nnn>-<slug>/resumen.md` un resumen conciso (≤ 35 líneas, breve y sin paja) que sintetice qué se hizo, componentes clave, tests en verde y **el Golden Path exacto** para mantenimiento futuro:

```markdown
# Resumen de Entrega: <Nombre de la funcionalidad>

Fecha: <YYYY-MM-DD>
Rama integrada: <rama_actual> → <rama_base>
Estado: completado

## 1. Qué se hizo
<2 a 3 oraciones concisas explicando el problema resuelto y la solución técnica implementada>

## 2. Componentes y Pruebas
- Archivos clave: `<ruta/principal.ext>`
- Calidad: <X>/<X> pruebas en verde (<comando de pruebas>)

## 3. Golden Path (Cómo probar esta funcionalidad)
Superficie: <CLI Interactivo | Web | API | Headless>
- **Paso 1 (Arranque):** `<comando o URL>`
- **Paso 2 (Acción):** `<input, clics o parámetros exactos>`
- **Paso 3 (Resultado esperado observable):** `<qué se debe observar en pantalla>`

## 4. Notas de entrega
- <Máximo 2 viñetas con observaciones técnicas relevantes. Si no: Ninguna.>
```

       2. Actualizar la cabecera de `tasks.md` y `spec.md` en disco a `Estado: completado`. Con esto la funcionalidad queda formalmente terminada y archivada.
       3. Persistir en Engram el cierre formal: `mem_save(topic_key: "sdd/<slug>/archive-report", title: "Resumen de Entrega: <slug>")`.
       4. Preguntar amablemente:
          `¿Deseas eliminar la rama local integrada (<rama_actual>) y en el repositorio remoto si existe? (1: Solo local / 2: Local y remota / 3: Conservar ambas)`
          Ejecutar la opción seleccionada limpiamente.
       5. Confirmar en el chat la finalización exitosa del ciclo VSDD.

---

## Contrato de Salida

* **En el chat:** Avisos previos visibles antes de despachar subagentes, checkpoints sobrios (`✔`), informe ejecutivo final estructurado y confirmación humana explícita antes de cualquier merge en Git.
* **En el disco:** Cobertura de tests y código 100% verde, tareas marcadas como completadas, fusión limpia hacia la rama base elegida por el usuario y registro histórico en Engram.
