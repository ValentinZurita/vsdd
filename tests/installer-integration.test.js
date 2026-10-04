const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, execSync } = require('child_process');
const zlib = require('zlib');

const repoRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

test('install.sh: ciclo de vida completo (instalación, verificación CLI y desinstalación) en Unix aislado', { skip: process.platform === 'win32' }, (t) => {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-install-sh-test-'));

  t.after(() => {
    try {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    } catch (_) {}
  });

  const env = {
    ...process.env,
    HOME: tmpHome,
  };

  // 1. Ejecución de instalación local no interactiva (-y) con stdio silenciado
  const installOutput = execSync(`bash "${path.join(repoRoot, 'install.sh')}" -y`, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  assert.match(installOutput, /¡Instalación completada con éxito!/i);

  // 2. Verificar CLI permanente en ~/.vsdd/cli
  const cliDir = path.join(tmpHome, '.vsdd', 'cli');
  assert.ok(fs.existsSync(cliDir), 'El directorio ~/.vsdd/cli debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'package.json')), 'package.json debe existir en ~/.vsdd/cli');
  assert.ok(fs.existsSync(path.join(cliDir, 'scripts', 'cli.js')), 'scripts/cli.js debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'scripts', 'vsdd-sonar.js')), 'scripts/vsdd-sonar.js debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'scripts', 'vsdd-oracle.js')), 'scripts/vsdd-oracle.js debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'scripts', 'install-skill.js')), 'scripts/install-skill.js debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'scripts', 'lib', 'sonar', 'constants.js')), 'scripts/lib/sonar/constants.js debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'scripts', 'lib', 'oracle', 'sanitizers.js')), 'scripts/lib/oracle/sanitizers.js debe existir');
  assert.ok(fs.existsSync(path.join(cliDir, 'references')), 'references/ debe existir');

  // Verificar bit ejecutable en scripts clave instalados
  assert.ok((fs.statSync(path.join(cliDir, 'scripts', 'vsdd-sonar.js')).mode & 0o111) !== 0, 'vsdd-sonar.js debe tener permisos de ejecución');
  assert.ok((fs.statSync(path.join(cliDir, 'scripts', 'install-skill.js')).mode & 0o111) !== 0, 'install-skill.js debe tener permisos de ejecución');

  // 3. Verificar ejecutable symlink en ~/.local/bin/vsdd
  const binVsdd = path.join(tmpHome, '.local', 'bin', 'vsdd');
  assert.ok(fs.existsSync(binVsdd), '~/.local/bin/vsdd debe existir');

  const versionOutput = execSync(`"${binVsdd}" -v`, {
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim();
  assert.match(versionOutput, new RegExp(pkg.version), `vsdd -v debe contener ${pkg.version}`);

  const helpOutput = execSync(`"${binVsdd}" --help`, {
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.match(helpOutput, /Valentin Spec-Driven Development/i);

  // 4. Ejecución de desinstalación (--uninstall)
  const uninstallOutput = execSync(`bash "${path.join(repoRoot, 'install.sh')}" --uninstall`, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  assert.match(uninstallOutput, /Desinstalación completada/i);
  assert.ok(!fs.existsSync(binVsdd), '~/.local/bin/vsdd debe haber sido eliminado');
  assert.ok(!fs.existsSync(cliDir), '~/.vsdd/cli debe haber sido eliminado');
});

test('install.ps1: análisis estático de paridad e integridad (multiplataforma)', () => {
  const ps1Path = path.join(repoRoot, 'install.ps1');
  assert.ok(fs.existsSync(ps1Path), 'install.ps1 debe existir');
  const ps1Content = fs.readFileSync(ps1Path, 'utf8');

  // Verificar presencia de versión sincronizada
  assert.match(
    ps1Content,
    new RegExp(`\\$VSDD_VERSION\\s*=\\s*["']${pkg.version}["']`),
    `install.ps1 debe tener la versión sincronizada ${pkg.version}`
  );

  // Verificar soporte de desinstalación y switches
  assert.match(ps1Content, /\[switch\]\$Uninstall/);
  assert.match(ps1Content, /\[switch\]\$Yes/);

  // Verificar shims de Windows y preservación de exit codes
  assert.match(ps1Content, /vsdd\.cmd/);
  assert.match(ps1Content, /%ERRORLEVEL%/);
  assert.match(ps1Content, /node\s+-v/);

  // Verificar balance estricto de llaves de control sin anidamientos negativos
  let braceCount = 0;
  for (const char of ps1Content) {
    if (char === '{') braceCount++;
    if (char === '}') {
      braceCount--;
      assert.ok(braceCount >= 0, 'No puede haber llaves de cierre huérfanas en install.ps1');
    }
  }
  assert.equal(braceCount, 0, 'Las llaves { } en install.ps1 deben estar perfectamente balanceadas');
});

test('bootstrap README descarga y verifica la versión antes de extraer o ejecutar', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const bashSection = readme.split('### Windows (PowerShell):')[0];
  const powershellSection = readme.split('### Windows (PowerShell):')[1].split('---')[0];

  assert.match(readme, /bootstrap instala globalmente para todos los hosts/i);
  assert.match(readme, /alcance o agentes[\s\S]*checkout local/i);
  assert.doesNotMatch(readme, /curl[^\n]*\|\s*bash|\birm[^\n]*\|\s*iex/i);
  assert.match(bashSection, /gh attestation verify/);
  assert.match(bashSection, /--repo ValentinZurita\/vsdd/);
  assert.match(bashSection, /--cert-identity/);
  assert.match(bashSection, /--source-ref/);
  assert.ok(bashSection.indexOf('gh attestation verify') < bashSection.indexOf('tar -xzf'));
  assert.ok(bashSection.indexOf('tar -xzf') < bashSection.indexOf('scripts/install-skill.js'));
  assert.match(bashSection, /scripts\/install-skill\.js[\s\S]*--scope global[\s\S]*--hosts all[\s\S]*--source/);
  assert.doesNotMatch(bashSection, /\.\/install\.sh/);

  assert.match(powershellSection, /gh attestation verify/);
  assert.match(powershellSection, /--repo ValentinZurita\/vsdd/);
  assert.match(powershellSection, /--cert-identity/);
  assert.match(powershellSection, /--source-ref/);
  assert.ok(powershellSection.indexOf('gh attestation verify') < powershellSection.indexOf('Expand-Archive'));
  assert.ok(powershellSection.indexOf('Expand-Archive') < powershellSection.indexOf('scripts\\install-skill.js'));
  assert.match(powershellSection, /scripts\\install-skill\.js[\s\S]*--scope global[\s\S]*--hosts all[\s\S]*--source/);
  assert.doesNotMatch(powershellSection, /\.\\install\.ps1/);
});

test('release workflow publishes versioned source archives and attests both assets', () => {
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release.yml');
  assert.ok(fs.existsSync(workflowPath), 'A tag-triggered release workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /tags:\s*(?:\n\s*-\s*|\[\s*)['"]?v\*/);
  assert.match(workflow, /actions\/attest@v\d+/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /attestations:\s*write/);
  assert.match(workflow, /vsdd-\$\{\{\s*github\.ref_name\s*\}\}\.tar\.gz/);
  assert.match(workflow, /vsdd-\$\{\{\s*github\.ref_name\s*\}\}\.zip/);
  assert.match(workflow, /git archive --format=tar --prefix="vsdd-\$\{TAG\}\/"/);
  assert.match(workflow, /subject-path:/);
  assert.match(workflow, /gh release create/);
});

test('release workflow tar archive extracts to the directory expected by the verified bootstrap and updater', { skip: process.platform === 'win32' }, (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-release-layout-test-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  const repo = path.join(tempDir, 'repo');
  const extracted = path.join(tempDir, 'extracted');
  const tag = 'v1.2.3';
  fs.mkdirSync(path.join(repo, 'references'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'vsdd', version: '1.2.3' }));
  fs.writeFileSync(path.join(repo, 'SKILL.md'), 'name: vsdd\n');
  fs.writeFileSync(path.join(repo, 'references', 'phase.md'), 'fixture\n');
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'VSDD Test']);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'vsdd-test@example.invalid']);
  execFileSync('git', ['-C', repo, 'add', 'package.json', 'SKILL.md', 'references/phase.md']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'fixture']);
  execFileSync('git', ['-C', repo, 'tag', tag]);

  // Mirror the release workflow's git-archive + gzip construction exactly.
  const tarBytes = execFileSync('git', ['-C', repo, 'archive', '--format=tar', `--prefix=vsdd-${tag}/`, tag]);
  const archive = path.join(tempDir, `vsdd-${tag}.tar.gz`);
  fs.writeFileSync(archive, zlib.gzipSync(tarBytes, { mtime: 0 }));
  fs.mkdirSync(extracted);
  execFileSync('tar', ['-xzf', archive, '-C', extracted]);

  const releaseRoot = path.join(extracted, `vsdd-${tag}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(releaseRoot, 'package.json'), 'utf8')).version, '1.2.3');
  assert.ok(fs.existsSync(path.join(releaseRoot, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(releaseRoot, 'references', 'phase.md')));
});

test('installers no longer fetch mutable main archives and accept only a local Git source checkout', () => {
  const bashInstaller = fs.readFileSync(path.join(repoRoot, 'install.sh'), 'utf8');
  const powershellInstaller = fs.readFileSync(path.join(repoRoot, 'install.ps1'), 'utf8');

  assert.doesNotMatch(bashInstaller, /archive\/refs\/heads\/main|raw\.githubusercontent\.com|api\.github\.com\/repos/);
  assert.doesNotMatch(powershellInstaller, /archive\/refs\/heads\/main|raw\.githubusercontent\.com/);
  assert.match(bashInstaller, /resolve_source_directory/);
  assert.match(bashInstaller, /\.git/);
  assert.match(bashInstaller, /checkout local/i);
  assert.doesNotMatch(bashInstaller, /release descargada, verificada/i);
  assert.match(powershellInstaller, /Resolve-SourceDirectory/);
  assert.match(powershellInstaller, /\.git/);
  assert.match(powershellInstaller, /checkout local/i);
  assert.doesNotMatch(powershellInstaller, /release descargada, verificada/i);
});

test('install.ps1: ejecución funcional en Windows nativo', { skip: process.platform !== 'win32' }, (t) => {
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-install-ps1-test-'));

  t.after(() => {
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch (_) {}
  });

  const env = {
    ...process.env,
    USERPROFILE: tmpProfile,
  };

  const ps1Path = path.join(repoRoot, 'install.ps1');
  const output = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}" -Yes`, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  assert.match(output, /Instalación completada con éxito/i);

  const binCmd = path.join(tmpProfile, '.local', 'bin', 'vsdd.cmd');
  assert.ok(fs.existsSync(binCmd), 'vsdd.cmd debe existir en Windows');

  const versionOutput = execSync(`"${binCmd}" -v`, {
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim();
  assert.match(versionOutput, new RegExp(pkg.version));

  // Desinstalación funcional en Windows
  const uninstallOutput = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1Path}" -Uninstall`, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  assert.match(uninstallOutput, /Desinstalación completada/i);
  assert.ok(!fs.existsSync(binCmd), 'vsdd.cmd debe haber sido eliminado en desinstalación');
});
