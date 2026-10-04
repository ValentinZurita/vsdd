'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveSafePath, resolveRepoRoot } = require('./fs');

/**
 * Ruta del archivo de memoria del repositorio.
 */
function getMemoryPath(root) {
  return path.join(root, 'docs', 'sdd', 'vsdd', 'repo-memory.json');
}

/**
 * Evalúa el estado actual de una entrada de memoria contra el filesystem físico.
 */
function evaluateMemoryEntry(entry, root) {
  if (!entry || !entry.anchor) {
    return { ...entry, status: 'rota', reason: 'ancla no especificada' };
  }

  let absAnchor;
  try {
    absAnchor = resolveSafePath(root, entry.anchor);
  } catch (_) {
    return { ...entry, status: 'rota', reason: 'ancla fuera de la raíz' };
  }

  if (!fs.existsSync(absAnchor)) {
    return { ...entry, status: 'rota', reason: 'ancla inexistente' };
  }

  try {
    const stat = fs.statSync(absAnchor);
    if (stat.size > 1024 * 1024) {
      return { ...entry, status: 'no-verificable', reason: 'ancla excede 1MB' };
    }

    if (entry.contains) {
      const content = fs.readFileSync(absAnchor, 'utf8');
      if (!content.includes(entry.contains)) {
        return { ...entry, status: 'rota', reason: 'texto de ancla ausente' };
      }
    }
  } catch (_) {
    return { ...entry, status: 'no-verificable', reason: 'error de lectura' };
  }

  return { ...entry, status: 'vigente', reason: null };
}

/**
 * Carga las entradas sin evaluar desde repo-memory.json.
 */
function loadRawMemory(root) {
  const memPath = getMemoryPath(root);
  if (!fs.existsSync(memPath)) return [];
  const rawContent = fs.readFileSync(memPath, 'utf8');
  if (!rawContent.trim()) return [];
  try {
    const parsed = JSON.parse(rawContent);
    if (!Array.isArray(parsed)) {
      throw new Error(
        `Error de integridad: el archivo de memoria '${memPath}' no contiene un arreglo JSON válido.`
      );
    }
    return parsed;
  } catch (err) {
    if (err.name === 'SyntaxError') {
      throw new Error(
        `Error de integridad: el archivo de memoria '${memPath}' está corrupto o tiene formato JSON inválido. Corrige o elimina el archivo antes de continuar.`
      );
    }
    throw err;
  }
}

/**
 * Carga y evalúa todas las entradas de memoria del repositorio.
 */
function loadMemory(root) {
  const raw = loadRawMemory(root);
  return raw.map((entry) => evaluateMemoryEntry(entry, root));
}

/**
 * Registra una nueva hipótesis con ancla verificable en la memoria del repositorio.
 */
function rememberEntry(cwd = process.cwd(), { hypothesis, anchor, contains } = {}) {
  const root = resolveRepoRoot(cwd);

  if (!hypothesis || typeof hypothesis !== 'string' || !hypothesis.trim()) {
    throw new Error('La hipótesis es requerida para registrar en memoria.');
  }
  if (hypothesis.trim().length > 160) {
    throw new Error('La hipótesis no debe superar los 160 caracteres.');
  }
  if (!anchor || typeof anchor !== 'string' || !anchor.trim()) {
    throw new Error('El ancla (--anchor) es requerida para verificar la memoria.');
  }

  const safeAnchorAbs = resolveSafePath(root, anchor.trim());
  if (!fs.existsSync(safeAnchorAbs)) {
    throw new Error(`El ancla '${anchor}' no existe en el repositorio.`);
  }

  const stat = fs.statSync(safeAnchorAbs);
  if (stat.size > 1024 * 1024) {
    throw new Error(`El ancla '${anchor}' supera el tamaño máximo permitido (1MB).`);
  }

  if (contains) {
    const content = fs.readFileSync(safeAnchorAbs, 'utf8');
    if (!content.includes(contains)) {
      throw new Error(`El texto indicado en --contains no se encuentra en el ancla '${anchor}'.`);
    }
  }

  const raw = loadRawMemory(root);
  if (raw.length >= 15) {
    throw new Error(
      'Límite de memoria alcanzado (máximo 15 entradas). Usa --forget para liberar espacio antes de agregar nuevas.'
    );
  }

  const maxNum = raw.reduce((acc, cur) => {
    const m = (cur.id || '').match(/^m-(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  const nextId = 'm-' + String(maxNum + 1).padStart(3, '0');

  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      timeout: 1000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (_) {}

  const entry = {
    id: nextId,
    hypothesis: hypothesis.trim(),
    anchor: path.relative(root, safeAnchorAbs).replace(/\\/g, '/'),
    ...(contains ? { contains } : {}),
    recordedAt: new Date().toISOString(),
    ...(commit ? { recordedCommit: commit } : {}),
  };

  const memPath = getMemoryPath(root);
  fs.mkdirSync(path.dirname(memPath), { recursive: true });
  fs.writeFileSync(memPath, JSON.stringify([...raw, entry], null, 2) + '\n', 'utf8');

  return entry;
}

/**
 * Elimina una entrada de memoria por ID.
 */
function forgetEntry(cwd = process.cwd(), id) {
  if (!id) throw new Error('Se requiere el ID de la entrada a olvidar (--forget <id>).');
  const root = resolveRepoRoot(cwd);
  const raw = loadRawMemory(root);
  const index = raw.findIndex((e) => e.id === id);

  if (index === -1) {
    throw new Error(`No se encontró ninguna entrada de memoria con ID '${id}'.`);
  }

  raw.splice(index, 1);
  const memPath = getMemoryPath(root);
  fs.writeFileSync(memPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return { forgotten: id };
}

module.exports = {
  getMemoryPath,
  evaluateMemoryEntry,
  loadRawMemory,
  loadMemory,
  rememberEntry,
  forgetEntry,
};
