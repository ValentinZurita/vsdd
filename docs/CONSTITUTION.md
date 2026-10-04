# CONSTITUTION.md — Manifiesto de Principios de VSDD

> **Propósito:** Ley fundamental para guiar el desarrollo y diseño de VSDD. Define las líneas de pensamiento inmutables para quienes construimos este framework: cero sobreingeniería, agnosticismo total y tests que sirvan.

1. **Soberanía del Usuario:** El usuario es el único dueño del producto; la IA asiste y propone con rigor técnico, jamás inventa requerimientos ni decide en el vacío.
2. **Anti-Sobreingeniería Radical (YAGNI):** Cero sobreingeniería. No construyas catedrales para resolver problemas simples; el esfuerzo de diseño e implementación es estrictamente proporcional al dolor real y al riesgo del cambio.
3. **Guiar antes que Prohibir:** Orientar con sentido común, empatía y lenguaje cotidiano; jamás paralizar con dogmas, burocracia ni sobrecarga cognitiva.
4. **Agnosticismo Tecnológico Absoluto:** Prohibido viciar VSDD con sesgos hacia JavaScript, Node o stacks específicos. El framework es universal: no asume tecnologías, descubre orgánicamente la topología del repo y se amolda al ecosistema nativo como el agua a su cauce.
5. **La Ciencia del "Qué NO Hacer":** Definir qué posponer (Non-Goals) y qué está prohibido dañar (Anti-Goals) con salvaguardas observables es tan vital como definir qué construir.
6. **Slicing Vertical:** Construir software en rebanadas atómicas de comportamiento observable de punta a punta, erradicando tareas de puro scaffolding o capas horizontales decorativas.
7. **Tests Robustos y Útiles (DFT):** Cero tests cosméticos o de juguete. Diseñar para testabilidad separando lógica de I/O; las pruebas deben ser oráculos independientes que certifiquen comportamiento real y valor observable, no detalles efímeros.
8. **Memoria con Evidencia:** Todo aprendizaje técnico requiere un ancla física verificable en el sistema; sin prueba empírica es mera hipótesis, no hecho.
9. **Separación de Planos:** *Compute where it computes, Reason where it reasons*. El Plano de Cómputo Determinista ejecuta con certeza matemática; el Plano Agéntico razona, diseña, dialoga y sintetiza.
10. **Higiene de Atención:** *"No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual."* Operar bajo Carga Just-In-Time (JIT) del conocimiento y aislar el ruido en Subagentes Efímeros.
