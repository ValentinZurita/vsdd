<div align="center">

# ⚡ VSDD
**Spec-Driven Development interactivo para tus agentes de IA.**  
*Tú dictas los requisitos; la IA nunca asume ni inventa por su cuenta.*

[![Version](https://img.shields.io/badge/version-0.43.0-blue.svg)](https://github.com/ValentinZurita/vsdd)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/plataformas-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()
[![Compatible Agents](https://img.shields.io/badge/agentes-Cursor%20%7C%20Claude%20Code%20%7C%20Codex%20%7C%20Antigravity-purple.svg)]()

```text
╭── ⚡ [PREGUNTA [1/5]] ──────────────────╮
│ 📌 En curso: Autenticación de usuarios │
╰────────────────────────────────────────╯
¿Cómo debería identificarse el usuario al entrar?

[HIPÓTESIS SUGERIDA] Opción 1: Email y contraseña.

[1] Email y contraseña (Recomendada)
    • Pro: Fácil de implementar sin dependencias.
    • Contra: Requiere gestionar recuperación de claves.

[2] OAuth con Google / GitHub
    • Pro: Sin contraseñas que recordar.
    • Contra: Depende de un proveedor externo.
```

</div>

---

## ⚡ Instalación en 1 segundo

### macOS / Linux (Terminal / Bash):
```bash
curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash
```

### Windows (PowerShell / Windows Terminal):
```powershell
irm https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.ps1 | iex
```

> *El instalador detecta automáticamente tus editores instalados (**Cursor**, **Claude Code**, **Codex**, **Antigravity**) y los configura sin tocar nada más.*

---

## 🎯 Los 2 Comandos que Necesitas Saber

Una vez instalado, úsalo desde cualquier chat con tu agente o directamente en tu terminal:

| Comando | Para qué sirve |
| :--- | :--- |
| **`vsdd intake`** | **Iniciar una nueva funcionalidad.** El agente investiga tu repo y te entrevista paso a paso para definir qué construir antes de tirar código. |
| **`vsdd`** | **Retomar o ver pendientes.** Abre el panel interactivo con tus tareas activas, salud del repo (`Drift Sentinel`) y te deja continuar donde te quedaste. |

---

## 🔄 El Ciclo de Calidad en 6 Pasos

Cada funcionalidad avanza de forma secuencial y verificada:

```text
💡 Intake   ➔   📋 Spec   ➔   📐 Plan   ➔   ✅ Tasks   ➔   ⚡ Apply   ➔   🛡️ Verify
Idea real       Requisitos      Arquitectura    Tareas TDD      Código aislado   Tests y Golden
y dolor         y casos reales  técnica pura    atómicas        sin romper main  Path Walkthrough
```

---

## ⚙️ Comandos Esenciales

| Comando | Acción |
| :--- | :--- |
| `vsdd update` | Actualiza VSDD a la última versión en un solo paso |
| `vsdd --version` | Muestra la versión instalada (`⚡ VSDD v0.43.0`) |
| `vsdd --catalog` | Muestra el catálogo de funcionalidades terminadas |
| `vsdd --abort <id>` | Cancela una funcionalidad en curso y limpia Git de forma segura |
| `node scripts/vsdd-validate.js <archivo>` | Valida sintácticamente un documento VSDD sin gastar tokens |

---

<div align="center">
  <sub>Desarrollado con arquitectura agnóstica por <b>Valentin Zurita</b> · Licencia MIT</sub>
</div>
