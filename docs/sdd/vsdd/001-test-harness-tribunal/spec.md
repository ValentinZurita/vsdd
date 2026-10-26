# Spec 001 Test Harness Antifraude, Contexto Inteligente y Tribunal de Calidad

Estado: listo-para-plan

## Contexto y objetivos

Hoy en VSDD el mismo subagente implementador escribe tanto los tests como el código de producción en el mismo turno, provocando un conflicto de interés donde la IA tiende a debilitar tests o meter valores fijos para pasar. Al mismo tiempo, cuando se bloquea una prueba sin guardarraíles de calidad, el problema se traslada al código en forma de espagueti y parches acumulativos que saturan la memoria de trabajo y queman tokens. Esta funcionalidad introduce un sistema de arnés de pruebas (Test Harness) con separación de roles, contexto compartido e inteligente por trazabilidad, candados criptográficos deterministas y un tribunal de calidad con analista didáctico que previene trampas a costo mínimo de tokens.

### Usuarios y actores
- Desarrollador en terminal: puede iniciar tareas, invocar el harness de VSDD, revisar veredictos del tribunal y recibir diagnósticos claros ante bloqueos. No puede ser forzado a descifrar volcados masivos de terminal o errores crudos ante fallas de la IA.
- Subagente Autor de Tests: puede redactar y preparar arneses de prueba y aserciones sobre contratos observables públicos. No puede editar archivos de código de producción.
- Subagente Implementador: puede diseñar e implementar código en los archivos autorizados con libertad arquitectónica y solicitar apelaciones justificadas. No puede modificar archivos de prueba sellados ni quitar candados criptográficos.
- Juez Determinista CLI: puede extraer micro-contextos, sellar hashes SHA-256, verificar ejecuciones Red/Green y analizar el diff en 0 tokens. No puede alucinar reglas no declaradas ni gastar tokens de modelos de lenguaje.
- Juez Cognitivo de Apelaciones: puede evaluar semánticamente una apelación contrastando el test frente a los criterios EARS de `spec.md`. No puede alterar la especificación de negocio por su cuenta.
- Tribunal y Jurado de Fase: puede evaluar en una sola llamada de cierre de fase la fidelidad del contrato, ausencia de trampas y artesanía de código. No puede ralentizar micro-tareas individuales.
- Analista de Bloqueos: puede intervenir únicamente tras agotar reintentos (2+1) para traducir el conflicto en lenguaje cotidiano con analogías del mundo real y opciones de salida. No puede intervenir en el camino feliz de ejecución.

### Historias de usuario
- Como desarrollador en terminal, quiero que los archivos de prueba queden sellados criptográficamente para que la IA no pueda ablandar los tests cuando su código falle.
- Como desarrollador en terminal, quiero que el implementador reciba un contexto inteligente con la visión global, pseudocódigos y reglas junto a su tarea específica para que no trabaje a ciegas ni desperdicie tokens en tareas ajenas.
- Como desarrollador en terminal, quiero que el CLI bloquee en 0 tokens funciones gigantes nuevas, anidamientos excesivos y datos hardcodeados para evitar que la IA produzca código espagueti solo para pasar una prueba.
- Como desarrollador en terminal, quiero que ante un bloqueo persistente un analista me explique en lenguaje sencillo qué pasó para tomar una decisión informada en 15 segundos con el repositorio limpio.

## Requisitos funcionales

