'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Resuelve la ruta canónica de package.json del proyecto VSDD.
 * @returns {string} Ruta absoluta al package.json o cadena vacía
 */
function resolvePackageJsonPath() {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'package.json'),
    path.resolve(__dirname, '..', 'package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (pkg.name === 'vsdd') {
          return candidate;
        }
      } catch (e) {}
    }
  }

  return path.resolve(__dirname, '..', '..', 'package.json');
}

/**
 * Obtiene la versión actual canónica de VSDD desde package.json con fallback seguro.
 * @returns {string} Versión semver (ej: "0.44.0")
 */
function getCanonicalVersion() {
  try {
    const pkgPath = resolvePackageJsonPath();
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg && pkg.version) {
        return pkg.version;
      }
    }
  } catch (e) {}
  return '0.44.1';
}

/**
 * Obtiene la versión actual local de VSDD desde package.json.
 * Mantiene compatibilidad con la firma original de vsdd-status.
 * @param {string} cwd Directorio base de búsqueda
 * @returns {string} Versión encontrada o fallback
 */
function getLocalVsddVersion(cwd = __dirname) {
  try {
    const candidateDirs = [
      cwd,
      path.resolve(__dirname, '..', '..'),
      path.resolve(__dirname, '..'),
    ];
    for (const dir of candidateDirs) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg && pkg.name === 'vsdd' && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch (e) {}
  return getCanonicalVersion();
}

/**
 * Compara dos versiones semver (v1 y v2).
 * Devuelve 1 si latest > current, 0 si son iguales, -1 si current > latest.
 * @param {string} current Versión actual
 * @param {string} latest Versión a comparar
 * @returns {number} 1, 0 o -1
 */
function compareSemver(current, latest) {
  const parse = (v) => (v || '').toString().trim().replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const p1 = parse(current);
  const p2 = parse(latest);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i += 1) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num2 > num1) return 1;
    if (num2 < num1) return -1;
  }
  return 0;
}

module.exports = {
  getCanonicalVersion,
  getLocalVsddVersion,
  compareSemver,
  resolvePackageJsonPath,
};
