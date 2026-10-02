<div align="center">

<img src="https://media.tenor.com/hsZZX4Z7PLQAAAAd/boy-kid.gif" alt="VSDD Thumbs Up" width="340" />

# VSDD
**Valentin Spec-Driven Development para tus agentes de IA.**  
*El Spec-Driven Development que nadie pidió.*

[![Version](https://img.shields.io/badge/version-0.43.0-blue.svg)](https://github.com/ValentinZurita/vsdd)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/plataformas-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()

</div>

---

## Instalación

### macOS / Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash
```

### Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.ps1 | iex
```

---

## Comandos

| Comando | Acción |
| :--- | :--- |
| `vsdd intake` | Inicia una nueva funcionalidad con entrevista interactiva |
| `vsdd` | Abre el panel de pendientes y retoma trabajo en curso |
| `vsdd update` | Actualiza VSDD a la última versión |
| `vsdd -v` | Muestra la versión instalada (`--version`) |
| `vsdd --abort <funcionalidad>` | Descarta una funcionalidad en curso y limpia la rama de Git |

---

## Flujo de Trabajo

El desarrollo avanza secuencialmente a través de 6 compuertas de calidad:

1. **Intake** — Captura el problema y dolor real del usuario.
2. **Spec** — Define requisitos EARS, casos reales y límites (Non-Goals).
3. **Plan** — Diseña la arquitectura técnica pura y el árbol de cambios.
4. **Tasks** — Desglosa tareas atómicas comprobables con TDD.
5. **Apply** — Implementa en ramas aisladas con pruebas automáticas.
6. **Verify** — Valida con oráculo independiente y Golden Path Walkthrough.

---

<div align="center">
  <sub>Desarrollado por <b>Valentin Zurita</b> · Licencia MIT</sub>
</div>