### RF-01 Ensamblar contexto compartido y corte específico de tarea
- Cuando el CLI recibe la solicitud de briefing para una tarea (`vsdd harness brief <task-id>`), el sistema debe ensamblar un paquete estructurado que combine el Contexto Compartido Global con el Corte Específico de la Tarea.
- El Contexto Compartido Global debe incluir siempre el objetivo de negocio de `idea.md`, las decisiones técnicas de arquitectura (`DT-xx`), los pseudocódigos y diagramas del plan, las reglas de ejecución (TDD y comandos de prueba del proyecto), las fronteras negativas (Non-Goals y Anti-Goals) y la memoria del repositorio.
- El Corte Específico de la Tarea debe extraer de forma íntegra sin cortes de líneas todos los requisitos funcionales (`RF-xx`) citados en el campo `Cubre:` con sus tablas de Example Mapping, más el estado observable de las tareas previas ya completadas.
- Si la tarea solicitada no existe en `tasks.md`, el sistema no debe fallar silenciosamente; debe emitir un mensaje de error claro en stderr indicando los identificadores de tarea válidos y salir con código 1.
- **Ejemplo concreto:**
  * Entrada: `vsdd harness brief TASK-01` → Resultado observable: Emite en stdout el bloque de contexto compartido global (arquitectura, pseudocódigo, Anti-Goals) concatenado con el bloque íntegro de RF-01 y la especificación de TASK-01, omitiendo tareas posteriores.

### RF-02 Sellar archivos de pruebas en Rojo y verificar candado criptográfico
- Cuando el Autor de Tests finaliza la redacción del arnés, el comando de sellado (`vsdd harness seal <ruta-test>`) debe ejecutar las pruebas para comprobar que fallan (código de salida distinto de cero). Si las pruebas pasan en verde antes de implementar el código de producción, el sistema no debe sellar el archivo; debe rechazar el sellado con código 1 indicando ausencia de estado Rojo.
- Si las pruebas fallan correctamente en Rojo y no contienen modificadores de omisión (`.skip`, `xit`, `it.todo`, `pytest.mark.skip`) ni aserciones superficiales vacías (`toBeDefined`, `toBeTruthy`, `expect(true).toBe(true)`), el sistema debe calcular el hash SHA-256 del archivo y registrarlo en `context.json`.
- Durante la fase de implementación y verificación (`vsdd harness verify <task-id>`), el sistema debe comparar el hash SHA-256 actual de los archivos de prueba contra el hash sellado previamente.
- Si el hash SHA-256 de algún archivo de prueba sellado difiere del original o si se detecta alteración no autorizada, el sistema no debe permitir el avance; debe rechazar la verificación con código 1 y reportar la violación de integridad del test.
- **Ejemplo concreto:**
  * Entrada: `vsdd harness seal tests/harness.test.js` con tests que fallan en Rojo → Resultado observable: Verifica fallo en Rojo, calcula SHA-256, guarda el sello en `context.json` y confirma en stdout `✔ Archivo de pruebas sellado en Rojo: <hash>`.

### RF-03 Analizar diff de código y bloquear trampas o espagueti
- Cuando se ejecuta la verificación de una tarea en verde (`vsdd harness verify <task-id>`), el sistema debe inspeccionar deterministamente en 0 tokens las líneas añadidas o modificadas en los archivos de producción autorizados en `plan.md`.
- Si el código de producción contiene cadenas literales o números idénticos a los valores de prueba específicos de más de 8 caracteres declarados en el Example Mapping de la especificación o en los tests, el sistema debe alertar sobre hardcoding y rechazar con código 1.
- Si una función nueva introducida en el diff excede 50 líneas de código o contiene más de 3 niveles de anidamiento de control de flujo (`if`, `for`, `while`, `try-catch`), el sistema debe rechazar la verificación con código 1 indicando la función y línea específica que viola el estándar anti-espagueti.
- Si el diff introduce bloques `catch` vacíos sin manejo o supresores silenciosos de compilador (`@ts-ignore`, `any`, `# type: ignore`), el sistema no debe ignorarlos; debe emitir código 1 y exigir manejo explícito de errores.
- **Ejemplo concreto:**
  * Entrada: Código con función nueva de 62 líneas y 4 `if` anidados → Resultado observable: `✖ Fallo de calidad: Función nueva 'procesarDatos' excede límite de 50 líneas (62 líneas) y supera 3 niveles de anidamiento. Modularice en funciones auxiliares.`

