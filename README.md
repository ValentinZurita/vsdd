
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

Los instaladores interactivos `install.sh` y `install.ps1` son para un checkout local de código fuente. No verifican releases por sí solos. Para instalar una release, usa el bootstrap de abajo: verifica la attestation antes de extraer o ejecutar cualquier contenido. El bootstrap instala globalmente para todos los hosts; si necesitas elegir alcance o agentes, usa el instalador interactivo desde un checkout local.

### macOS / Linux:
```bash
set -euo pipefail
command -v gh >/dev/null || { echo "Instala GitHub CLI (gh) antes de continuar." >&2; exit 1; }

TAG="$(gh release view --repo ValentinZurita/vsdd --json tagName --jq .tagName)"
[[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo "Tag de release inválido: $TAG" >&2; exit 1; }
ASSET="vsdd-${TAG}.tar.gz"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

gh release download "$TAG" --repo ValentinZurita/vsdd --pattern "$ASSET" --dir "$TEMP_DIR"
gh attestation verify "$TEMP_DIR/$ASSET" \
  --repo ValentinZurita/vsdd \
  --cert-identity "https://github.com/ValentinZurita/vsdd/.github/workflows/release.yml@refs/tags/${TAG}" \
  --source-ref "refs/tags/${TAG}"
tar -xzf "$TEMP_DIR/$ASSET" -C "$TEMP_DIR"
cd "$TEMP_DIR/vsdd-${TAG}"
node scripts/install-skill.js --scope global --hosts all --apply --source "$PWD"
```

### Windows (PowerShell):
```powershell
$ErrorActionPreference = "Stop"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "Instala GitHub CLI (gh) antes de continuar." }

$Tag = (gh release view --repo ValentinZurita/vsdd --json tagName --jq .tagName).Trim()
if ($LASTEXITCODE -ne 0 -or $Tag -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$') { throw "No se pudo resolver un tag de release válido." }
$Asset = "vsdd-$Tag.zip"
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("vsdd-install-" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir | Out-Null

try {
    gh release download $Tag --repo ValentinZurita/vsdd --pattern $Asset --dir $TempDir
    if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar la release." }
    $AssetPath = Join-Path $TempDir $Asset
    gh attestation verify $AssetPath --repo ValentinZurita/vsdd `
      --cert-identity "https://github.com/ValentinZurita/vsdd/.github/workflows/release.yml@refs/tags/$Tag" `
      --source-ref "refs/tags/$Tag"
    if ($LASTEXITCODE -ne 0) { throw "La verificación de la attestation falló; no se extrajo ningún archivo." }

    Expand-Archive -LiteralPath $AssetPath -DestinationPath $TempDir
    Push-Location (Join-Path $TempDir "vsdd-$Tag")
    try {
        $SourceDir = (Get-Location).Path
        & node (Join-Path $SourceDir "scripts\install-skill.js") --scope global --hosts all --apply --source $SourceDir
        if ($LASTEXITCODE -ne 0) { throw "El instalador terminó con error." }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
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
