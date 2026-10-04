# CONSTITUTION.md — Principios de VSDD

> **Propósito:** Mantener VSDD coherente con la forma en que fue pensado. Estos son criterios internos de diseño, no reglas universales sobre Spec-Driven Development ni sobre cómo debe trabajar cualquier equipo.

1. **Soberanía del Usuario:** El usuario manda. VSDD ayuda a estructurar, cuestionar y proponer, pero no inventa requisitos de negocio ni decide el rumbo por su cuenta.
2. **Proporción antes que Ceremonia (YAGNI):** El esfuerzo debe ser proporcional al tamaño, riesgo y dolor real de la feature. Si un prompt basta, no hace falta fabricar proceso.
3. **Guiar antes que Prohibir:** VSDD acompaña y recomienda; no existe para bloquear el desarrollo con dogmas, burocracia o pasos que no aportan nada.
4. **Pensar también es Trabajo:** Las preguntas y la conversación no son ruido accidental. Sirven para sacar una idea de la cabeza, cuestionarla, descubrir lo que falta y moldearla antes de delegar la implementación.
5. **Agnosticismo Tecnológico:** VSDD no impone JavaScript, Node ni ningún stack. Descubre el repositorio y se adapta a sus herramientas y convenciones reales.
6. **Definir qué NO Hacer:** Non-Goals y Anti-Goals ponen límites claros al alcance y protegen lo que no debe romperse.
7. **Slicing Vertical:** El trabajo se divide en cortes pequeños de comportamiento observable de punta a punta, evitando scaffolding o capas sin valor por sí solas.
8. **Tests que Sirvan (DFT):** Diseñar para testabilidad y validar comportamiento real. Los tests deben aportar confianza, no existir solo para marcar una casilla.
9. **Memoria con Evidencia:** Un aprendizaje técnico sobre el repositorio solo se trata como hecho cuando tiene un ancla verificable. Sin evidencia, sigue siendo una hipótesis.
10. **Separación de Planos:** *Compute where it computes, Reason where it reasons*. El CLI y los scripts resuelven lo determinista; el agente se reserva para razonar, dialogar y diseñar.
11. **Higiene de Atención:** No cargues en la memoria de trabajo nada que no vaya a usarse en el turno actual. VSDD usa carga Just-In-Time y aislamiento de trabajo para mantener el contexto limpio.
