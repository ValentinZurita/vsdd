
<div align="center">

<img src="https://media.tenor.com/hsZZX4Z7PLQAAAAd/boy-kid.gif" alt="VSDD Thumbs Up" width="340" />


# VSDD

*Valentin Spec Driven Development*, *El Spec-Driven Development que nadie pidió.*

<small><em>No pretende ser el framework definitivo ni salvar el desarrollo de software —mucho menos organizar equipos de 200 personas—. Es una forma de trabajar ideas y features con IA sin lanzarle tres líneas y esperar un milagro. Sí: hace preguntas. Bastantes. Si con un prompt basta, no lo uses.</em></small>

[![Version](https://img.shields.io/badge/version-0.44.1-blue.svg)](https://github.com/ValentinZurita/vsdd)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platforms](https://img.shields.io/badge/plataformas-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey.svg)]()


</div>

## Instalación

### macOS / Linux:
```bash
curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash
```

### Windows (PowerShell):
```powershell
irm https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.ps1 | iex
```

## Comandos

| Comando | Acción |
| :--- | :--- |
| `vsdd` | Abre el panel de pendientes y retoma trabajo en curso |
| `vsdd update` | Actualiza VSDD a la última versión |

Para cancelar una funcionalidad: `vsdd abort <id>`. Añade `--delete-branch` solo si también quieres eliminar su rama. Para ver todos los comandos: `vsdd --help`.

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
