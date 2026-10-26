# Tareas 001 Test Harness Antifraude, Contexto Inteligente y Tribunal de Calidad

Estado: listo-para-aplicar

Idea: `docs/sdd/vsdd/001-test-harness-tribunal/idea.md`
Plan: `docs/sdd/vsdd/001-test-harness-tribunal/plan.md`

## Reglas de ejecución

- **Granularidad:** tareas pequeñas orientadas a Slicing Vertical (comportamiento atómico comprobable). Si una tarea abarca más de una unidad de valor observable, se subdivide.
- **TDD estricto:** cada tarea define y ejecuta primero la prueba automatizada que debe fallar antes de tocar código de producción.
- **Código puro y automatizable:** cada tarea debe ser 100% ejecutable mediante código y pruebas automatizadas (TDD). Prohibido incluir tareas manuales, spikes de investigación exploratoria o configuraciones manuales de entorno. Todo prerrequisito debe haberse resuelto previamente en `plan.md`.
- **Commits atómicos:** commit obligatorio al terminar cada tarea y cada fase, bajo el estándar Conventional Commits (`<tipo>(<alcance>): <descripción>`), sin trailers de IA ni Co-Authored-By.
- **Control de calidad por fase:** al finalizar cada fase, un auditor independiente (solo lectura) revisa el código implementado contra spec y plan. Los ajustes los aplica un subagente reparador independiente (el agente conductor nunca edita código de producto). La fase se cierra validando con el comando de pruebas y calidad del proyecto.

## Fase 1: Core Vertical Slice — Contexto Inteligente y Enrutamiento CLI

- [x] **TASK-01: Ensamblador de Contexto Compartido y Corte de Tarea con persistencia en context.json**
  - **Qué:** Extiende `scripts/lib/state.js` para preservar la clave `harness` en `context.json` e implementa `scripts/lib/harness/brief.js` para construir el Contexto Compartido Global (cacheado con invalidación automática por `mtime` de `idea.md`, `spec.md` y `plan.md`) y fusionarlo en 0 tokens con el Corte Específico de la Tarea activa (`RF-xx` y `DT-xx` íntegros más resumen de tareas previas completadas), rechazando con error tareas inexistentes.
  - **Cubre:** RF-01, DT-01, DT-02, RNF (Rendimiento y 0 tokens)
  - **Archivos:** `~ scripts/lib/state.js`, `+ scripts/lib/harness/brief.js`, `+ tests/vsdd-harness.test.js`
  - **Test primero (TDD):** Suite automatizada en `tests/vsdd-harness.test.js` comprobando que `assembleBrief` genera el Contexto Compartido Global unido al bloque íntegro de `RF-01` y `TASK-01`, reutiliza la caché si no cambió `mtime`, la invalida si se edita `spec.md` y falla ante un identificador de tarea inexistente.
  - **Listo cuando:** Las pruebas unitarias de `assembleBrief` y persistencia de `harness` en `context.json` pasan en verde en menos de 100 ms.
  - [x] **Commit de tarea:** `feat(harness): implementar ensamblador de contexto compartido y corte de tarea`

- [x] **TASK-02: Enrutamiento de vsdd harness brief en CLI y fachada de terminal**
  - **Qué:** Crea `scripts/vsdd-harness.js` y registra el subcomando `harness` en `scripts/cli.js` y `package.json`, permitiendo invocar `vsdd harness brief <task-id> [--json]` desde la terminal con salida estructurada de máximo 80 columnas.
  - **Cubre:** RF-01, DT-02, RNF (Ergonomía visual 80 cols)
  - **Archivos:** `~ package.json`, `~ scripts/cli.js`, `+ scripts/vsdd-harness.js`, `~ tests/vsdd-harness.test.js`
  - **Test primero (TDD):** Prueba de integración en `tests/vsdd-harness.test.js` verificando que `parseCliCommand(['harness', 'brief', 'TASK-01'])` enrute a `vsdd-harness.js` y que la invocación del CLI emita el briefing con código 0 y código 1 ante tarea inexistente.
  - **Listo cuando:** El comando `node ./scripts/cli.js harness brief TASK-01` emite el contexto completo tanto en formato texto como con `--json`.
  - [x] **Commit de tarea:** `feat(cli): registrar comando vsdd harness y subcomando brief`

