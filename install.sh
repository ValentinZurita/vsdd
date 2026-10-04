#!/usr/bin/env bash
# ==============================================================================
# VSDD (Valentin-Driven Development) - Instalador Interactivo Profesional
# Compatible con Bash 3.2+ (macOS y Linux) - Cero dependencias externas
# ==============================================================================

set -o pipefail

# ------------------------------------------------------------------------------
# Configuración y Constantes
# ------------------------------------------------------------------------------
VSDD_VERSION="0.44.1"
REPO_RAW_URL="https://raw.githubusercontent.com/ValentinZurita/vsdd/main"
REPO_API_TAR="https://api.github.com/repos/ValentinZurita/vsdd/tarball/main"

# Tabla de Agentes Soportados: "id|Nombre Visible|Ruta Global|Ruta Proyecto"
# Para agregar soporte a nuevos editores, solo agrega una línea en este formato.
AGENTS_REGISTRY=(
  "claude-code|Claude Code|$HOME/.claude/skills/vsdd|.claude/skills/vsdd"
  "cursor|Cursor / Codex|$HOME/.agents/skills/vsdd|.agents/skills/vsdd"
  "antigravity|Google Antigravity|$HOME/.gemini/config/skills/vsdd|.agents/skills/vsdd"
)

# ------------------------------------------------------------------------------
# Colores y Estilos ANSI
# ------------------------------------------------------------------------------
if [ -t 1 ] || [ -c /dev/tty ]; then
  BOLD="\033[1m"
  DIM="\033[2m"
  RESET="\033[0m"
  CYAN="\033[36m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  RED="\033[31m"
  BLUE="\033[34m"
else
  BOLD=""
  DIM=""
  RESET=""
  CYAN=""
  GREEN=""
  YELLOW=""
  RED=""
  BLUE=""
fi

# Directorio temporal para descargas si se ejecuta por curl
TMP_DIR=""

# ------------------------------------------------------------------------------
# Trampa de Errores y Limpieza
# ------------------------------------------------------------------------------
cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR" 2>/dev/null || true
  fi
}

on_error() {
  local exit_code="$1"
  local line_no="$2"
  cleanup
  if [ "$exit_code" -ne 0 ] && [ "$exit_code" -ne 130 ]; then
    printf "\n%b✖ Ocurrió un error inesperado (código %s en línea %s).%b\n" "$RED" "$exit_code" "$line_no" "$RESET" >&2
    printf "%bPor favor, revisa los permisos de tu sistema o el mensaje superior.%b\n\n" "$DIM" "$RESET" >&2
    pause_before_exit
    exit "$exit_code"
  fi
}

on_interrupt() {
  cleanup
  printf "\n\n%bOperación cancelada por el usuario.%b\n" "$YELLOW" "$RESET" >&2
  exit 130
}

pause_before_exit() {
  if [ -e /dev/tty ]; then
    printf "%bPresiona [Enter] para continuar...%b" "$DIM" "$RESET" > /dev/tty
    read -r _ < /dev/tty 2>/dev/tty || true
  fi
}

trap 'cleanup' EXIT
trap 'on_error $? $LINENO' ERR
trap 'on_interrupt' INT

# ------------------------------------------------------------------------------
# Variables de Control
# ------------------------------------------------------------------------------
AUTO_CONFIRM=0

# ------------------------------------------------------------------------------
# Funciones Auxiliares de Interacción
# ------------------------------------------------------------------------------
read_input() {
  local prompt_text="$1"
  local default_value="$2"
  local user_val=""

  if [ "$AUTO_CONFIRM" -eq 1 ]; then
    printf "%b%b%s%b\n" "$prompt_text" "$CYAN" "$default_value" "$RESET" >&2
    echo "$default_value"
    return 0
  fi

  if [ -t 0 ]; then
    printf "%b" "$prompt_text" >&2
    read -r user_val || true
  elif [ -r /dev/tty ]; then
    printf "%b" "$prompt_text" > /dev/tty
    read -r user_val < /dev/tty || true
  else
    printf "\n%b✖ Error: Se requiere una terminal interactiva o usar la opción -y / --yes.%b\n\n" "$RED" "$RESET" >&2
    exit 1
  fi

  if [ -z "$user_val" ]; then
    echo "$default_value"
  else
    echo "$user_val"
  fi
}

