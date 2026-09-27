# ==============================================================================
# VSDD (Valentin-Driven Development) - Instalador para Windows (PowerShell)
# Compatible con Windows PowerShell 5.1 y PowerShell 7+
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$Yes,
    [switch]$Uninstall,
    [switch]$Help
)

$VSDD_VERSION = "0.42"
$USER_PROFILE = $env:USERPROFILE

# Configuración de Agentes: Id, Nombre, Ruta Global, Ruta Local
$AGENTS_REGISTRY = @(
    @{ Id = "claude-code"; Name = "Claude Code"; Global = Join-Path $USER_PROFILE ".claude\skills\vsdd"; Local = ".claude\skills\vsdd" },
    @{ Id = "cursor"; Name = "Cursor / Codex"; Global = Join-Path $USER_PROFILE ".agents\skills\vsdd"; Local = ".agents\skills\vsdd" },
    @{ Id = "antigravity"; Name = "Google Antigravity"; Global = Join-Path $USER_PROFILE ".gemini\config\skills\vsdd"; Local = ".agents\skills\vsdd" }
)

# ------------------------------------------------------------------------------
# Banner Principal
# ------------------------------------------------------------------------------
function Show-Banner {
    Write-Host ""
    Write-Host "╭────────────────────────────────────────────────────────╮" -ForegroundColor Blue
    Write-Host "│  " -NoNewline -ForegroundColor Blue
    Write-Host "VSDD" -NoNewline -ForegroundColor Cyan
    Write-Host ("  ·  Valentin-Driven Development v{0,-16}│" -f $VSDD_VERSION) -ForegroundColor Blue
    Write-Host "│  " -NoNewline -ForegroundColor Blue
    Write-Host "Instalador de Skill para Agentes de IA (PowerShell)  " -NoNewline -ForegroundColor DarkGray
    Write-Host "│" -ForegroundColor Blue
    Write-Host "╰────────────────────────────────────────────────────────╯" -ForegroundColor Blue
    Write-Host ""
}

# ------------------------------------------------------------------------------
# Desinstalación
# ------------------------------------------------------------------------------
function Run-Uninstall {
    Show-Banner
    Write-Host "Modo de Desinstalación de VSDD`n" -ForegroundColor Yellow

    $removedCount = 0
    foreach ($agent in $AGENTS_REGISTRY) {
        if (Test-Path $agent.Global) {
            Write-Host ("Eliminando: {0} ({1})... " -f $agent.Global, $agent.Name) -NoNewline
            Remove-Item -Path $agent.Global -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "✔ Removido" -ForegroundColor Green
            $removedCount++
        }
        $localPath = Join-Path (Get-Location) $agent.Local
        if (Test-Path $localPath) {
            Write-Host ("Eliminando local: {0} ({1})... " -f $localPath, $agent.Name) -NoNewline
            Remove-Item -Path $localPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "✔ Removido" -ForegroundColor Green
            $removedCount++
        }
    }

    if ($removedCount -eq 0) {
        Write-Host "No se encontraron instalaciones previas de VSDD en este equipo.`n" -ForegroundColor DarkGray
    } else {
        Write-Host ("`n✔ Desinstalación completada ({0} directorios limpiados).`n" -f $removedCount) -ForegroundColor Green
    }
    exit 0
}

# ------------------------------------------------------------------------------
# Entrada de Usuario con Valor por Defecto
# ------------------------------------------------------------------------------
function Prompt-Choice {
    param (
        [string]$Message,
        [string]$Default
    )

    if ($Yes) {
        Write-Host "$Message $Default" -ForegroundColor Cyan
        return $Default
    }

    $inputVal = Read-Host -Prompt $Message
    if ([string]::IsNullOrWhiteSpace($inputVal)) {
        return $Default
    }
    return $inputVal.Trim()
}