### Control de Fase 1

- [ ] **Auditoría independiente de Fase 1:** subagente QA revisa código de la fase contra spec/plan (solo lectura). Si hay hallazgos, un subagente reparador aplica los ajustes y se relanza la auditoría (máximo 2 iteraciones).
- [ ] **Commit de Fase 1:** commit de cierre de fase validado con el comando de pruebas/calidad del proyecto (`npm test`).

## Fase 2: Candado Criptográfico en Rojo y Analizador Anti-Espagueti

- [ ] **TASK-03: Analizador léxico y estructural 0-tokens para tests y código de producción**
  - **Qué:** Implementa `scripts/lib/harness/analyzer.js` en Node.js puro (cero dependencias) para detectar `.skip`/`todo`, aserciones cosméticas (`toBeDefined`, `toBeTruthy`, `expect(true).toBe(true)`), bloques `catch` vacíos, supresores (`@ts-ignore`, `# type: ignore`), literales espejo mayores a 8 caracteres copiados de los ejemplos de prueba y funciones nuevas con más de 50 líneas o más de 3 niveles de anidamiento.
  - **Cubre:** RF-02, RF-03, DT-04, RNF (Rendimiento y 0 tokens), RNF (Agnosticismo de lenguaje)
  - **Archivos:** `+ scripts/lib/harness/analyzer.js`, `~ tests/vsdd-harness.test.js`
  - **Test primero (TDD):** Pruebas unitarias en `tests/vsdd-harness.test.js` validando detección exacta de `.skip`, `toBeDefined`, `catch` vacío, funciones nuevas de más de 50 líneas, más de 3 niveles de `if` anidados y literales espejo en código de distintos lenguajes, aprobando código modular limpio.
  - **Listo cuando:** Todas las pruebas del analizador léxico y estructural pasan en verde con cero falsos positivos sobre código modular.
  - [ ] **Commit de tarea:** `feat(harness): agregar analizador lexico anti-trampa y anti-espagueti`

- [ ] **TASK-04: Sellado criptográfico SHA-256 en Rojo (vsdd harness seal)**
  - **Qué:** Implementa `scripts/lib/harness/seal.js` y su conexión en `scripts/vsdd-harness.js` con autodetección de runner (`--cmd`, timeout de 30s e inyección `runnerFn`), validando ausencia de trampas léxicas en el test, comprobando que falle en Rojo (código distinto de cero) y almacenando el hash SHA-256 en `context.json`.
  - **Cubre:** RF-02, DT-01, DT-03, DT-04, RNF (Agnosticismo de lenguaje)
  - **Archivos:** `+ scripts/lib/harness/seal.js`, `~ scripts/vsdd-harness.js`, `~ tests/vsdd-harness.test.js`
  - **Test primero (TDD):** Pruebas en `tests/vsdd-harness.test.js` comprobando que `sealTest` rechaza con código 1 si el test pasa en verde antes de implementar o si contiene `.skip`, y sella el SHA-256 en `context.json` cuando el test falla en Rojo.
  - **Listo cuando:** `vsdd harness seal` registra el sello SHA-256 en `context.json` únicamente cuando el test falla en Rojo y carece de trampas.
  - [ ] **Commit de tarea:** `feat(harness): implementar sellado sha256 en rojo con red gate`

### Control de Fase 2

- [ ] **Auditoría independiente de Fase 2:** subagente QA revisa código de la fase (solo lectura). Si hay hallazgos, un subagente reparador aplica los ajustes y se relanza la auditoría (máximo 2 iteraciones).
- [ ] **Commit de Fase 2:** commit de cierre de fase validado con el comando de pruebas/calidad del proyecto (`npm test`).

