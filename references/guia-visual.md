# Guía de Estilo Visual y Componentes TUI (VSDD)

Fuente Única de Verdad (SSOT) para la presentación gráfica, diagramas, tablas y maquetas en terminal dentro de VSDD. Diseñada para garantizar máxima legibilidad, estética moderna y cero roturas de pantalla en cualquier cliente o agente (Cursor, Claude Code, Antigravity, Codex).

---

## 1. Principios de Diseño y Ritmo Visual

1. **Presupuesto Fijo de 40 Columnas (Inmunidad al Word-Wrap):**
   - Todo componente enmarcado mide estrictamente **40 caracteres de ancho**.
   - Se apila **100% de forma vertical** (prohibido colocar cajas una al lado de la otra en horizontal).
   - Cabe holgadamente en barras laterales estrechas de IDEs, splits de tmux y terminales pequeñas sin que la pared derecha salte de línea jamás.
2. **Principio de No Abuso (Espacio en Blanco y Respiración):**
   - **Llevan caja redondeada (`╭─╮`, `╰─╯`):** Únicamente cabeceras de sesión, diagramas de flujo de 2+ pasos, maquetas de pantalla y tablas.
   - **Van en texto limpio y aireado:** El puente reflectivo, las opciones de decisión (`1.`, `2.`), los pros y contras (`• Pro:`, `• Contra:`) y las explicaciones. Enjaular todo en cajas satura la vista y destruye la jerarquía.
3. **Badges Técnicos vs. Cero Emojis Distractores:**
   - Prohibidos los emojis amarillos, caritas o fuegos que desalinean columnas o restan seriedad.
   - Usar badges de ingeniería sobrios entre corchetes: `[HIPÓTESIS SUGERIDA]`, `[RECOMENDADA]`, `[PREGUNTA 2/5]`, `[✓ OK]`, `[✕ FAIL]`, `[! WARN]`.
4. **Soberanía de Copiado (Copy-Paste Clean):**
   - Prohibido encerrar comandos ejecutables o código a copiar dentro de cajas con bordes laterales (`│`), ya que al copiarlos con el ratón se capturan los caracteres de borde.
   - Todo comando sugerido va en su propia línea limpia o bloque de código Markdown (`` `comando` `` o ````bash ````) para que un doble clic lo copie intacto.

---

## 2. Catálogo de Componentes

### Componente 1: Cabecera de Sesión (Session Header)
Enmarca el contexto, número de pregunta y la línea viva de acuerdos.

```text
╭── [PREGUNTA 2/5] · TEMA EN MAYÚSCULAS ─╮
│ En curso: Resumen de acuerdos previos  │
╰────────────────────────────────────────╯
```

### Componente 2: Diagrama de Flujo (Flowchart de Nodos Conectados)
Se utiliza cuando una explicación o pregunta involucra un proceso de 2 o más pasos. Cada paso es un nodo redondeado de 40 columnas conectado verticalmente.

```text
╭─ 1. ENTRADA ─────────────────────────╮
│  vsdd import archivo.csv             │
╰──────────────────┬───────────────────╯
                   │
                   ▼
╭─ 2. VALIDADOR DE FORMATO ────────────╮
│  ├─ [✓ OK]   Procesa filas           │
│  ╰─ [✕ FAIL] Detiene en fila exacta  │
╰──────────────────┬───────────────────╯
                   │
                   ▼
╭─ 3. SALIDA FINAL ────────────────────╮
│  Tabla consolidada en consola        │
╰──────────────────────────────────────╯
```

### Componente 3: Pregunta Clave Destacada (Hero Question)
La pregunta central del turno debe tener el **máximo peso visual** para que no se pierda entre el diagrama y las opciones. Se enmarca con líneas simples de acento:

```text
────────────────────────────────────────
¿CÓMO DEBE REACCIONAR EL SISTEMA ANTE X?
────────────────────────────────────────
```

### Componente 4: Tablas TUI Redondeadas (Data & Decision Tables)
Para comparativas de trade-offs (A vs B), contratos de prueba (*Example Mapping*) o matrices de módulos.

* Caracteres de ensamble:
  * Superior: `╭`, `┬`, `╮`
  * Intermedio: `├`, `┼`, `┤`
  * Inferior: `╰`, `┴`, `╯`
  * Divisores: `─`, `│`

```text
╭──────────────────┬───────────┬──────────╮
│ CRITERIO         │ OPCIÓN A  │ OPCIÓN B │
├──────────────────┼───────────┼──────────┤
│ Rendimiento      │ < 1ms     │ ~50ms    │
│ Dependencias     │ Ninguna   │ Externa  │
│ Complejidad      │ [✓ Baja]  │ [! Media]│
╰──────────────────┴───────────┴──────────╯
```

### Componente 5: Tríada de Estados del Producto (Empty, Happy, Error)
Para modelar qué ve el usuario en pantalla o consola según el estado del sistema:

```text
ESTADO VACÍO (Sin datos):
╭──────────────────────────────────────╮
│ [VACÍO] HISTORIAL DE REPORTES        │
│                                      │
│ No se encontraron reportes previos.  │
│ [▸] Ejecuta: vsdd reportes --nuevo   │
╰──────────────────────────────────────╯

CAMINO FELIZ (Con datos procesados):
╭──────────────────────────────────────╮
│ [OK] REPORTES GENERADOS              │
│                                      │
│ [1] ventas_enero.csv   (1,200 filas) │
│ [2] balance_q1.csv     (  450 filas) │
╰──────────────────────────────────────╯
```

