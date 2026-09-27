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

El repositorio incluye un instalador automático ([scripts/install-skill.js](scripts/install-skill.js)) que detecta las rutas oficiales para cada host y deduplica destinos compartidos.

### 1. Instalación Global (Disponible para todos tus proyectos)

```bash
# Simular instalación (dry-run por defecto)
node scripts/install-skill.js --scope global --hosts all

# Aplicar instalación en todos los agentes configurados
node scripts/install-skill.js --scope global --hosts all --apply

# O elegir hosts específicos:
node scripts/install-skill.js --scope global --hosts claude-code,cursor,antigravity --apply
```

### 2. Instalación Local (En el proyecto actual)

```bash
# Instalar en el directorio del proyecto
node scripts/install-skill.js --scope project --hosts all --apply

# O apuntar a otra carpeta de proyecto:
node scripts/install-skill.js --scope project --hosts all --project /ruta/a/tu/proyecto --apply
```

### 3. Actualización de Versiones (`--update`)

Cuando descargues mejoras o una nueva versión de este repositorio, podés actualizar tu instalación existente con el flag `--update`:

```bash
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
