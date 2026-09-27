# VSDD (Valentin-Driven Development)

> **Conductor VSDD portable para agentes de IA**: entrevista interactiva, el usuario dicta; no rellena supuestos por su cuenta.

VSDD es un bundle de **Agent Skills** agnóstico y portable, diseñado para funcionar en cualquier entorno que soporte el estándar de skills (Claude Code, Cursor, Codex, Antigravity, etc.).

---

## 🎯 Filosofía y Principios

1. **The User Owns Content**: Cada línea guardada en una especificación o plan proviene directamente de las respuestas del usuario, opciones elegidas o skips aceptados. Cero alucinación de requerimientos.
2. **Una pregunta a la vez**: Detención estricta tras cada consulta (`Pregunta k de como máximo N`). Opciones claras con análisis de *Pro*, *Contra* y *Recomendada*.
3. **Artefactos en Español Neutro**: Documentación profesional, limpia y estructurada (`idea.md`, `spec.md`, `plan.md`, `tasks.md`).
4. **Puertas de Decisión Estrictas**:
   - `intake` → Generación de `idea.md` tras aprobación explícita.
   - `spec` → Entrevista de especificación y requerimientos (`spec.md`).
   - `plan` → Arquitectura y diseño técnico (`plan.md`).
   - `tasks` → Desglose atómico de tareas con TDD (`tasks.md`).
   - `apply` → Implementación con aislamiento e hilos delgados.
   - `verify` → Verificación contra especificación y matriz de pruebas.

---

## 🚀 Instalación y Uso

El repositorio incluye un instalador interactivo asistido ([install.sh](install.sh)) compatible con macOS y Linux sin requerir dependencias externas.

### 1. Instalación Rápida Interactiva (Recomendada)

Ejecuta el asistente paso a paso. Presiona `[Enter]` en cada consulta para aceptar automáticamente las opciones recomendadas:

```bash
# Si ya tienes el repositorio descargado:
./install.sh

# O desde cualquier máquina con una sola línea:
curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash
```

El instalador:
1. Detecta automáticamente tus editores instalados (**Claude Code**, **Cursor**, **Codex**, **Antigravity**).
2. Permite elegir instalación **Global** (para todos tus proyectos) o **Local** (únicamente en el proyecto actual).
3. Si ya tienes instalada una versión anterior, detecta la actualización y sincroniza los cambios de forma segura.

### 2. Modo no interactivo (Automatización / CI/CD)

Para instalar de forma directa aceptando los valores recomendados sin confirmación manual:

```bash
./install.sh -y
```

### 3. Desinstalación limpia

Para retirar la skill de todos los entornos configurados:

```bash
./install.sh --uninstall
```

---

## 🛠️ Instalador Avanzado para Node.js (Opcional)

Si prefieres usar Node.js directamente, dispones del script [scripts/install-skill.js](scripts/install-skill.js):

```bash
# Instalación global en todos los agentes
node scripts/install-skill.js --scope global --hosts all --apply

# Actualización segura
node scripts/install-skill.js --scope global --hosts all --apply --update
```

---

## 📂 Rutas de Instalación por Host

| Host | Alcance Proyecto | Alcance Global |
| --- | --- | --- |
| **Claude Code** | `.claude/skills/vsdd/` | `~/.claude/skills/vsdd/` |
| **Codex** | `.agents/skills/vsdd/` | `~/.agents/skills/vsdd/` |
| **Cursor** | `.agents/skills/vsdd/` | `~/.agents/skills/vsdd/` |
| **Antigravity** | `.agents/skills/vsdd/` | `~/.gemini/config/skills/vsdd/` |

---

## 🧪 Tests

El instalador cuenta con tests unitarios nativos con `node:test`:

```bash
node --test tests/install-skill.test.js
```
