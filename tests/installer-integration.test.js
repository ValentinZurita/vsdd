const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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