### Componente 6: Opciones de Decisión y Acción (Unboxed & Airy)
Las opciones de respuesta no llevan caja. Se presentan como texto limpio con viñetas indentadas para facilitar una lectura descansada:

```text
[HIPÓTESIS SUGERIDA]
Breve explicación en 1 o 2 líneas de la opción recomendada
más segura por defecto.

Opciones:
1. Nombre de la alternativa [RECOMENDADA]
   • Pro: Beneficio tangible e inmediato.
   • Contra: Compromiso o limitación real.
   • Por qué elegirla: Razón técnica de peso para el proyecto.

2. Nombre de alternativa B
   • Pro: Beneficio.
   • Contra: Mayor complejidad o mantenimiento.

Acción: Escribe 1 (o pulsa Enter para la sugerida), o indica tu idea.
```

### Componente 7: Placa Ejecutiva de Decisión de Spec (`spec.md`)
Formato estandarizado de alta jerarquía para revisar y aprobar la especificación funcional sin volcar el archivo crudo de disco:

```text
╭── [RECAP] ESPECIFICACIÓN FUNCIONAL ──╮
│ docs/sdd/vsdd/<id>/spec.md           │
╰──────────────────────────────────────╯

🎯 OBJETIVO & VALOR
• Problema: Qué dolor concreto del usuario resolvemos hoy.
• Solución: Comportamiento central acordado.

📋 REQUISITOS CLAVE (EARS)
• Ubicuo: El sistema SIEMPRE <invariante>.
• Evento: CUANDO <evento>, el sistema <reacción>.
• Estado: MIENTRAS <estado>, el sistema <comportamiento>.
• Error: SI <fallo>, ENTONCES <mensaje amigable y salida limpia>.

🧪 CASOS OBSERVABLES (EXAMPLE MAPPING)
╭────────────────┬──────────┬──────────╮
│ ESCENARIO      │ ENTRADA  │ SALIDA   │
├────────────────┼──────────┼──────────┤
│ Camino Feliz   │ flag -v  │ Detalle  │
│ Estado Vacío   │ sin logs │ [EMPTY]  │
│ Error Formato  │ inv.json │ [✕ FAIL] │
╰────────────────┴──────────┴──────────╯

🚫 FRONTERAS NEGATIVAS (QUÉ NO HACER)
• Fuera de alcance (Non-Goals): Funcionalidad que posponemos.
• Prohibido (Anti-Goals): [✕] Estados corruptos o efectos colaterales.

🏁 LISTO CUANDO
[✓] 1. Salida observable en pantalla o comando.
[✓] 2. Código de salida exacto comprobado.

────────────────────────────────────────
¿ESTÁS SATISFECHO CON ESTA ESPECIFICACIÓN?
────────────────────────────────────────
(Sí para avanzar a Plan / No para ajustar)
```

### Componente 8: Placa Ejecutiva de Plan Técnico (`plan.md`)
Formato estructurado con criterio arquitectónico para validar decisiones y árbol de cambios antes de pasar a tareas:

```text
╭── [RECAP] PLAN TÉCNICO ──────────────╮
│ docs/sdd/vsdd/<id>/plan.md           │
╰──────────────────────────────────────╯

🏛️ ALINEACIÓN & PATRÓN DE DISEÑO
• Estrategia: Cómo encaja en las convenciones del repositorio.
• Principio DFT: Lógica pura aislada de I/O y dependencias inyectadas.

📐 DECISIONES TÉCNICAS (DT)
• DT-01: <Decisión elegida>
  - Por qué: Razón de peso frente a la alternativa descartada.
  - Descartada: <Alternativa evaluada y rechazada>.

🌳 ÁRBOL DE CAMBIOS DETERMINISTA
+ [CREAR]     src/modulo/nuevo_servicio.ts
~ [MODIFICAR] src/cli/comandos.ts
- [ELIMINAR]  src/legacy/obsoleto.ts

🛡️ ESTRATEGIA DE TESTS & ORÁCULO INDEPENDIENTE
• Unitarios puros: Cobertura exhaustiva de EARS sin tocar I/O.
• Frontera observable: Validación de comandos o salidas reales.

🚀 VERIFICACIÓN GOLDEN PATH
Paso 1: Ejecutar comando con flags estándar.
Paso 2: Confirmar salida esperada según el Example Mapping.

────────────────────────────────────────
¿ESTÁS SATISFECHO CON ESTE PLAN TÉCNICO?
────────────────────────────────────────
(Sí para avanzar a Tareas / No para ajustar)
```

---

## 3. Matriz de Aplicación por Fase

| Fase | Dónde se aplica | Componente a utilizar |
| :--- | :--- | :--- |
| **Intake** | Aterrizaje de idea y disyuntivas de alcance | Cabecera + Diagrama de Flujo (viaje del usuario) + Pregunta con acento |
| **Spec** | Requisitos EARS, Example Mapping y Cierre | Tablas TUI + Tríada de Estados + **Componente 7 (Placa de Spec)** |
| **Plan** | Decisiones Técnicas (DT), Árbol y Cierre | Diagramas de Componentes + **Componente 8 (Placa de Plan)** |
| **Verify** | Golden Path Walkthrough y Cierre | Secuencia observable paso a paso en terminal |
