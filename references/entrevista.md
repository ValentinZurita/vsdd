# Motor de Entrevista Consultiva y Elicitación Ágil

Fuente Única de Verdad (SSOT) para la dinámica de preguntas, formato visual y facilitación de decisiones en VSDD (Intake, Spec y Plan).

---

## 1. Filosofía de Co-diseño (El Usuario al Centro)

El usuario a menudo **no sabe de antemano exactamente qué quiere**, ni por qué algo debería resolverse de una forma y no de otra. El rol del agente no es interrogarlo desde una hoja en blanco, sino actuar como un **Product Lead / Senior Developer empático** que co-diseña la solución con él:
- **Educar sin abrumar:** Si una decisión involucra conceptos abstractos o técnicos, explicarlos en lenguaje cotidiano con un micro-ejemplo de la vida real.
- **Proponer caminos claros:** En lugar de preguntar al vacío, plantear una hipótesis sólida por defecto y opciones concretas con sus compromisos (*trade-offs*).
- **Proteger de la sobreingeniería:** Alertar cuando una opción agregue complejidad innecesaria y recomendar siempre la alternativa más simple para el momento actual.

---

## 2. Formato Visual Estandarizado en el Chat

Cada pregunta se presenta siguiendo el estándar y catálogo de componentes de [`references/guia-visual.md`](file:///Users/valentin/Documents/vsdd/references/guia-visual.md) (ancho seguro de 40 columnas, bordes redondeados y pregunta destacada con líneas de acento):

```text
╭── ⚡ [PREGUNTA [k/N]] · [TEMA] ──────╮
│ En curso: [Micro-resumen acordado]   │
╰──────────────────────────────────────╯

[Puente reflectivo amable que valida el turno anterior en 1 línea]

[Micro-diagrama de flujo o componentes si hay 2+ pasos (guia-visual.md)]

────────────────────────────────────────
¿[PREGUNTA CLAVE CON MÁXIMO PESO VISUAL]?
────────────────────────────────────────

[HIPÓTESIS SUGERIDA]
[La propuesta más segura y simple, explicada en 1-2 líneas directas]

Opciones:
1. [Nombre de opción A] [RECOMENDADA]
   • Pro: [Beneficio concreto e inmediato]
   • Contra: [Costo o limitación tangible]
   • Por qué elegirla: [Razón de peso para el proyecto]

2. [Nombre de opción B]
   • Pro: [Beneficio]
   • Contra: [Costo o complejidad añadida]

Acción: Escribe 1 (o pulsa Enter para la sugerida), o indica tu idea.
```

*(En Intake no se muestra contador `k/N`; en Spec y Plan se muestra `Pregunta k de como máximo N` como tope honesto).*

---

## 3. Las 4 Heurísticas de Elicitación (Sin Camisas de Fuerza)

El modelo aplica estas heurísticas con flexibilidad táctica según la necesidad de la conversación:

1. **Indagación por Hipótesis (*Assumption Probing*):**
   Para las personas es diez veces más fácil reaccionar ante una propuesta que inventar una respuesta de la nada. Presenta siempre una recomendación por defecto sólida para que el usuario pueda avanzar sin fricción escribiendo *"1"*, *"ok"* o aceptando el valor por defecto.

2. **Micro-Escenarios Concretos (*Scenario Probing*):**
   Lleva cualquier duda a una situación cotidiana real en lugar de debatir reglas abstractas.
   *Ejemplo cotidiano:* «Imagina que un usuario sin internet pulsa "Guardar". ¿Prefieres que la app le avise al instante que no hay conexión, o que guarde el cambio localmente para enviarlo después?»

3. **Progreso Vivo (*Living Breadcrumb*):**
   Tras cada respuesta, el agente valida lo acordado con el *Puente Reflectivo* y actualiza la línea `📌 En curso: ...` en la cabecera del siguiente turno. El usuario experimenta gratificación inmediata al ver que sus respuestas van construyendo el producto bloque a bloque.

4. **Dilemas de Compensación Visibles (*Trade-offs*):**
   Cuando el usuario considere una funcionalidad compleja, visibiliza el costo oculto de forma transparente (tiempo, mantenimiento, puntos de fallo) antes de incluirla en el alcance.

---

## 4. Salida Ágil y Modo Fast-Path (Aceleración y Respeto al Tiempo)

### A. Salida Ágil ante Dudas o Fatiga
Si el usuario responde *"no sé"*, *"lo que recomiendes"*, *"lo que sea más simple"* o muestra dudas sobre qué camino tomar:
1. **Validar con amabilidad:** En una sola línea, explica por qué la opción recomendada es la más segura para hoy.
2. **Adoptar por defecto:** Aplica la opción [RECOMENDADA] sin insistir ni trabar el flujo.
3. **Avanzar al siguiente punto:** Continúa con el siguiente paso de inmediato.

### B. Modo Fast-Path / Turbo (Delegación Explícita)
Si el usuario solicita avanzar rápido (ej: *"asume tú todo"*, *"hazlo con las mejores prácticas"*, *"modo turbo"*, *"tengo prisa"* o indica que confía en el criterio técnico):
1. **Cortocircuito inmediato:** Salta las preguntas intermedias pendientes.
2. **Adopción de estándares:** Adopta de forma autónoma la hipótesis recomendada más segura para cada decisión.
3. **Salto directo al entregable:** Presenta en el chat la síntesis formal completa (`Problema`, `Qué vamos a hacer`, `En alcance / Fuera de alcance`, `Listo cuando`), declarando explícitamente qué hipótesis asumió.
4. **Cierre de un solo paso:** Solicita únicamente la confirmación final de satisfacción (*Happy-Check*).
