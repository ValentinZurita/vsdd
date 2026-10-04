# CONSTITUTION.md — Manifiesto de Principios de VSDD

> **Propósito:** Ley fundamental para guiar el desarrollo de VSDD. Define las líneas de pensamiento inmutables para el diseño del framework: cero sobreingeniería, agnosticismo total y tests que sirvan.

1. **Soberanía del Usuario:** VSDD pone siempre al usuario al mando; el framework asiste, estructura y propone con rigor técnico, pero jamás inventa requerimientos de negocio ni decide el rumbo a espaldas del usuario.
2. **Anti-Sobreingeniería Radical (YAGNI):** VSDD combate la sobreingeniería; calibra el esfuerzo de análisis, diseño y tareas para que sea estrictamente proporcional al tamaño, riesgo y dolor real de la funcionalidad.
3. **Guiar antes que Prohibir:** VSDD es una brújula orientadora, no una camisa de fuerza burocrática; acompaña con lenguaje cotidiano y sentido común, sin bloquear el desarrollo con dogmas ni sobrecarga cognitiva.
4. **Agnosticismo Tecnológico Absoluto:** Prohibido viciar VSDD con sesgos hacia JavaScript, Node o stacks específicos. VSDD es universal: no asume tecnologías, descubre orgánicamente el repositorio y se amolda a su herramental nativo como el agua a su cauce.
5. **La Ciencia del "Qué NO Hacer":** VSDD exige definir qué posponer (Non-Goals) y qué está prohibido dañar (Anti-Goals) con salvaguardas observables, blindando la entrega contra la inflación del alcance.
6. **Slicing Vertical:** VSDD estructura el desarrollo en rebanadas atómicas de comportamiento observable de punta a punta, erradicando tareas de puro scaffolding o capas horizontales decorativas.
7. **Tests Robustos y Útiles (DFT):** VSDD exige diseño para testabilidad separando lógica de I/O; promueve pruebas que actúen como oráculos independientes que certifiquen valor y comportamiento real, desterrando tests cosméticos o de juguete.
8. **Memoria con Evidencia:** VSDD exige que todo aprendizaje transversal o lección técnica cuente con un ancla física verificable en el sistema; sin prueba empírica en el repo es mera hipótesis, no hecho.
9. **Separación de Planos:** VSDD se construye bajo la Arquitectura de Doble Plano (*Compute where it computes, Reason where it reasons*). Su Plano de Cómputo Determinista (CLI, scripts) resuelve cálculos y validaciones en 0 tokens; su Plano Agéntico se reserva para razonar, dialogar y diseñar.
10. **Higiene de Atención:** VSDD protege la memoria de trabajo del usuario bajo la ley *"No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual"*. El framework opera mediante Carga Just-In-Time (JIT) de fase y aísla el ruido en Subagentes Efímeros.