# ------------------------------------------------------------------------------
# Detección del Origen de la Skill (Local vs Remoto)
# ------------------------------------------------------------------------------
resolve_source_directory() {
  # 1. Comprobar si estamos ejecutando localmente dentro del repositorio de VSDD
  if [ -f "./SKILL.md" ] && [ -d "./references" ] && grep -q "name: vsdd" "./SKILL.md" 2>/dev/null; then
    echo "$(pwd)"
    return 0
  fi

  # 2. Si no, estamos en ejecución remota (curl | bash). Descargamos la skill.
  TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'vsdd-install')"
  printf "%b● Descargando VSDD v%s desde GitHub...%b\n" "$CYAN" "$VSDD_VERSION" "$RESET" >&2

  local archive_url="https://github.com/ValentinZurita/vsdd/archive/refs/heads/main.tar.gz"
  local download_ok=0

  if curl -fsSL --connect-timeout 10 "$archive_url" -o "$TMP_DIR/vsdd.tar.gz" 2>/dev/null; then
    if tar -xzf "$TMP_DIR/vsdd.tar.gz" -C "$TMP_DIR" 2>/dev/null; then
      local extracted_dir
      extracted_dir=$(find "$TMP_DIR" -maxdepth 1 -type d -name "vsdd-*" | head -n 1)
      if [ -n "$extracted_dir" ] && [ -f "$extracted_dir/SKILL.md" ]; then
        download_ok=1
        echo "$extracted_dir"
        return 0
      fi
    fi
  fi

  if [ "$download_ok" -eq 0 ]; then
    printf "\n%b✖ No se pudo descargar automáticamente el paquete desde GitHub.%b\n" "$RED" "$RESET" >&2
    printf "%bPosibles causas:%b\n" "$YELLOW" "$RESET" >&2
    printf "  1. El repositorio está actualmente configurado como privado en GitHub.\n" >&2
    printf "  2. No hay conexión a internet disponible en este momento.\n\n" >&2
    printf "%bSolución:%b Clona el repositorio con tus credenciales e instálalo localmente:\n" "$BOLD" "$RESET" >&2
    printf "  %bgit clone https://github.com/ValentinZurita/vsdd.git%b\n" "$CYAN" "$RESET" >&2
    printf "  %bcd vsdd && ./install.sh%b\n\n" "$CYAN" "$RESET" >&2
    pause_before_exit
    exit 1
  fi
}

# ------------------------------------------------------------------------------
# Banner Principal
# ------------------------------------------------------------------------------
print_banner() {
  printf "\n"
  printf "%b╭────────────────────────────────────────────────────────╮%b\n" "$BLUE" "$RESET"
  printf "%b│%b  %bVSDD%b  ·  Valentin-Driven Development v%-16s%b│%b\n" "$BLUE" "$RESET" "$BOLD$CYAN" "$RESET" "$VSDD_VERSION" "$BLUE" "$RESET"
  printf "%b│%b  %bInstalador Interactivo de Skill para Agentes de IA%b    %b│%b\n" "$BLUE" "$RESET" "$DIM" "$RESET" "$BLUE" "$RESET"
  printf "%b╰────────────────────────────────────────────────────────╯%b\n\n" "$BLUE" "$RESET"
}

