/**
 * VSDD Oracle - Paths
 * Resolución de rutas, localización de especificaciones (spec.md) y
 * autodescubrimiento determinista de archivos de test en plan.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseTrackedFilesFromPlanContent } = require('../drift');

/**
 * Determina si una ruta de archivo corresponde inequívocamente a una suite de pruebas.
 * Descarta explícitamente fixtures, configuraciones, helpers, mocks y documentación.
 * @param {string} filePath
 * @returns {boolean}
 */
function isTestFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const clean = filePath.replace(/\\/g, '/');
  const base = path.basename(clean);

  // Descartar explícitamente archivos de soporte, configs, fixtures y docs
  if (
    /\.(?:json|md|ya?ml|txt|csv|png|jpe?g|gif|svg)$/i.test(clean) ||
    /^(?:__init__|conftest|setup|jest\.config|vitest\.config|mod)\.[a-zA-Z0-9]+$/i.test(base) ||
    /(?:^|\/)(?:fixtures?|helpers?|mocks?|utils?)\//i.test(clean) ||
    /(?:^|[_\-.])(?:fixtures?|helpers?|mocks?|utils?)(?:[_\-.])/i.test(base)
  ) {
    return false;
  }

  // Patrones estrictos por ecosistema
  return (
    /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(base) ||
    /^test_[^/]+\.py$/i.test(base) ||
    /[^/]+_test\.py$/i.test(base) ||
    /[^/]+_test\.go$/i.test(base) ||
    /(?:^|\/)tests\/.*?\.rs$/i.test(clean) ||
    /[^/]+Test(?:s)?\.(?:cs|java|php)$/i.test(base) ||
    /[^/]+_(?:test|spec)\.rb$/i.test(base)
  );
}

/**
 * Localiza la ruta del spec.md a partir de un identificador de feature o búsqueda en docs/sdd/vsdd.
 * @param {string} [featureArg]
 * @param {string} [cwd=process.cwd()]
 * @returns {string|null}
 */
function resolveSpecPath(featureArg, cwd = process.cwd()) {
  // 1. Si se pasó una ruta directa existente
  if (featureArg && fs.existsSync(path.resolve(cwd, featureArg))) {
    const resolved = path.resolve(cwd, featureArg);
    if (fs.statSync(resolved).isDirectory()) {
      const candidate = path.join(resolved, 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    } else {
      return resolved;
    }
  }

  // 2. Si se pasó un identificador (ej: 001 o 001-galeria)
  const baseDir = path.join(cwd, 'docs', 'sdd', 'vsdd');
  if (featureArg && fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir);
    const match = entries.find((e) => e === featureArg || e.startsWith(featureArg + '-'));
    if (match) {
      const candidate = path.join(baseDir, match, 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  if (featureArg) {
    return null;
  }

  // 3. Autodetectar si hay una sola feature en docs/sdd/vsdd (solo si no se pasó featureArg)
  if (fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir).filter((e) => {
      const full = path.join(baseDir, e);
      try {
        return fs.statSync(full).isDirectory() && !e.startsWith('.');
      } catch (_) {
        return false;
      }
    });
    if (entries.length === 1) {
      const candidate = path.join(baseDir, entries[0], 'spec.md');
      if (fs.existsSync(candidate)) return candidate;
    }
    // Si hay varias, tomar la última ordenada numéricamente
    if (entries.length > 1) {
      entries.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
      for (const e of entries) {
        const candidate = path.join(baseDir, e, 'spec.md');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

/**
 * Resuelve automáticamente el archivo de pruebas destino a partir del Árbol de Cambios de plan.md.
 * @param {string} [featureArg] Identificador de feature o ruta
 * @param {string} [cwd=process.cwd()]
 * @returns {{ targetPath: string|null, ambiguous: boolean, candidates: string[], planFound: boolean }}
 */
function resolveAutoTestTarget(featureArg, cwd = process.cwd()) {
  const specPath = resolveSpecPath(featureArg, cwd);
  if (!specPath) {
    return { targetPath: null, ambiguous: false, candidates: [], planFound: false };
  }

  const featureDir = path.dirname(specPath);
  const planPath = path.join(featureDir, 'plan.md');
  if (!fs.existsSync(planPath)) {
    return { targetPath: null, ambiguous: false, candidates: [], planFound: false };
  }

  let planContent = '';
  try {
    planContent = fs.readFileSync(planPath, 'utf8');
  } catch (_) {
    return { targetPath: null, ambiguous: false, candidates: [], planFound: true };
  }

  const tracked = parseTrackedFilesFromPlanContent(planContent);
  // Solo consideramos archivos nuevos (+) para prevenir sobreescrituras destructivas
  const testCandidates = tracked
    .filter((item) => item.action === 'create' && isTestFilePath(item.path))
    .map((item) => item.path);

  if (testCandidates.length === 1) {
    return {
      targetPath: testCandidates[0],
      ambiguous: false,
      candidates: testCandidates,
      planFound: true,
    };
  }

  if (testCandidates.length > 1) {
    // Intentar desambiguar si alguno coincide con el nombre de la carpeta de la feature
    const featureSlug = path.basename(featureDir).toLowerCase();
    const normSlug = featureSlug.replace(/[-_]/g, '');
    const matchingSlug = testCandidates.filter((cand) => {
      const cleanCand = cand.replace(/\\/g, '/');
      const candBase = path.basename(cleanCand).toLowerCase();
      const normCand = candBase.replace(/[-_]/g, '');
      const stripped = candBase
        .replace(/^(?:test_)/i, '')
        .replace(/(?:_test|\.(?:test|spec))\.[^.]+$/i, '')
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, '');

      const slugTokens = featureSlug
        .split(/[-_]/)
        .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
      const tokenMatch = slugTokens.some((t) => normCand.includes(t));

      return (
        (normSlug.length >= 3 && normCand.includes(normSlug)) ||
        (stripped.length >= 3 && normSlug.includes(stripped)) ||
        (stripped.length >= 3 && stripped.includes(normSlug)) ||
        tokenMatch
      );
    });

    if (matchingSlug.length === 1) {
      return {
        targetPath: matchingSlug[0],
        ambiguous: false,
        candidates: testCandidates,
        planFound: true,
      };
    }

    return {
      targetPath: null,
      ambiguous: true,
      candidates: testCandidates,
      planFound: true,
    };
  }

  return { targetPath: null, ambiguous: false, candidates: [], planFound: true };
}

module.exports = {
  isTestFilePath,
  resolveSpecPath,
  resolveAutoTestTarget,
};