# ------------------------------------------------------------------------------
# Origen de Archivos
# ------------------------------------------------------------------------------
function Resolve-SourceDirectory {
    $currentDir = Get-Location
    $localSkill = Join-Path $currentDir "SKILL.md"
    $localRef = Join-Path $currentDir "references"

    if ((Test-Path $localSkill) -and (Test-Path $localRef)) {
        return $currentDir.Path
    }

    Write-Host "● Descargando VSDD v$VSDD_VERSION desde GitHub..." -ForegroundColor Cyan
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("vsdd-install-" + [System.Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

    $zipPath = Join-Path $tempDir "vsdd.zip"
    $zipUrl = "https://github.com/ValentinZurita/vsdd/archive/refs/heads/main.zip"

    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 15
        Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
        $extracted = Get-ChildItem -Path $tempDir -Directory -Filter "vsdd-*" | Select-Object -First 1
        if ($extracted -and (Test-Path (Join-Path $extracted.FullName "SKILL.md"))) {
            return $extracted.FullName
        }
    } catch {
        # Fallo de descarga remota
    }

    Write-Host "`n✖ No se pudo descargar automáticamente el paquete desde GitHub." -ForegroundColor Red
    Write-Host "Posibles causas:" -ForegroundColor Yellow
    Write-Host "  1. El repositorio está actualmente configurado como privado en GitHub."
    Write-Host "  2. No hay conexión a internet disponible en este momento.`n"
    Write-Host "Solución: Clona el repositorio con tus credenciales e instálalo localmente:" -ForegroundColor White
    Write-Host "  git clone https://github.com/ValentinZurita/vsdd.git" -ForegroundColor Cyan
    Write-Host "  cd vsdd; .\install.ps1`n" -ForegroundColor Cyan
    Read-Host "Presiona [Enter] para continuar..."
    exit 1
}

# ------------------------------------------------------------------------------
# Flujo Principal
# ------------------------------------------------------------------------------
if ($Help) {
    Show-Banner
    Write-Host "Uso: .\install.ps1 [-Yes] [-Uninstall] [-Help]`n"
    Write-Host "Opciones:"
    Write-Host "  -Yes         Modo no interactivo (acepta valores recomendados)"
    Write-Host "  -Uninstall   Desinstala VSDD de los editores configurados"
    Write-Host "  -Help        Muestra esta ayuda`n"
    exit 0
}

if ($Uninstall) {
    Run-Uninstall
}

Show-Banner
$sourceDir = Resolve-SourceDirectory

# 1. Detección de Agentes
Write-Host "● Escaneando entornos de desarrollo en este equipo:" -ForegroundColor White

$claudeDir = Join-Path $USER_PROFILE ".claude"
$agentsDir = Join-Path $USER_PROFILE ".agents"
$geminiDir = Join-Path $USER_PROFILE ".gemini"

if (Test-Path $claudeDir) {
    Write-Host "  ✔ Claude Code          (~/.claude)" -ForegroundColor Green
} else {
    Write-Host "  ○ Claude Code          (no detectado)" -ForegroundColor DarkGray
}

if (Test-Path $agentsDir) {
    Write-Host "  ✔ Cursor / Codex       (~/.agents)" -ForegroundColor Green
} else {
    Write-Host "  ○ Cursor / Codex       (no detectado)" -ForegroundColor DarkGray
}

if (Test-Path $geminiDir) {
    Write-Host "  ✔ Google Antigravity   (~/.gemini)" -ForegroundColor Green
} else {
    Write-Host "  ○ Google Antigravity   (no detectado)" -ForegroundColor DarkGray
}

Write-Host "`n────────────────────────────────────────────────────────" -ForegroundColor DarkGray

# 2. Alcance
Write-Host "`n1. ¿Dónde deseas instalar VSDD?" -ForegroundColor White
Write-Host "   [1] Global: disponible en todos tus proyectos (Recomendado)" -ForegroundColor Cyan
Write-Host "   [2] Local: únicamente en la carpeta de este proyecto`n" -ForegroundColor Cyan

$scopeChoice = Prompt-Choice -Message "👉 Selecciona una opción [1/2] (por defecto: 1): " -Default "1"
$scope = if ($scopeChoice -eq "2") { "local" } else { "global" }
$scopeLabel = if ($scope -eq "local") { "Local (proyecto actual)" } else { "Global (sistema de usuario)" }

Write-Host "✔ Alcance seleccionado: $scopeLabel`n" -ForegroundColor Green

# 3. Selección de Agentes
Write-Host "2. ¿En qué agentes deseas habilitar la skill?" -ForegroundColor White
Write-Host "   [1] En todos los agentes soportados (Recomendado)" -ForegroundColor Cyan
Write-Host "   [2] Solo en Cursor / Codex" -ForegroundColor Cyan
Write-Host "   [3] Solo en Claude Code" -ForegroundColor Cyan
Write-Host "   [4] Solo en Google Antigravity`n" -ForegroundColor Cyan

$agentsChoice = Prompt-Choice -Message "👉 Selecciona una opción [1-4] (por defecto: 1): " -Default "1"

$selectedIds = switch ($agentsChoice) {
    "2" { @("cursor") }
    "3" { @("claude-code") }
    "4" { @("antigravity") }
    Default { @("claude-code", "cursor", "antigravity") }
}

# 4. Deduplicación de Destinos
$destinations = @()
foreach ($id in $selectedIds) {
    $found = $AGENTS_REGISTRY | Where-Object { $_.Id -eq $id }
    if ($found) {
        $targetPath = if ($scope -eq "global") { $found.Global } else { Join-Path (Get-Location) $found.Local }
        $already = $destinations | Where-Object { $_.Path -eq $targetPath }
        if (-not $already) {
            $destinations += [PSCustomObject]@{ Name = $found.Name; Path = $targetPath }
        }
    }
}

# 5. Detección de Instalación Previa
$hasExisting = $false
foreach ($dest in $destinations) {
    if (Test-Path (Join-Path $dest.Path "SKILL.md")) {
        $hasExisting = $true
        break
    }
}

if ($hasExisting) {
    Write-Host "`n────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "`nℹ Se detectó una versión existente de VSDD en tu sistema." -ForegroundColor Yellow
    Write-Host "¿Deseas actualizar los archivos a la versión v$VSDD_VERSION?"
    Write-Host "   [1] Sí, actualizar a la última versión (Recomendado)" -ForegroundColor Cyan
    Write-Host "   [2] Cancelar sin realizar cambios`n" -ForegroundColor Cyan

    $updateChoice = Prompt-Choice -Message "👉 Selecciona una opción [1/2] (por defecto: 1): " -Default "1"
    if ($updateChoice -eq "2") {
        Write-Host "`nOperación cancelada. No se modificó ningún archivo.`n" -ForegroundColor Yellow
        exit 0
    }
}

# 6. Copia de Archivos
Write-Host "`n────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "`n● Instalando archivos de VSDD...`n" -ForegroundColor Cyan

foreach ($dest in $destinations) {
    try {
        if (-not (Test-Path $dest.Path)) {
            New-Item -ItemType Directory -Path $dest.Path -Force | Out-Null
        }

        Copy-Item -Path (Join-Path $sourceDir "SKILL.md") -Destination (Join-Path $dest.Path "SKILL.md") -Force
        
        $destRef = Join-Path $dest.Path "references"
        if (Test-Path $destRef) {
            Remove-Item -Path $destRef -Recurse -Force
        }
        Copy-Item -Path (Join-Path $sourceDir "references") -Destination $dest.Path -Recurse -Force

        Write-Host ("  ✔ {0,-20} → {1}" -f $dest.Name, $dest.Path) -ForegroundColor Green
    } catch {
        Write-Host ("`n✖ Error copiando a {0}: {1}" -f $dest.Path, $_.Exception.Message) -ForegroundColor Red
        Read-Host "Presiona [Enter] para continuar..."
        exit 1
    }
}

# 7. Resumen de Éxito
Write-Host ""
Write-Host "╭────────────────────────────────────────────────────────╮" -ForegroundColor Green
Write-Host "│  ✔ ¡Instalación completada con éxito!                 │" -ForegroundColor Green
Write-Host "│                                                        │" -ForegroundColor Green
Write-Host ("│  VSDD v{0,-5} ya está lista para usar en tus agentes.   │" -f $VSDD_VERSION) -ForegroundColor Green
Write-Host "│  Puedes activarla llamando a 'vsdd' en cualquier chat. │" -ForegroundColor Green
Write-Host "╰────────────────────────────────────────────────────────╯`n" -ForegroundColor Green
