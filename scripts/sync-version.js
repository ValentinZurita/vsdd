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

  // 5. scripts/vsdd-validate.js banner
  const validatePath = path.join(repoRoot, 'scripts', 'vsdd-validate.js');
  if (fs.existsSync(validatePath)) {
    let content = fs.readFileSync(validatePath, 'utf8');
    const updated = content.replace(/VSDD Format Validator \(v[0-9.]+\)/g, `VSDD Format Validator (v${version})`);
    if (updated !== content) {
      fs.writeFileSync(validatePath, updated, 'utf8');
      results.push('scripts/vsdd-validate.js');
    }
  }

  return { version, updatedFiles: results };
}

if (require.main === module) {
  const res = syncVersion();
  console.log(`[VSDD SSOT] Versión canónica: ${res.version}`);
  if (res.updatedFiles.length > 0) {
    console.log(`[VSDD SSOT] Archivos sincronizados: ${res.updatedFiles.join(', ')}`);
  } else {
    console.log('[VSDD SSOT] Todos los archivos ya estaban perfectamente sincronizados.');
  }
}

module.exports = { syncVersion };
