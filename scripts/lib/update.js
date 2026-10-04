'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { compareSemver, getLocalVsddVersion } = require('./version');

const RELEASE_REPOSITORY = 'ValentinZurita/vsdd';
const RELEASE_API_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
const RELEASE_DOWNLOAD_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/download`;

function isReleaseTag(tag) {
  return /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag);
}

function releaseVersion(tag) {
  if (!isReleaseTag(tag)) {
    throw new Error(`Latest release has an invalid version tag: ${tag || '(empty)'}`);
  }
  return tag.slice(1);
}

function attestationIdentity(tag) {
  return `https://github.com/${RELEASE_REPOSITORY}/.github/workflows/release.yml@refs/tags/${tag}`;
}

function extractReleaseAsset(runner, platform, archivePath, destination, options) {
  if (platform === 'win32') {
    const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
    const command = `Expand-Archive -LiteralPath ${quote(archivePath)} -DestinationPath ${quote(destination)} -Force`;
    return runner('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], options);
  }
  return runner('tar', ['-xzf', archivePath, '-C', destination], options);
}

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
    const remoteRelease = await fetcher(RELEASE_API_URL, timeoutMs);
    const latestVersion = releaseVersion(remoteRelease.tag_name);
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
  const runner = options.execFileCommand || ((command, args, opts) => execFileSync(command, args, opts));
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
    return {
      success: false,
      isRepo: true,
      message: 'Source checkout detected. Update this checkout with your normal Git workflow; `vsdd update` only updates installed copies from verified releases.',
    };
  }

  // Installed copies update only from versioned, attested release assets.
  let temporaryDirectory;
  try {
    const commandOptions = { cwd, encoding: 'utf8', stdio: 'pipe' };
    const tag = String(runner('gh', [
      'release', 'view', '--repo', RELEASE_REPOSITORY, '--json', 'tagName', '--jq', '.tagName',
    ], commandOptions)).trim();
    const version = releaseVersion(tag);
    const platform = options.platform || process.platform;
    const assetName = platform === 'win32' ? `vsdd-${tag}.zip` : `vsdd-${tag}.tar.gz`;
    const assetUrl = `${RELEASE_DOWNLOAD_URL}/${tag}/${assetName}`;
    const temporaryRoot = options.tempRoot || os.tmpdir();
    temporaryDirectory = fs.mkdtempSync(path.join(temporaryRoot, 'vsdd-update-'));
    const assetPath = path.join(temporaryDirectory, assetName);

    runner('curl', ['-fsSL', '--connect-timeout', '10', '--output', assetPath, assetUrl], commandOptions);
    runner('gh', [
      'attestation', 'verify', assetPath,
      '--repo', RELEASE_REPOSITORY,
      '--cert-identity', attestationIdentity(tag),
      '--source-ref', `refs/tags/${tag}`,
    ], commandOptions);

    extractReleaseAsset(runner, platform, assetPath, temporaryDirectory, commandOptions);
    const sourceDirectory = path.join(temporaryDirectory, `vsdd-${tag}`);
    const packagePath = path.join(sourceDirectory, 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error('Verified release archive is missing package.json.');
    }
    const releasePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (releasePackage.name !== 'vsdd' || releasePackage.version !== version) {
      throw new Error(`Verified release archive does not match tag ${tag}.`);
    }

    const installScript = path.join(sourceDirectory, 'scripts', 'install-skill.js');
    if (!fs.existsSync(installScript)) {
      throw new Error('Verified release archive is missing scripts/install-skill.js.');
    }
    const updateOut = runner('node', [
      installScript, '--scope', 'global', '--hosts', 'all', '--apply', '--update', '--source', sourceDirectory,
    ], commandOptions);
    return {
      success: true,
      isRepo: false,
      message: `VSDD ${tag} verified and installed from its GitHub release.`,
      output: String(updateOut || '').trim(),
    };
  } catch (err) {
    return {
      success: false,
      isRepo: false,
      message: `Verified release update failed: ${err.message}`,
      error: err.message,
    };
  } finally {
    if (temporaryDirectory) {
      try {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      } catch (error) {}
    }
  }
}

module.exports = {
  detectDualInstallationMismatch,
  checkVersionUpdate,
  performVsddUpdate,
};
