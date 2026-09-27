<div align="center">

# ⚡ VSDD
### Valentin-Driven Development

**El conductor interactivo de Spec-Driven Development para agentes de IA.**  
*Tú dictas la arquitectura y los requisitos; la IA nunca asume ni inventa por su cuenta.*

[![Version](https://img.shields.io/badge/version-0.42-blue.svg)](https://github.com/ValentinZurita/vsdd)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Compatible Agents](https://img.shields.io/badge/agents-Claude%20Code%20%7C%20Cursor%20%7C%20Codex%20%7C%20Antigravity-purple.svg)]()

</div>

---

## 🚀 Instalación en 5 segundos

### En Windows (PowerShell / Windows Terminal):

```powershell
# Asistente interactivo directo desde GitHub
irm https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.ps1 | iex

# O si ya tienes el repositorio descargado:
.\install.ps1
```

### En macOS y Linux (Terminal / Bash):

```bash
# Asistente interactivo directo desde GitHub
curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash

# O si ya tienes el repositorio descargado:
./install.sh
```

> *El asistente detectará automáticamente tus editores. Presiona **`[Enter]`** en cada pregunta para aceptar las opciones recomendadas.*

---

## 🎯 ¿Cómo se usa?

Una vez instalada, abre cualquier chat en **Cursor**, **Claude Code** o **Google Antigravity** y escribe:

```text
vsdd
```
*(O también: `sdd interactivo` o `mi sdd`)*

El agente tomará el rol de **conductor metodológico** y te entrevistará paso a paso para diseñar tu funcionalidad antes de tocar una sola línea de código.

---

## 🔄 El Flujo de Trabajo

VSDD avanza a través de 6 puertas de calidad estrictas:

```text
💡 Intake        📋 Spec          📐 Plan          ✅ Tasks         ⚡ Apply         🛡️ Verify
──────────       ─────────        ────────         ─────────        ─────────        ─────────
Captura la       Define requi-    Diseña la        Desglosa tareas  Implementa en    Verifica tests
idea y dolor     sitos y casos    arquitectura     atómicas con     hilos aislados   y matriz de
del usuario.     de uso reales.   técnica.         estrategia TDD.  y puertas gates. requerimientos.
```

---

## 💎 ¿Por qué VSDD?

* **El usuario es el dueño del dominio**: Cada línea escrita en la especificación proviene de tus respuestas, nunca de alucinaciones de la IA.
* **Una pregunta a la vez**: Preguntas directas con opciones numeradas (`1 / 2 / 3`) y análisis de **Pro**, **Contra** y **Recomendada**.
* **Documentación profesional**: Todos los artefactos se generan en español neutro y limpio (`idea.md`, `spec.md`, `plan.md`, `tasks.md`).
* **Aislamiento de responsabilidades**: El conductor que te entrevista no es el mismo que escribe o valida el código, garantizando auditorías independientes reales.

---

## ⚙️ Comandos Útiles

| Acción | macOS / Linux (Bash) | Windows (PowerShell) |
| :--- | :--- | :--- |
| **Instalar o Actualizar** | `./install.sh` | `.\install.ps1` |
| **Instalación Directa (Sin preguntas)** | `./install.sh -y` | `.\install.ps1 -Yes` |
| **Desinstalar** | `./install.sh --uninstall` | `.\install.ps1 -Uninstall` |

---

<div align="center">
  <sub>Desarrollado con arquitectura limpia y portable por <b>Valentin Zurita</b>. Licencia MIT.</sub>
</div>
