#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getCanonicalVersion } = require('./lib/version');

function syncVersion(repoRoot = path.resolve(__dirname, '..')) {
  const version = getCanonicalVersion();
  const results = [];

  // 1. SKILL.md
  const skillPath = path.join(repoRoot, 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    let content = fs.readFileSync(skillPath, 'utf8');
    const updated = content.replace(/version:\s*['"]?[0-9.]+['"]?/g, `version: "${version}"`);
    if (updated !== content) {
      fs.writeFileSync(skillPath, updated, 'utf8');
      results.push('SKILL.md');
    }
  }

  // 2. install.sh
  const installShPath = path.join(repoRoot, 'install.sh');
  if (fs.existsSync(installShPath)) {
    let content = fs.readFileSync(installShPath, 'utf8');
    const updated = content.replace(/VSDD_VERSION=["'][0-9.]+["']/g, `VSDD_VERSION="${version}"`);
    if (updated !== content) {
      fs.writeFileSync(installShPath, updated, 'utf8');
      results.push('install.sh');
    }
  }

  // 3. install.ps1
  const installPs1Path = path.join(repoRoot, 'install.ps1');
  if (fs.existsSync(installPs1Path)) {
    let content = fs.readFileSync(installPs1Path, 'utf8');
    const updated = content.replace(/\$VSDD_VERSION\s*=\s*["'][0-9.]+["']/g, `$VSDD_VERSION = "${version}"`);
    if (updated !== content) {
      fs.writeFileSync(installPs1Path, updated, 'utf8');
      results.push('install.ps1');
    }
  }

  // 4. README.md
  const readmePath = path.join(repoRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf8');
    const updated = content.replace(/version-[0-9.]+-blue\.svg/g, `version-${version}-blue.svg`);
    if (updated !== content) {
      fs.writeFileSync(readmePath, updated, 'utf8');
      results.push('README.md');
    }
  }

  return { version, updatedFiles: results };
}

function checkVersion(repoRoot = path.resolve(__dirname, '..')) {
  const version = getCanonicalVersion();
  const outOfSync = [];

  // 1. SKILL.md
  const skillPath = path.join(repoRoot, 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    const content = fs.readFileSync(skillPath, 'utf8');
    const match = content.match(/version:\s*['"]?([0-9.]+)['"]?/);
    if (!match || match[1] !== version) {
      outOfSync.push('SKILL.md');
    }
  }

  // 2. install.sh
  const installShPath = path.join(repoRoot, 'install.sh');
  if (fs.existsSync(installShPath)) {
    const content = fs.readFileSync(installShPath, 'utf8');
    const match = content.match(/VSDD_VERSION=["']([0-9.]+)["']/);
    if (!match || match[1] !== version) {
      outOfSync.push('install.sh');
    }
  }

  // 3. install.ps1
  const installPs1Path = path.join(repoRoot, 'install.ps1');
  if (fs.existsSync(installPs1Path)) {
    const content = fs.readFileSync(installPs1Path, 'utf8');
    const match = content.match(/\$VSDD_VERSION\s*=\s*["']([0-9.]+)["']/);
    if (!match || match[1] !== version) {
      outOfSync.push('install.ps1');
    }
  }

  // 4. README.md
  const readmePath = path.join(repoRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf8');
    if (!content.includes(`version-${version}-blue.svg`)) {
      outOfSync.push('README.md');
    }
  }

  return {
    version,
    inSync: outOfSync.length === 0,
    outOfSyncFiles: outOfSync,
  };
}

if (require.main === module) {
  const isCheckMode = process.argv.includes('--check');

  if (isCheckMode) {
    const res = checkVersion();
    console.log(`[VSDD SSOT] Verificando versión canónica: ${res.version}`);
    if (!res.inSync) {
      console.error(`[VSDD SSOT] ERROR: Los siguientes archivos no coinciden con la versión canónica ${res.version}:`);
      for (const file of res.outOfSyncFiles) {
        console.error(`  ✖ ${file}`);
      }
      console.error(`[VSDD SSOT] Ejecuta 'node scripts/sync-version.js' para sincronizarlos automáticamente.`);
      process.exit(1);
    }
    console.log('[VSDD SSOT] ✔ Todos los archivos están perfectamente sincronizados.');
    process.exit(0);
  }

  const res = syncVersion();
  console.log(`[VSDD SSOT] Versión canónica: ${res.version}`);
  if (res.updatedFiles.length > 0) {
    console.log(`[VSDD SSOT] Archivos sincronizados: ${res.updatedFiles.join(', ')}`);
  } else {
    console.log('[VSDD SSOT] Todos los archivos ya estaban perfectamente sincronizados.');
  }
}

module.exports = { syncVersion, checkVersion };