# ------------------------------------------------------------------------------
# Desinstalación
# ------------------------------------------------------------------------------
run_uninstall() {
  print_banner
  printf "%bModo de Desinstalación de VSDD%b\n\n" "$YELLOW$BOLD" "$RESET"

  local removed_count=0
  for entry in "${AGENTS_REGISTRY[@]}"; do
    IFS="|" read -r id name global_dest project_dest <<< "$entry"
    
    # Global
    if [ -d "$global_dest" ]; then
      printf "Eliminando: %s (%s)... " "$global_dest" "$name"
      rm -rf "$global_dest"
      printf "%b✔ Removido%b\n" "$GREEN" "$RESET"
      removed_count=$((removed_count + 1))
    fi

    # Local en directorio actual
    if [ -d "./$project_dest" ]; then
      printf "Eliminando local: ./%s (%s)... " "$project_dest" "$name"
      rm -rf "./$project_dest"
      printf "%b✔ Removido%b\n" "$GREEN" "$RESET"
      removed_count=$((removed_count + 1))
    fi
  done

  # Limpieza de CLI global
  if [ -f "$HOME/.local/bin/vsdd" ]; then
    printf "Eliminando binario CLI: %s... " "$HOME/.local/bin/vsdd"
    rm -f "$HOME/.local/bin/vsdd"
    printf "%b✔ Removido%b\n" "$GREEN" "$RESET"
    removed_count=$((removed_count + 1))
  fi
  if [ -d "$HOME/.vsdd" ]; then
    printf "Eliminando runtime CLI: %s... " "$HOME/.vsdd"
    rm -rf "$HOME/.vsdd"
    printf "%b✔ Removido%b\n" "$GREEN" "$RESET"
    removed_count=$((removed_count + 1))
  fi

  if [ "$removed_count" -eq 0 ]; then
    printf "%bNo se encontraron instalaciones previas de VSDD en este equipo.%b\n\n" "$DIM" "$RESET"
  else
    printf "\n%b✔ Desinstalación completada (%d directorios limpiados).%b\n\n" "$GREEN" "$removed_count" "$RESET"
  fi
  exit 0
}