## Fase 3: Verificador, Cortacircuitos 2+1, Apelaciones y Protocolo del Tribunal

- [ ] **TASK-05: Verificador de integridad, cortacircuitos 2+1 con git restore y ficha del Analista (vsdd harness verify)**
  - **Qué:** Implementa `scripts/lib/harness/verify.js` y su subcomando en `scripts/vsdd-harness.js` para validar el candado SHA-256 de los tests, comprobar el pase en Verde, ejecutar el analizador anti-espagueti sobre los archivos de producción del plan y aplicar automáticamente el cortacircuitos `2+1` (restauración acotada con `git restore` en los fallos 2 y 3 sin tocar archivos ajenos y activación de la ficha didáctica del Analista en el tercer fallo).
  - **Cubre:** RF-02, RF-03, RF-05, DT-01, DT-03, DT-04, DT-05, RNF (Tono didáctico del Analista)
  - **Archivos:** `+ scripts/lib/harness/verify.js`, `~ scripts/vsdd-harness.js`, `~ tests/vsdd-harness.test.js`
  - **Test primero (TDD):** Pruebas en `tests/vsdd-harness.test.js` verificando rechazo inmediato si cambia el hash del test, aprobación en Verde con código limpio, ejecución de restauración acotada en el fallo #2, y activación de `analystRequired: true` con plantilla didáctica en el fallo #3.
  - **Listo cuando:** `vsdd harness verify` bloquea manipulaciones de tests y código espagueti, y ejecuta el ciclo 2+1 de forma determinista.
  - [ ] **Commit de tarea:** `feat(harness): implementar verificador sha256 y cortacircuitos 2+1`

- [ ] **TASK-06: Gestor de apelaciones (vsdd harness appeal) y actualización de guías operativas del Tribunal**
  - **Qué:** Implementa `scripts/lib/harness/appeal.js` conectado a `scripts/vsdd-harness.js` para registrar y resolver apelaciones (`accept` desbloquea el sello para el Autor de Tests; `reject` conserva el candado y descuenta un intento), y actualiza `SKILL.md`, `references/tasks.md`, `references/apply.md` y `references/verify.md` con la separación Autor de Tests vs. Implementador, el protocolo 2+1, el Tribunal de 3 lentes en una sola llamada por cierre de fase y el formato del Analista.
  - **Cubre:** RF-04, RF-05, DT-01, DT-05, RNF (Ergonomía visual 80 cols), RNF (Tono didáctico del Analista)
  - **Archivos:** `+ scripts/lib/harness/appeal.js`, `~ scripts/vsdd-harness.js`, `~ SKILL.md`, `~ references/tasks.md`, `~ references/apply.md`, `~ references/verify.md`, `~ tests/vsdd-harness.test.js`
  - **Test primero (TDD):** Pruebas en `tests/vsdd-harness.test.js` validando el ciclo completo de `vsdd harness appeal` (creación, aceptación que abre el candado y rechazo que consume intento) y verificación de integridad de las guías del repositorio.
  - **Listo cuando:** El subcomando `appeal` y las guías operativas actualizadas pasan el 100% de la suite de pruebas del repositorio (`npm test`).
  - [ ] **Commit de tarea:** `feat(harness): agregar gestor de apelaciones y actualizar protocolo del tribunal`

### Control de Fase 3

- [ ] **Auditoría independiente de Fase 3:** subagente QA revisa código de la fase (solo lectura). Si hay hallazgos, un subagente reparador aplica los ajustes y se relanza la auditoría (máximo 2 iteraciones).
- [ ] **Commit de Fase 3:** commit de cierre de fase validado con el comando de pruebas/calidad del proyecto (`npm test`).

## Fuera de este corte

Nada: el plan cabe entero en esta entrega.

## Dudas abiertas

Ninguna.