### RF-04 Arbitrar apelaciones entre test e implementación
- Cuando el Implementador detecta que un test sellado contiene un error de tipado o contradice la especificación funcional, el sistema debe permitir registrar una apelación formal (`vsdd harness appeal --task <task-id> --reason "<motivo>"`), almacenando el reclamo de forma estructurada en `context.json`.
- Al recibirse una apelación, el Juez Cognitivo (subagente de un turno con modelo analítico) evalúa la discrepancia contrastando el test contra los criterios EARS de `spec.md`.
- Si la apelación es declarada fundada por el Juez al comprobar que el test contradice directamente un criterio EARS de `spec.md`, el sistema debe autorizar la apertura temporal del candado y delegar la corrección exclusivamente al Autor de Tests.
- Si la apelación es desestimada por el Juez al comprobar que el test cumple fielmente con la especificación, el sistema debe mantener el candado intacto, consumir un intento del contador del implementador y reanudar la implementación.
- Si la especificación resulta ambigua o contradictoria frente a la apelación, el sistema no debe resolver a ciegas; debe detener la ejecución y escalar la decisión al usuario mediante la ficha del Analista.
- **Ejemplo concreto:**
  * Entrada: `vsdd harness appeal --task TASK-02 --reason "Test espera string pero RF-02 exige objeto JSON"` → Resultado observable: Juez valida contra spec.md, confirma discrepancia y reporta `✔ Apelación aceptada: Test contradice RF-02. Candado abierto para corrección por Autor de Tests.`

### RF-05 Dictar veredicto del tribunal y emitir diagnóstico didáctico
- Cuando se completa una fase de implementación (`apply`) o la verificación final (`verify`), el sistema debe invocar en una sola llamada de subagente al Tribunal de Calidad evaluando las tres actas: Fiscal del Contrato (cobertura vs spec.md), Cazador de Trampas (detección de overfitting) y Artesano de Código (adherencia a arquitectura, reuso y limpieza).
- Si el Implementador falla en el segundo intento consecutivo de una tarea, el sistema debe ejecutar automáticamente `git restore` sobre los archivos de código de dicha tarea para que el tercer intento (2+1) inicie desde un árbol limpio.
- Si tras el tercer intento la tarea continúa sin pasar las pruebas o sin superar el análisis estructural, el sistema debe ejecutar nuevamente la reversión limpia de los archivos de la tarea y detener la ejecución.
- Tras la detención, el sistema debe emitir la ficha didáctica del Analista con una extensión máxima de 12 líneas conteniendo una analogía concreta de la vida real, confirmación de estado limpio en git y tres opciones numeradas de destrabe (ajustar regla, instruir a la IA o escalar modelo).
- **Ejemplo concreto:**
  * Entrada: Implementador agota 3 intentos fallidos en TASK-03 → Resultado observable: `git restore` ejecutado sobre archivos de la tarea, terminal muestra ficha del Analista: `🔎 Analista VSDD: Pausa en TASK-03 ... Es como si en un banco el cajero ... Opciones: 1. Ajustar regla, 2. Instruir, 3. Escalar modelo`.

## Casos límite
- Si el repositorio no utiliza Git o no tiene commits iniciales, el sistema no debe fallar con excepción no controlada; debe advertir que el sellado criptográfico operará en modo archivo local y que la reversión automática de intentos no estará disponible.
- Si un archivo de prueba ya existía antes de la tarea, el candado criptográfico sella el archivo completo en su estado Rojo, impidiendo modificar tanto los tests antiguos como los nuevos hasta completar la tarea.
- Si la suite de pruebas del proyecto tarda más de un umbral configurable o entra en bucle infinito durante la verificación en rojo o verde, el runner del harness debe aplicar un timeout estricto de 30 segundos y reportar timeout como fallo no superado.
- Si durante un intento fallido el Implementador genera archivos nuevos no rastreados (untracked) dentro de la ruta de la tarea, el mecanismo de limpieza debe eliminarlos limpiamente sin tocar archivos no rastreados del usuario fuera del árbol de la tarea.
- Si el usuario interrumpe la ejecución mediante Ctrl+C o señal de cancelación, el sistema debe revertir únicamente los cambios inconclusos de la tarea en curso preservando las tareas ya commiteadas.

