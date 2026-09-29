<div align="center">

# ⚡ VSDD
### Valentin-Driven Development

**El conductor interactivo de Spec-Driven Development para agentes de IA.**  
*Tú dictas la arquitectura y los requisitos; la IA nunca asume ni inventa por su cuenta.*

[![Version](https://img.shields.io/badge/version-0.43.0-blue.svg)](https://github.com/ValentinZurita/vsdd)
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

Una vez instalada, abre cualquier chat en **Cursor**, **Claude Code**, **Codex** o **Google Antigravity** y escribe:

```text
vsdd
```
*(O también: `sdd interactivo` o `mi sdd`)*

El agente tomará el rol de **conductor metodológico** y te entrevistará paso a paso para diseñar tu funcionalidad antes de tocar una sola línea de código:

* **Hub de Pendientes:** Detecta funcionalidades activas, borradores en curso y salud del repositorio (`Drift Sentinel` con semáforo 🟢/🟡/🔴).
* **Recuperación de Entrevistas:** Guarda acuerdos pregunta a pregunta para reanudar sesiones interrumpidas sin repetir decisiones ya tomadas.
* **Compuerta de Cero Tokens:** Validación sintáctica determinista (`vsdd-validate`) antes de cualquier auditoría de QA.

---

## 🔄 El Flujo de Trabajo

VSDD avanza a través de 6 compuertas de calidad estrictas:

```text
💡 Intake        📋 Spec          📐 Plan          ✅ Tasks         ⚡ Apply         🛡️ Verify
──────────       ─────────        ────────         ─────────        ─────────        ─────────
Captura la       Define requi-    Diseña la        Desglosa tareas  Implementa en    Verifica tests
idea y dolor     sitos y casos    arquitectura     atómicas con     hilos aislados   y matriz de
del usuario.     de uso reales.   técnica.         estrategia TDD.  y puertas gates. requerimientos.
```

---

## ⚙️ Comandos Útiles

| Acción | macOS / Linux (Bash) | Windows (PowerShell) | Node.js Directo |
| :--- | :--- | :--- | :--- |
| **Instalar o Actualizar** | `./install.sh` | `.\install.ps1` | `node scripts/install-skill.js --scope global --hosts all --apply --update` |
| **Instalación Directa** | `./install.sh -y` | `.\install.ps1 -Yes` | `node scripts/install-skill.js --scope project --hosts all --apply` |
| **Desinstalar** | `./install.sh --uninstall` | `.\install.ps1 -Uninstall` | — |
| **Validar Artefactos** | `node scripts/vsdd-validate.js <archivo>` | `node scripts\vsdd-validate.js <archivo>` | `node scripts/vsdd-validate.js <archivo>` |
| **Estado y Hub** | `node scripts/vsdd-status.js` | `node scripts\vsdd-status.js` | `node scripts/vsdd-status.js` |

---

<div align="center">
  <sub>Desarrollado con arquitectura limpia y portable por <b>Valentin Zurita</b>. Licencia MIT.</sub>
</div>