# ------------------------------------------------------------------------------
# Flujo Principal de Instalación
# ------------------------------------------------------------------------------
main() {
  for arg in "$@"; do
    case "$arg" in
      --uninstall|-u)
        run_uninstall
        ;;
      --yes|-y)
        AUTO_CONFIRM=1
        ;;
      --help|-h)
        print_banner
        printf "Uso: ./install.sh [opciones]\n\n"
        printf "Opciones:\n"
        printf "  -y, --yes          Modo no interactivo (acepta valores recomendados)\n"
        printf "  -u, --uninstall    Desinstalar VSDD de los agentes configurados\n"
        printf "  -h, --help         Mostrar esta ayuda\n\n"
        exit 0
        ;;
    esac
  done

  print_banner
  local source_dir
  source_dir=$(resolve_source_directory)

  # 1. Detección de Agentes en la máquina
  printf "%b● Escaneando entornos de desarrollo en este equipo:%b\n" "$BOLD" "$RESET"
  
  local detected_claude=0
  local detected_agents=0
  local detected_gemini=0

  if [ -d "$HOME/.claude" ]; then
    printf "  %b✔%b Claude Code          %b(~/.claude)%b\n" "$GREEN" "$RESET" "$DIM" "$RESET"
    detected_claude=1
  else
    printf "  %b○%b Claude Code          %b(no detectado)%b\n" "$DIM" "$RESET" "$DIM" "$RESET"
  fi

  if [ -d "$HOME/.agents" ]; then
    printf "  %b✔%b Cursor / Codex       %b(~/.agents)%b\n" "$GREEN" "$RESET" "$DIM" "$RESET"
    detected_agents=1
  else
    printf "  %b○%b Cursor / Codex       %b(no detectado)%b\n" "$DIM" "$RESET" "$DIM" "$RESET"
  fi

  if [ -d "$HOME/.gemini" ]; then
    printf "  %b✔%b Google Antigravity   %b(~/.gemini)%b\n" "$GREEN" "$RESET" "$DIM" "$RESET"
    detected_gemini=1
  else
    printf "  %b○%b Google Antigravity   %b(no detectado)%b\n" "$DIM" "$RESET" "$DIM" "$RESET"
  fi

  printf "\n%b────────────────────────────────────────────────────────%b\n\n" "$DIM" "$RESET"

  # 2. Paso 1: Selección de Alcance (Global vs Local)
  printf "%b1. ¿Dónde deseas instalar VSDD?%b\n" "$BOLD" "$RESET"
  printf "   %b[1]%b Global: disponible en todos tus proyectos %b(Recomendado)%b\n" "$CYAN" "$RESET" "$GREEN" "$RESET"
  printf "   %b[2]%b Local: únicamente en la carpeta de este proyecto\n\n" "$CYAN" "$RESET"

  local scope_choice
  scope_choice=$(read_input "👉 Selecciona una opción [1/2] (por defecto: 1): " "1")

  case "$scope_choice" in
    2)
      SCOPE="project"
      SCOPE_LABEL="Local (proyecto actual)"
      ;;
    *)
      SCOPE="global"
      SCOPE_LABEL="Global (sistema de usuario)"
      ;;
  esac

  printf "%b✔ Alcance seleccionado: %s%b\n\n" "$GREEN" "$SCOPE_LABEL" "$RESET"

  # 3. Paso 2: Selección de Agentes
  printf "%b2. ¿En qué agentes deseas habilitar la skill?%b\n" "$BOLD" "$RESET"
  printf "   %b[1]%b En todos los agentes soportados %b(Recomendado)%b\n" "$CYAN" "$RESET" "$GREEN" "$RESET"
  printf "   %b[2]%b Solo en Cursor / Codex\n" "$CYAN" "$RESET"
  printf "   %b[3]%b Solo en Claude Code\n" "$CYAN" "$RESET"
  printf "   %b[4]%b Solo en Google Antigravity\n\n" "$CYAN" "$RESET"

  local agents_choice
  agents_choice=$(read_input "👉 Selecciona una opción [1-4] (por defecto: 1): " "1")

  local selected_targets=()

  case "$agents_choice" in
    2)
      selected_targets=("cursor")
      ;;
    3)
      selected_targets=("claude-code")
      ;;
    4)
      selected_targets=("antigravity")
      ;;
    *)
      selected_targets=("claude-code" "cursor" "antigravity")
      ;;
  esac

  # 4. Construcción y deduplicación de destinos
  local destinations=()
  local dest_names=()

  for target_id in "${selected_targets[@]}"; do
    for entry in "${AGENTS_REGISTRY[@]}"; do
      IFS="|" read -r reg_id reg_name reg_global reg_project <<< "$entry"
      if [ "$target_id" = "$reg_id" ]; then
        local dest_path=""
        if [ "$SCOPE" = "global" ]; then
          dest_path="$reg_global"
        else
          dest_path="$(pwd)/$reg_project"
        fi

        # Deduplicar si varios agentes comparten la misma carpeta
        local already_added=0
        for existing in "${destinations[@]}"; do
          if [ "$existing" = "$dest_path" ]; then
            already_added=1
            break
          fi
        done

        if [ "$already_added" -eq 0 ]; then
          destinations=("${destinations[@]}" "$dest_path")
          dest_names=("${dest_names[@]}" "$reg_name")
        fi
      fi
    done
  done

  # 5. Paso 3: Verificación de instalación previa / Actualización
  local existing_found=0
  for dest in "${destinations[@]}"; do
    if [ -f "$dest/SKILL.md" ]; then
      existing_found=1
      break
    fi
  done

  if [ "$existing_found" -eq 1 ]; then
    printf "\n%b────────────────────────────────────────────────────────%b\n\n" "$DIM" "$RESET"
    printf "%bℹ Se detectó una versión existente de VSDD en tu sistema.%b\n" "$YELLOW" "$RESET"
    printf "¿Deseas actualizar los archivos a la versión v%s?\n" "$VSDD_VERSION"
    printf "   %b[1]%b Sí, actualizar a la última versión %b(Recomendado)%b\n" "$CYAN" "$RESET" "$GREEN" "$RESET"
    printf "   %b[2]%b Cancelar sin realizar cambios\n\n" "$CYAN" "$RESET"

    local update_choice
    update_choice=$(read_input "👉 Selecciona una opción [1/2] (por defecto: 1): " "1")

    if [ "$update_choice" = "2" ]; then
      printf "\n%bOperación cancelada. No se modificó ningún archivo.%b\n\n" "$YELLOW" "$RESET"
      exit 0
    fi
  fi

  # 6. Ejecución de la instalación
  printf "\n%b────────────────────────────────────────────────────────%b\n\n" "$DIM" "$RESET"
  printf "%b● Instalando archivos de VSDD...%b\n\n" "$BOLD$CYAN" "$RESET"

  local count=0
  for i in "${!destinations[@]}"; do
    local target_dir="${destinations[$i]}"
    local target_agent="${dest_names[$i]}"

    # Validar o crear directorio padre
    if ! mkdir -p "$target_dir" 2>/dev/null; then
      printf "%b✖ Error:%b No tienes permisos de escritura en: %s\n" "$RED" "$RESET" "$target_dir"
      printf "%bVerifica los permisos de la carpeta antes de reintentar.%b\n\n" "$DIM" "$RESET"
      pause_before_exit
      exit 1
    fi

    # Copiar SKILL.md
    cp -f "$source_dir/SKILL.md" "$target_dir/SKILL.md"

    # Copiar carpeta references/
    rm -rf "$target_dir/references" 2>/dev/null || true
    cp -R "$source_dir/references" "$target_dir/references"

    printf "  %b✔%b %-20s %b→ %s%b\n" "$GREEN" "$RESET" "$target_agent" "$DIM" "$target_dir" "$RESET"
    count=$((count + 1))
  done

  # 6.1 Instalación del CLI permanente en ~/.vsdd/cli
  printf "\n%b● Configurando ejecutable CLI de VSDD...%b\n" "$BOLD$CYAN" "$RESET"
  local cli_dir="$HOME/.vsdd/cli"
  local bin_dir="$HOME/.local/bin"

  mkdir -p "$cli_dir/scripts" 2>/dev/null || true
  cp -f "$source_dir/package.json" "$cli_dir/package.json" 2>/dev/null || true
  cp -R "$source_dir/scripts/"* "$cli_dir/scripts/" 2>/dev/null || true
  rm -rf "$cli_dir/references" 2>/dev/null || true
  cp -R "$source_dir/references" "$cli_dir/references" 2>/dev/null || true
  chmod +x "$cli_dir/scripts/cli.js" "$cli_dir/scripts/vsdd-status.js" "$cli_dir/scripts/vsdd-validate.js" "$cli_dir/scripts/vsdd-oracle.js" "$cli_dir/scripts/vsdd-sonar.js" "$cli_dir/scripts/install-skill.js" 2>/dev/null || true

  mkdir -p "$bin_dir" 2>/dev/null || true
  ln -sf "$cli_dir/scripts/cli.js" "$bin_dir/vsdd"
  chmod +x "$bin_dir/vsdd" 2>/dev/null || true
  printf "  %b✔%b %-20s %b→ %s%b\n" "$GREEN" "$RESET" "Comando 'vsdd' CLI" "$DIM" "$bin_dir/vsdd" "$RESET"

  # 7. Resumen de Éxito
  printf "\n"
  printf "%b╭────────────────────────────────────────────────────────╮%b\n" "$GREEN" "$RESET"
  printf "%b│%b  %b✔ ¡Instalación completada con éxito!%b                 %b│%b\n" "$GREEN" "$RESET" "$BOLD$GREEN" "$RESET" "$GREEN" "$RESET"
  printf "%b│%b                                                        %b│%b\n" "$GREEN" "$RESET" "$GREEN" "$RESET"
  printf "%b│%b  VSDD v%-5s ya está lista para usar en tus agentes.   %b│%b\n" "$GREEN" "$RESET" "$VSDD_VERSION" "$GREEN" "$RESET"
  printf "%b│%b  Puedes activarla llamando a 'vsdd' en cualquier chat. %b│%b\n" "$GREEN" "$RESET" "$GREEN" "$RESET"
  printf "%b╰────────────────────────────────────────────────────────╯%b\n\n" "$GREEN" "$RESET"

  if [[ ":$PATH:" != *":$bin_dir:"* ]]; then
    printf "%b⚠️  Aviso:%b %s no está en tu \$PATH actual.\n" "$YELLOW$BOLD" "$RESET" "$bin_dir"
    printf "   Para usar el comando 'vsdd' en cualquier terminal, agrega esto a tu ~/.zshrc o ~/.bashrc:\n"
    printf "   %bexport PATH=\"%s:\$PATH\"%b\n\n" "$CYAN" "$bin_dir" "$RESET"
  fi
}

main "$@"