## Requisitos no funcionales
- Rendimiento y economía de tokens: las operaciones de briefing, sellado SHA-256 y escaneo de diffs en `vsdd harness` deben resolverse en menos de 100 milisegundos en el CLI y con un consumo de cero tokens de LLM.
- Ergonomía visual: la salida en terminal de todas las operaciones del harness y reportes del tribunal debe respetar un ancho seguro de 80 columnas, iconografía limpia (`✔`, `✖`, `●`) y cero volcados masivos de código en el chat principal.
- Tono didáctico: toda explicación emitida por el Analista debe utilizar español neutro, trato de tú y una metáfora cotidiana comprensible sin conocimientos previos de compiladores o ASTs.
- Agnostismo de lenguaje: las reglas del arnés y validaciones deterministas deben operar sobre los archivos declarados en `plan.md` con independencia del lenguaje de programación o estructura de carpetas del proyecto.

## Límites y exclusiones (Non-Goals y Anti-Goals)

### Fuera de alcance (Non-Goals)
- No se incluirá la instalación de librerías externas de mutation testing (ej. Stryker o Mutmut) dentro del proyecto destino del usuario.
- No se ejecutarán llamadas a modelos de lenguaje o jurados en cada micro-tarea individual; el Jurado de IA se reserva exclusivamente para cierres de fase y verificación final.
- No se impondrá un formateador o linter de código externo al proyecto (Prettier, ESLint); el análisis de calidad se limita a complejidad estructural, tamaño y detección de trampas sintácticas.

### Anti-objetivos e invariantes prohibidas (Anti-Goals)
- Prohibido que el Implementador pueda desbloquear, eludir o modificar archivos de pruebas sellados sin autorización explícita del Juez mediante una apelación ganada.
- Prohibido acumular más de dos intentos consecutivos sobre código sucio; al segundo fallo consecutivo es obligatorio el restablecimiento limpio (`git restore`) antes de un tercer intento desde cero.
- Prohibido que las operaciones de reversión (`git restore`) modifiquen, descarten o eliminen archivos o cambios de trabajo ajenos a la tarea activa autorizada en `plan.md`.
- Prohibido alterar o romper la compatibilidad hacia atrás de los comandos existentes `vsdd status`, `vsdd validate` y `vsdd oracle`.

## Criterios de finalización
- Se puede comprobar que: Al ejecutar `vsdd harness brief <task-id>`, el CLI emite el paquete con el Contexto Compartido Global (arquitectura, pseudocódigos, Anti-Goals) y el corte específico de la tarea sin filtrar ni truncar líneas esenciales.
- Se puede comprobar que: Al ejecutar `vsdd harness seal <test-file>` y posteriormente modificar el test o insertar `.skip`, la invocación de `vsdd harness verify` rechaza la verificación con código 1 y bloquea el avance.
- Se puede comprobar que: Al agotar los 2+1 intentos de implementación en una tarea que falla, el sistema ejecuta `git restore` sobre el código productivo de la tarea y presenta la ficha didáctica del Analista con una analogía de la vida real y 3 opciones de resolución.

## Decisiones y alternativas descartadas
- **Alternativa descartada:** Ejecutar un subagente Jurado de IA en cada micro-tarea individual.
  • Por qué se descarta: Multiplicaría por 4 el costo en tokens y aumentaría la latencia de cada micro-paso de forma inaceptable.
- **Alternativa descartada:** Sobrecargar `vsdd oracle` y `vsdd validate` con banderas para el harness.
  • Por qué se descarta: Degrada la cohesión de herramientas con propósitos definidos (generación de stubs y linter Markdown) y genera confusión en la interfaz de línea de comandos.

## Diagramas
Ninguno.

## Dudas abiertas
Ninguna.
