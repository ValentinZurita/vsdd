# Idea 001: Test Harness Antifraude, Contexto Inteligente y Tribunal de Calidad

Estado: listo-para-spec

## Problema
Hoy en VSDD el mismo subagente (`Implementador`) escribe tanto los tests como el código de producción en el mismo turno. Esto genera un conflicto de interés: cuando una prueba se complica, la IA suele hacer trampa debilitando el test, creando aserciones cosméticas o metiendo valores fijos (*hardcoding*). Además, si se bloquea el test sin guardarraíles de calidad, el problema se traslada al código en forma de espagueti (parche sobre parche) y reintentos repetitivos que gastan tokens releyendo requisitos y tareas de otras fases que no aplican al turno actual.

## Qué vamos a hacer
Implementar un sistema de **Test Harness, Ensamblaje Inteligente de Contexto y Tribunal de Calidad** que separe la creación de pruebas de la escritura del código:
1. **Harness Determinista y Contexto Inteligente en CLI (0 tokens):**
   - **Contexto por Trazabilidad (sin límites artificiales de líneas):** El CLI ensambla para cada turno toda la visión y arquitectura global (`idea.md`, Diseño Técnico, Árbol de Cambios, RNFs, Non-Goals/Anti-Goals, memoria del repo y estado de tareas previas) junto con el bloque íntegro de los `RF-xx`, `DT-xx` y `TASK-xx` activos, filtrando únicamente el ruido de tareas ajenas.
   - **Candado y Guardia Estructural (0 tokens):** Verifica el fallo inicial en Rojo, sella los archivos de test con hash SHA-256 para impedir modificaciones no autorizadas, y analiza el `git diff` para rechazar `.skip`, tests vacíos, literales del test hardcodeados en `src/` o código espagueti.
2. **Separación de Agentes y Cortacircuitos (2+1):** Un subagente diseña el test sobre la interfaz pública (dejando 100% de libertad para la arquitectura interna de `src/` y acceso a archivos del proyecto), y otro subagente distinto implementa el código y refactoriza. Tendrá un tope de **2+1 intentos** (al segundo fallo hace `git restore` para evitar código espagueti y reintenta limpio desde cero o apela el test).
3. **Juez con Jurado (en 1 sola llamada por fase) y Analista en Lenguaje Sencillo:** Al cierre de fase, un único despacho evalúa las 3 sillas del Jurado (*Fiscal del Contrato*, *Cazador de Trampas* y *Artesano de Código*) y emite sentencia. Si el implementador agota sus intentos y se frena, entra el **Analista** para traducir el bloqueo en lenguaje cotidiano con un ejemplo de la vida real y opciones simples para destrabarlo.

## En alcance / Fuera de alcance
- **En alcance:**
  - Evolución de los scripts deterministas del CLI de VSDD para ensamblar el contexto inteligente por trazabilidad, sellar/verificar hashes de tests y detectar trampas o código espagueti en 0 tokens.
  - Actualización de las guías operativas (`SKILL.md`, `references/apply.md`, `references/verify.md` y `references/tasks.md`) con la separación Autor de Test vs. Implementador, regla de intentos 2+1 con `git restore`, derecho de apelación, Tribunal (Juez + 3 Jurados en 1 llamada) y el rol del Analista ante bloqueos.
  - Suite de pruebas automatizadas del propio repositorio validando el nuevo comportamiento.
- **Fuera de alcance:**
  - Recortar o truncar el contexto por un número fijo de líneas que pueda mutilar tablas, requisitos o arquitectura.
  - Integrar motores pesados de *Mutation Testing* externos que requieran instalar dependencias en el proyecto del usuario.
  - Ejecutar el Jurado de IA en cada micro-tarea individual (en cada tarea actúa el Juez Determinista CLI a 0 tokens; el Jurado de IA actúa al cierre de fase/verificación).

## Listo cuando
- Al ejecutar el comando del harness/validador de VSDD sobre una tarea, el CLI ensambla el contexto completo e inteligente por trazabilidad (arquitectura global + requisitos y decisiones íntegras de la tarea), sella el hash del archivo de pruebas en Rojo y rechaza con código de error (Exit 1 en 0 tokens) cualquier modificación no autorizada al test, uso de `.skip`/aserciones vacías, *hardcoding* de literales del test o funciones espagueti.
- El flujo de `apply` y `verify` opera con roles separados (Autor de Test distinto del Implementador), aplica el límite 2+1 con limpieza automática (`git restore`) y ejecuta el veredicto del Juez y Jurado de 3 lentes en una sola llamada por cierre de fase.
- Ante un bloqueo tras agotar los intentos, el sistema detiene la ejecución con el repositorio limpio y presenta el diagnóstico del **Analista** en lenguaje cotidiano con un micro-ejemplo de la vida real y opciones numeradas de resolución.
