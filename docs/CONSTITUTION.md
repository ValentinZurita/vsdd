# CONSTITUTION.md — Principios de VSDD

> **Alcance:** documento del plano de desarrollo de VSDD; no se instala en los proyectos. En runtime, estos principios viajan condensados en `SKILL.md §1` y la operativa de cada fase vive en `references/`.

---

## 1. Soberanía del Usuario y Anti-Sobreingeniería

1. **El usuario es dueño del contenido:** todo artefacto se traza a lo acordado con él; la IA no inventa requisitos ni decide el negocio por su cuenta.
2. **Proporcionalidad (YAGNI):** el esfuerzo es proporcional al tamaño y riesgo de la idea.
3. **North Star:** proteger el dolor humano real y la intención de valor.
4. **Guiar antes que prohibir:** VSDD es una brújula, no una camisa de fuerza. El objetivo es orientar con sentido común y lenguaje normal de todos los días; jamás bloquear con dogmas ni agotar la mente con verborrea técnica.

---

## 2. Agnosticismo Tecnológico Absoluto

1. **Sin stack impuesto:** VSDD se adapta al repositorio; no asume ni exige tecnologías.
2. **Vocabulario nativo:** se usan los nombres reales del proyecto, sin inventar sinónimos.
3. **Persistencia portable:** aprovecha memoria externa si existe; si no, funciona con archivos locales.

---

## 3. La Ciencia del "QUÉ NO HACER"

1. **Non-Goals:** lo que se pospone a conciencia para proteger la entrega.
2. **Anti-Goals:** lo que el sistema nunca debe provocar.
3. **EARS defensivo:** todo comportamiento no deseado declara su salvaguarda observable.

---

## 4. Elicitación Adaptativa por Tiers

La profundidad de la entrevista se calibra al riesgo real: **Rápido (N ≤ 5)** sobre rieles existentes, **Estándar (N ≤ 10)** para una capacidad nueva y **Profundo (N ≤ 15)** para el núcleo crítico o cambios destructivos. N es un techo, no una cuota.

---

## 5. Rúbrica de los 5 Lentes del Conductor

Toda pregunta pasa por cinco filtros: dolor real, vocabulario nativo, experiencia observable, fronteras negativas y comprobabilidad.

---

## 6. Diseño para Testabilidad (DFT) y Oráculo Independiente

1. **Slicing vertical:** cada tarea entrega comportamiento comprobable de punta a punta.
2. **DFT:** lógica pura separada del I/O, dependencias inyectadas y costuras observables.
3. **Oráculo independiente:** los tests nacen de la spec y validan comportamiento, no implementación.
4. **Memoria con evidencia:** un aprendizaje sin ancla física verificable es hipótesis, no hecho.

---

## 7. Arquitectura de Doble Plano e Higiene de Memoria de Trabajo

1. **Compute where it computes, Reason where it reasons:** el **Plano de Cómputo Determinista** (CLI, scripts) valida, cuenta y opera Git en 0 tokens; el **Plano Agéntico** (LLM) razona, diseña y conversa. Ninguno hace el trabajo del otro.
2. **No cargues en la memoria de trabajo nada que no se vaya a usar en el turno actual:** **Carga Just-In-Time (JIT)** por fase y **Subagentes Efímeros** para exploración y auditoría.
