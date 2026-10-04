# CONSTITUTION.md — Principios Fundamentales de VSDD

Esta Constitución define las leyes inmutables, la filosofía de producto y el contrato ético y técnico que rige el desarrollo y la operación de **VSDD (Valentin Spec-Driven Development)** en cualquier repositorio o agente de IA.

---

## 1. Soberanía del Usuario y Anti-Sobreingeniería

1. **El usuario es el dueño del contenido:** Cada línea de especificación, plan o tarea debe tener trazabilidad directa hacia las palabras del usuario, una opción acordada o un descarte aceptado. La IA nunca inventa requisitos ni asume decisiones de negocio por su cuenta.
2. **Cero burocracia innecesaria:** Si una funcionalidad es pequeña o puntual, no se le debe imponer el peso de un diseño enterprise. El esfuerzo de especificación debe ser estrictamente proporcional al tamaño y riesgo de la idea (*YAGNI: You Aren't Gonna Need It*).
3. **North Star:** Capturar el dolor humano real y la intención de valor. Todo artefacto técnico debe proteger esta esencia sin sobreingeniería.

---

## 2. Agnosticismo Tecnológico Absoluto

1. **Cero dependencias a stacks específicos:** VSDD jamás asume, exige ni busca tecnologías concretas (Prisma, React, Express, etc.). Cada proyecto es un ecosistema único (Node, Python, Go, Rust, scripts de shell, etc.).
2. **Exploración orgánica:** La IA investiga el proyecto observando de forma natural el `README.md`, nombres de carpetas y tipos existentes, únicamente para capturar los nombres reales de las entidades y roles, sin inventar sinónimos.
3. **Persistencia portable:** Si herramientas de memoria persistente (como Engram) existen en el entorno, se aprovechan; de lo contrario, el sistema opera de forma autosuficiente con archivos locales (`context.json`).

---

## 3. La Ciencia del "QUÉ NO HACER"

Definir qué **NO** se construirá es tan vital como definir qué sí:

1. **Límites Claros (Non-Goals):** Funcionalidades válidas que conscientemente se posponen para proteger el tiempo de entrega y evitar la inflación del alcance (*scope creep*).
2. **Anti-Objetivos e Invariantes Prohibidas (Anti-Goals):** Comportamientos nocivos, degradaciones de experiencia de usuario o estados corruptos que el sistema tiene terminantemente prohibido provocar.
3. **EARS Defensivo:** Todo criterio funcional de comportamiento no deseado debe declarar su salvaguarda observable obligatoria (`no debe <daño>; debe <acción protectora o mensaje visible>`).

---

## 4. Elicitación Adaptativa por Tiers

La entrevista es un diálogo consultivo diseñado para calibrar el esfuerzo según el contexto real del proyecto:

1. **Tier Rápido (N ≤ 5 preguntas) — Ajuste quirúrgico / Rieles existentes:**
   Modifica o extiende sobre patrones ya consolidados en el proyecto sin alterar el flujo general (solo lectura, flags, formateo, config o scripts aislados). Indaga camino feliz, mensaje de error directo y límites (qué NO hacer). Cero matrices o auditorías pesadas.

2. **Tier Estándar (N ≤ 10 preguntas) — Nueva capacidad dentro del paradigma:**
   Nueva unidad funcional (comando, endpoint, vista o flujo de varios pasos) que sigue las convenciones del repositorio. Incluye flujo completo, Estado Vacío (*Empty State*: sin datos o entrada vacía), validación de errores y ciclo de vida (cancelar/reintentar).

3. **Tier Profundo (N ≤ 15 preguntas) — Núcleo crítico o mutaciones destructivas:**
   Toca el núcleo compartido, altera contratos globales, introduce persistencia/concurrencia sin precedentes o ejecuta operaciones destructivas/irreversibles (borrado masivo, sobreescritura de datos, mutaciones destructivas en disco o Git). Blindaje de invariantes, consistencia y recuperación ante fallos.

4. **Desambiguación en Q1:** Si la idea es abierta o ambigua, el agente formula Q1 situándola en el sistema real antes de anunciar el tope $N$.
5. **Salida Ágil ante Fatiga y Modo Fast-Path:** Si el usuario responde *"lo que recomiendes"* o *"tengo prisa"*, el conductor adopta de inmediato las hipótesis más seguras por defecto y avanza sin fricción.

---

## 5. Rúbrica de los 5 Lentes del Conductor

Filtro mental previo a formular cada pregunta:

1. **Dolor real:** ¿Resuelve un problema de hoy y no una hipótesis futura?
2. **Vocabulario nativo:** ¿Usa los términos existentes en el repositorio?
3. **Experiencia observable:** ¿Sé qué ve el usuario cuando no hay datos o cuando algo sale mal?
4. **Fronteras negativas:** ¿Tengo claro qué posponer (Non-Goals) y qué prohibir (Anti-Goals)?
5. **Comprobabilidad:** ¿Una persona ajena al desarrollo puede verificar el "Listo cuando"?

---

## 6. Diseño para Testabilidad (DFT) y Oráculo Independiente

1. **Slicing Vertical Estricto:** Cada tarea en `tasks.md` es una rebanada vertical atómica de comportamiento de extremo a extremo comprobable con TDD. Prohibidas estimaciones ficticias de minutos y tareas horizontales de puro scaffolding.
2. **Diseño para Testabilidad (DFT):**
   - *Lógica pura vs I/O:* La lógica de negocio no toca disco, red ni base de datos directamente.
   - *Inyección de dependencias:* Prohibido instanciar dependencias duras internamente (`new Inside`); se reciben por parámetro.
   - *Costuras observables:* Salidas verificables sin espiar variables privadas ni sobre-mockear.
3. **Oráculo Independiente (Cero Test Basura):**
   - Tests derivados estrictamente de los Requisitos EARS y del Example Mapping de `spec.md`.
   - Prohibido el test espejo (recalcular la fórmula en el test).
   - Prohibido espiar las entrañas (cero llamadas a helpers internos o funciones privadas).
   - Prohibido mockear la memoria (mocks solo para frontera I/O externa).
   - Prohibido el test cosmético (`toBeDefined` sin validar valor de negocio).
4. **Memoria de Aprendizajes:** `resumen.md` captura en `## 4. Aprendizajes del repositorio` gotchas reales para que futuras funcionalidades no tropiecen con la misma piedra.

---

## 7. Arquitectura de Doble Plano e Higiene de Memoria de Trabajo

1. **Separación Estricta de Planos (*Compute where it computes, Reason where it reasons*):**
   - *Plano de Cómputo Determinista (Scripts / CLI / AST):* Es el oráculo y el músculo operativo. Resuelve validaciones de esquemas, linters, conteos de tareas, estado del DAG y operaciones de Git en 0 tokens, tiempo constante y determinismo absoluto.
   - *Plano Agéntico (LLM / Conductor):* Es el cerebro heurístico. Se reserva exclusivamente para el razonamiento semántico, diseño de arquitectura, elicitación socrática empática con el usuario y síntesis conceptual.
   - *Invariante Prohibida:* Queda terminantemente prohibido pedirle al LLM que simule validaciones sintácticas o gestione máquinas de estado en su memoria conversacional, así como forzar a un script a interpretar intenciones de negocio ambiguas.

2. **Carga Quirúrgica en Memoria de Trabajo (*Progressive Disclosure*):**
   - *"No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual."*
   - *Carga Just-In-Time (JIT):* La ventana de contexto activo solo debe recibir la referencia y plantilla de la fase en curso (`intake`, `spec`, `plan`, `tasks`, `apply` o `verify`). Queda prohibido inyectar referencias de fases futuras o pasadas.
   - *Aislamiento en Subagentes Efímeros:* Toda lectura masiva de código (exploración) o auditoría adversarial se delega a subagentes efímeros cuyo contexto se destruye al concluir su tarea, retornando al hilo principal un memo destilado ($\le 12$ líneas). El hilo del usuario se mantiene puro, ágil y libre de fatiga visual o compactación prematura.
