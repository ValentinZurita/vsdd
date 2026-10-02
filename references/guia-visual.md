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
│ 📭 HISTORIAL DE REPORTES             │
│                                      │
│ No se encontraron reportes previos.  │
│ [▸] Ejecuta: vsdd reportes --nuevo   │
╰──────────────────────────────────────╯

CAMINO FELIZ (Con datos procesados):
╭──────────────────────────────────────╮
│ 📄 REPORTES GENERADOS                │
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

---

## 3. Matriz de Aplicación por Fase

| Fase | Dónde se aplica | Componente a utilizar |
| :--- | :--- | :--- |
| **Intake** | Aterrizaje de idea y disyuntivas de alcance | Cabecera + Diagrama de Flujo (viaje del usuario) + Pregunta con acento |
| **Spec** | Requisitos EARS y Example Mapping | Tablas TUI de pruebas + Tríada de Estados (Empty/Happy/Error) |
| **Plan** | Decisiones Técnicas (DT) y Arquitectura | Diagramas de Componentes + Tabla de Módulos (`+`, `~`, `-`) |
| **Verify** | Golden Path Walkthrough y Cierre | Secuencia observable paso a paso en terminal |
