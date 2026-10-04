'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { compareSemver, getLocalVsddVersion } = require('./version');

/**
 * Detecta si existe una instalación local de la skill en el proyecto que está
 * desactualizada respecto a una instalación global más reciente.
 * @param {string} cwd Directorio de trabajo del proyecto
 * @param {string} homeDir Directorio home del usuario
 * @returns {Object} { mismatch: boolean, localVersion?, globalVersion?, localPath?, globalPath?, reason? }
 */
function detectDualInstallationMismatch(cwd = process.cwd(), homeDir = os.homedir()) {
  const localCandidates = [
    path.join(cwd, '.agents', 'skills', 'vsdd'),
    path.join(cwd, '.claude', 'skills', 'vsdd'),
  ];

  let localSkillDir = null;
  let localVersion = null;

  for (const cand of localCandidates) {
    const skillFile = path.join(cand, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      localSkillDir = cand;
      const content = fs.readFileSync(skillFile, 'utf8');
      const vMatch = content.match(/version:\s*['"]?([0-9.]+)['"]?/i);
      if (vMatch && vMatch[1]) {
        localVersion = vMatch[1];
      }
      break;
    }
  }

  if (!localSkillDir || !localVersion) {
    return { mismatch: false };
  }

  // Si cwd es el propio repositorio de desarrollo de VSDD, no alertar sobre sí mismo
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name === 'vsdd') {
        return { mismatch: false };
      }
    }
  } catch (e) {}

  // Buscar instalación global
  const globalCandidates = [
    path.join(homeDir, '.gemini', 'config', 'skills', 'vsdd'),
    path.join(homeDir, '.claude', 'skills', 'vsdd'),
    path.join(homeDir, '.agents', 'skills', 'vsdd'),
  ];

  let globalSkillDir = null;
  let globalVersion = null;

  for (const cand of globalCandidates) {
    const skillFile = path.join(cand, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      globalSkillDir = cand;
      const content = fs.readFileSync(skillFile, 'utf8');
      const vMatch = content.match(/version:\s*['"]?([0-9.]+)['"]?/i);
      if (vMatch && vMatch[1]) {
        globalVersion = vMatch[1];
        break;
      }
    }
  }

  if (!globalVersion) {
    globalVersion = getLocalVsddVersion(__dirname);
  }

  if (globalVersion && compareSemver(localVersion, globalVersion) > 0) {
    return {
      mismatch: true,
      localVersion,
      globalVersion,
      localPath: localSkillDir,
      globalPath: globalSkillDir || 'global',
      reason: 'local_outdated',
    };
  }

  return { mismatch: false };
}

/**
 * Chequea si hay una nueva versión disponible en GitHub (con caché de 24h y timeout de red).
 */
async function checkVersionUpdate(currentVersion = getLocalVsddVersion(), options = {}) {
  const cacheDir = options.cacheDir || path.join(os.homedir(), '.vsdd');
  const cacheFile = path.join(cacheDir, 'version-cache.json');
  const interval = options.checkIntervalMs || 24 * 60 * 60 * 1000;
  const timeoutMs = options.timeoutMs || 1500;

  // 1. Revisar caché si aún está vigente
  if (!options.force && fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached.lastCheck && Date.now() - cached.lastCheck < interval) {
        return {
          updateAvailable: Boolean(cached.updateAvailable),
          latestVersion: cached.latestVersion || currentVersion,
          currentVersion,
          cached: true,
        };
      }
    } catch (e) {}
  }

  // 2. Fetch remoto (inyectable para tests o nativo con fetch)
  const fetcher =
    options.fetchRemote ||
    (async (url, ms) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    });

  try {
    const remotePkg = await fetcher(
      'https://raw.githubusercontent.com/ValentinZurita/vsdd/main/package.json',
      timeoutMs
    );
    const latestVersion = remotePkg.version || currentVersion;
    const updateAvailable = compareSemver(currentVersion, latestVersion) > 0;

    // Guardar en caché
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(
        cacheFile,
        JSON.stringify(
          {
            lastCheck: Date.now(),
            latestVersion,
            updateAvailable,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (e) {}

    return {
      updateAvailable,
      latestVersion,
      currentVersion,
      cached: false,
    };
  } catch (err) {
    return {
      updateAvailable: false,
      latestVersion: currentVersion,
      currentVersion,
      cached: false,
      error: err.message,
    };
  }
}

/**
 * Ejecuta la actualización de VSDD.
 */
function performVsddUpdate(cwd = process.cwd(), options = {}) {
  const runner = options.execCommand || ((cmd, opts) => execSync(cmd, opts));
  const isVsddRepo =
    fs.existsSync(path.join(cwd, 'SKILL.md')) &&
    fs.existsSync(path.join(cwd, 'package.json')) &&
    (() => {
      try {
        return require(path.join(cwd, 'package.json')).name === 'vsdd';
      } catch (e) {
        return false;
      }
    })();

  if (isVsddRepo) {
    try {
      const pullOut = runner('git pull origin main', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const installScript = path.join(cwd, 'scripts', 'install-skill.js');
      const installOut = runner(`node "${installScript}" --scope global --hosts all --apply --update`, {
        cwd,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Sincronizar runtime global del CLI en ~/.vsdd/cli si existe
      const cliDir = path.join(os.homedir(), '.vsdd', 'cli');
      if (fs.existsSync(cliDir)) {
        try {
          fs.copyFileSync(path.join(cwd, 'package.json'), path.join(cliDir, 'package.json'));
          fs.copyFileSync(path.join(cwd, 'SKILL.md'), path.join(cliDir, 'SKILL.md'));
          const cliScripts = path.join(cliDir, 'scripts');
          if (fs.existsSync(cliScripts)) {
            fs.cpSync(path.join(cwd, 'scripts'), cliScripts, { recursive: true, force: true });
          }
          const cliRef = path.join(cliDir, 'references');
          if (fs.existsSync(cliRef)) {
            fs.cpSync(path.join(cwd, 'references'), cliRef, { recursive: true, force: true });
          }
        } catch (syncErr) {}
      }

      return {
        success: true,
        isRepo: true,
        message: 'VSDD actualizado con éxito desde el repositorio local y sincronizado globalmente.',
        output: `${pullOut || ''}\n${installOut || ''}`.trim(),
      };
    } catch (err) {
      return {
        success: false,
        isRepo: true,
        message: `Error al actualizar VSDD desde repositorio: ${err.message}`,
        error: err.message,
      };
    }
  }

  // Ejecución en proyecto consumidor o instalación global
  try {
    const isWin = (options.platform || process.platform) === 'win32';
    const cmd = isWin
      ? 'powershell -NoProfile -ExecutionPolicy Bypass -Command "& ([scriptblock]::Create((irm https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.ps1))) -Yes"'
      : 'curl -fsSL https://raw.githubusercontent.com/ValentinZurita/vsdd/main/install.sh | bash -s -- -y';
    const updateOut = runner(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return {
      success: true,
      isRepo: false,
      message: 'VSDD actualizado con éxito a la última versión desde GitHub.',
      output: (updateOut || '').trim(),
    };
  } catch (err) {
    return {
      success: false,
      isRepo: false,
      message: `Error al ejecutar la actualización remota de VSDD: ${err.message}`,
      error: err.message,
    };
  }
}

module.exports = {
  detectDualInstallationMismatch,
  checkVersionUpdate,
  performVsddUpdate,
};
