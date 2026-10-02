<div align="center">

# ⚡ VSDD
### Valentin-Driven Development

**El conductor interactivo de Spec-Driven Development para agentes de IA.**  
*Tú dictas la arquitectura y los requisitos; la IA nunca asume ni inventa por su cuenta.*

[![Version](https://img.shields.io/badge/version-0.43.0-blue.svg)](https://github.com/ValentinZurita/vsdd)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Compatible Agents](https://img.shields.io/badge/agents-Claude%20Code%20%7C%20Cursor%20%7C%20Codex%20%7C%20Antigravity-purple.svg)]()

```text
╭── ⚡ VSDD  ·  INSTALACIÓN GLOBAL ─────╮
│ Editores detectados:                  │
│   ✔ Cursor (.agents/skills/vsdd)      │
│   ✔ Claude Code (.claude/skills/vsdd) │
│   ✔ Antigravity (.gemini/config/...)  │
│                                       │
│ Todo listo. Para empezar escribe:     │
│   vsdd intake                         │
╰───────────────────────────────────────╯
```

</div>

---

## 🚀 Instalación en 5 segundos

### En macOS y Linux (Terminal / Bash):

```bash
# Asistente interactivo directo desde GitHub
curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash

# O si ya tienes el repositorio clonado:
./install.sh
```

### En Windows (PowerShell / Windows Terminal):

```powershell
# Asistente interactivo directo desde GitHub
irm https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.ps1 | iex

# O si ya tienes el repositorio clonado:
.\install.ps1
```

> *El asistente detectará automáticamente tus editores. Presiona **`[Enter]`** en cada pregunta para aceptar las opciones recomendadas.*

---

## ⚡ Los Dos Comandos del Día a Día

Una vez instalado, interactúa con tu agente en **Cursor**, **Claude Code**, **Codex** o **Google Antigravity** usando solo dos comandos:

### 1. Iniciar una nueva funcionalidad
```bash
vsdd intake
```
Abre la fase de exploración e ideación. El agente investiga el repositorio de forma orgánica, analiza entidades reales y te entrevista para delimitar el dolor y los casos de uso antes de escribir código.

### 2. Retomar o consultar el panel
```bash
vsdd
```
Muestra el **Hub de Funcionalidades Pendientes**, el progreso de tareas, el centinela de salud del repositorio (`Drift Sentinel` 🟢/🟡/🔴) y te permite continuar cualquier borrador o fase activa en un solo paso.

---

## 🔄 Actualización y Versión

Mantén tu instalación de VSDD al día directamente desde tu terminal o chat:

```bash
# Actualizar a la última versión disponible en GitHub
vsdd update

# Consultar la versión instalada
vsdd --version
# Output: ⚡ VSDD v0.43.0
```

* **Detección Automática de Actualizaciones:** Cada vez que ejecutas `vsdd`, el sistema consulta en segundo plano de forma no bloqueante si hay una nueva versión y te avisa amablemente en el menú.
* **Protección contra Desincronización (Dual Mismatch):** Si un proyecto tiene una copia local de la skill desactualizada respecto a tu instalación global, VSDD te avisa en 40 columnas para evitar que tu agente use reglas viejas.

---

## 💬 Motor de Entrevista y Elicitación Ágil

VSDD no te hace preguntas al azar ni asume lo que quieres. Utiliza un **Design System de Terminal de 40 columnas** con rigor metodológico:

```text
╭── [PREGUNTA [1/5]] ──────────────────╮
│ 📌 En curso: Tipo de autenticación   │
│ Autenticación de usuarios            │
╰──────────────────────────────────────╯

Imagina que un usuario entra por primera vez a la app...
¿Cómo debería identificarse para acceder?

[HIPÓTESIS SUGERIDA]
Opción 1: Email y contraseña clásico.

[1] Email y contraseña (Recomendada)
    • Pro: Fácil de implementar y sin dependencias externas.
    • Contra: Requiere gestionar recuperación de contraseñas.
    • Por qué elegirla: Ideal para validar el MVP rápido.

[2] OAuth con Google / GitHub
    • Pro: Los usuarios no tienen que recordar otra clave.
    • Contra: Dependencia de proveedores externos.
    • Por qué elegirla: Si la mayoría de tus usuarios son devs.
```

* **Elicitación Adaptativa por Tiers:**
  * **$N \le 5$ preguntas:** Ajustes quirúrgicos o extensiones sobre rieles existentes.
  * **$N \le 10$ preguntas:** Nuevas capacidades dentro del paradigma actual del repo.
  * **$N \le 15$ preguntas:** Núcleo crítico, mutaciones destructivas o nueva arquitectura.
* **Tolerancia a Fatiga y Modo Fast-Path:** Si respondes *"lo que recomiendes"* o *"tengo prisa"*, el agente adopta las mejores opciones por defecto y avanza sin fricción.

---

## 🔄 Las 6 Compuertas de Calidad

Cada cambio avanza secuencialmente a través de 6 puertas protegidas por linters deterministas y pruebas automatizadas:

```text
💡 Intake        📋 Spec          📐 Plan          ✅ Tasks         ⚡ Apply         🛡️ Verify
──────────       ─────────        ────────         ─────────        ─────────        ─────────
Captura la       Define requi-    Diseña la        Desglosa tareas  Implementa en    Verifica tests
idea y dolor     sitos y casos    arquitectura     atómicas con     hilos aislados   y matriz de
del usuario.     de uso reales.   técnica.         estrategia TDD.  y puertas gates. requerimientos.
```

1. **Intake (`idea.md`):** Identifica el problema real y el dolor humano.
2. **Spec (`spec.md`):** Requisitos en sintaxis EARS, Example Mapping y límites (Non-Goals y Anti-Goals).
3. **Plan (`plan.md`):** Arquitectura técnica, árboles de cambios y diseño para testabilidad (DFT).
4. **Tasks (`tasks.md`):** Slicing vertical estricto con TDD garantizado (cero duraciones ficticias).
5. **Apply:** Implementación en ramas de Git aisladas sin contaminar el hilo principal.
6. **Verify:** Oráculo independiente, Golden Path Walkthrough y generación de `resumen.md`.

---

## ⚙️ Tabla de Comandos

| Comando | Acción | Descripción |
| :--- | :--- | :--- |
| `vsdd intake` | **Nueva Funcionalidad** | Inicia la entrevista y exploración para una nueva idea |
| `vsdd` | **Hub / Retomar** | Abre el panel interactivo de funcionalidades activas |
| `vsdd update` | **Actualizar** | Descarga e instala la última versión desde GitHub |
| `vsdd --version` | **Versión** | Muestra la versión instalada (`-v` o `--json`) |
| `vsdd --catalog` | **Catálogo** | Muestra el historial completo de funcionalidades completadas |
| `vsdd --abort <id>` | **Cancelar** | Cancela una funcionalidad en curso y limpia Git de forma segura |
| `node scripts/vsdd-validate.js <file>` | **Linter Determinista** | Valida la estructura y formato de cualquier artefacto Markdown |

---

<div align="center">
  <sub>Desarrollado con arquitectura limpia, agnóstica y portable por <b>Valentin Zurita</b>. Licencia MIT.</sub>
</div>
