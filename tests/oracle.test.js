const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  extractAcceptanceOracle,
  formatUniversalMarkdown,
  formatTypeScript,
  formatPython,
  formatGo,
  formatRust,
  formatCSharp,
  formatOracle,
  resolveSpecPath,
  runOracle,
} = require('../scripts/vsdd-oracle');
const { parseCliCommand } = require('../scripts/cli');

const sampleSpec = `
# Spec 001 Subir imagen

## Contexto y objetivos
Objetivo general de prueba.

## Requisitos funcionales

### RF-01 Carga y optimización WebP
- Cuando el usuario sube un PNG válido, el sistema debe convertirlo a WebP.
- Si el archivo supera 10MB, el sistema no debe almacenarlo; debe mostrar error.
- **Ejemplo concreto:**
  * Entrada: PNG de 2MB → Resultado observable: 200 OK y URL WebP
  * Entrada: Archivo .exe → Resultado observable: Error 400 Formato no soportado

### RF-02 Galería de predefinidas
| Entrada | Resultado observable |
| :--- | :--- |
| Click en pestaña Predefinidas | Muestra 10 fotos del sistema |
| Intentar borrar predefinida | Botón deshabilitado y mensaje solo lectura |
| Entrada con texto largo y prefijo | Mensaje de éxito controlado |

### RF-03 Acceso a biblioteca
- Siempre el sistema debe mostrar la biblioteca en el menú principal.
- Si el usuario no tiene permisos, no debe mostrar la opción.
`;

test('oracle: extractAcceptanceOracle extrae ejemplos de viñetas, tablas y fallback EARS', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  assert.equal(requirements.length, 3);

  // RF-01: Extraído desde viñetas de Example Mapping
  const rf1 = requirements[0];
  assert.equal(rf1.id, 'RF-01');
  assert.equal(rf1.title, 'Carga y optimización WebP');
  assert.equal(rf1.examples.length, 2);
  assert.match(rf1.examples[0].input, /PNG de 2MB/);
  assert.match(rf1.examples[0].expected, /200 OK/);
  assert.match(rf1.examples[1].input, /Archivo \.exe/);
  assert.match(rf1.examples[1].expected, /Error 400/);

  // RF-02: Extraído desde tabla (incluso filas que empiezan con la palabra 'Entrada')
  const rf2 = requirements[1];
  assert.equal(rf2.id, 'RF-02');
  assert.equal(rf2.examples.length, 3);
  assert.match(rf2.examples[0].input, /Click en pestaña Predefinidas/);
  assert.match(rf2.examples[0].expected, /Muestra 10 fotos/);
  assert.match(rf2.examples[2].input, /Entrada con texto largo y prefijo/);
  assert.match(rf2.examples[2].expected, /Mensaje de éxito/);

  // RF-03: Fallback a criterios EARS cuando no hay Example Mapping explícito
  const rf3 = requirements[2];
  assert.equal(rf3.id, 'RF-03');
  assert.equal(rf3.examples.length, 2);
  assert.match(rf3.examples[0].expected, /Siempre el sistema debe mostrar/);
});

test('oracle: formatUniversalMarkdown genera checklist agnóstico de lenguaje', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  const md = formatUniversalMarkdown(requirements, { featureId: '001-test' });

  assert.match(md, /# Oráculo de Aceptación Universal/);
  assert.match(md, /## RF-01: Carga y optimización WebP/);
  assert.match(md, /- \[ \] \*\*Ejemplo concreto:\*\* Entrada: PNG de 2MB → Esperado: 200 OK/);
  assert.match(md, /## RF-02: Galería de predefinidas/);
  assert.match(md, /## RF-03: Acceso a biblioteca/);
});

test('oracle: formatTypeScript genera stubs con describe e it.todo', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  const ts = formatTypeScript(requirements);

  assert.match(ts, /describe\('RF-01: Carga y optimización WebP'/);
  assert.match(ts, /it\.todo\('PNG de 2MB -> 200 OK y URL WebP'\);/);
  assert.match(ts, /describe\('RF-02: Galería de predefinidas'/);
});

test('oracle: formatPython genera stubs de pytest con pytest.skip', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  const py = formatPython(requirements);

  assert.match(py, /import pytest/);
  assert.match(py, /class Test_RF_01_Carga_y_optimizacion_WebP:/);
  assert.match(py, /def test_caso_/);
  assert.match(py, /pytest\.skip\("Pendiente de implementacion"\)/);
});

test('oracle: formatGo genera stubs con testing.T y t.Skip', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  const go = formatGo(requirements);

  assert.match(go, /package acceptance_test/);
  assert.match(go, /import "testing"/);
  assert.match(go, /func Test_RF_01_Case1\(t \*testing\.T\)/);
  assert.match(go, /t\.Skip\("Pendiente de implementacion"\)/);
});

test('oracle: formatRust genera módulos y tests ignorados', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  const rs = formatRust(requirements);

  assert.match(rs, /#\[cfg\(test\)\]/);
  assert.match(rs, /#\[ignore = "Pendiente de implementacion"\]/);
  assert.match(rs, /fn test_case_1\(\)/);
});

test('oracle: formatCSharp genera clases de test con xUnit Fact(Skip)', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);
  const cs = formatCSharp(requirements);

  assert.match(cs, /using Xunit;/);
  assert.match(cs, /public class RF_01Tests/);
  assert.match(cs, /\[Fact\(Skip = "Pendiente de implementacion:/);
});

test('oracle: formatOracle detecta la extensión correcta del archivo destino', () => {
  const requirements = extractAcceptanceOracle(sampleSpec);

  assert.match(formatOracle(requirements, 'tests/test.py'), /import pytest/);
  assert.match(formatOracle(requirements, 'tests/test_test.go'), /package acceptance_test/);
  assert.match(formatOracle(requirements, 'tests/test.test.ts'), /it\.todo/);
  assert.match(formatOracle(requirements, 'tests/test.rs'), /#\[cfg\(test\)\]/);
  assert.match(formatOracle(requirements, 'tests/test.cs'), /using Xunit;/);
  assert.match(formatOracle(requirements, 'tests/test.md'), /# Oráculo de Aceptación/);
  assert.match(formatOracle(requirements, ''), /# Oráculo de Aceptación/);
});

test('oracle: cli routing despacha oracle y scaffold-tests a vsdd-oracle.js', () => {
  const scriptsDir = path.resolve(__dirname, '..', 'scripts');
  const parsedOracle = parseCliCommand(['oracle', '001', '--target', 'test.py'], scriptsDir);
  assert.equal(parsedOracle.script, path.join(scriptsDir, 'vsdd-oracle.js'));
  assert.deepEqual(parsedOracle.args, ['001', '--target', 'test.py']);

  const parsedScaffold = parseCliCommand(['scaffold-tests', '001'], scriptsDir);
  assert.equal(parsedScaffold.script, path.join(scriptsDir, 'vsdd-oracle.js'));
  assert.deepEqual(parsedScaffold.args, ['001']);
});

test('oracle: runOracle con --target escribe archivo y previene sobreescritura accidental', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-oracle-test-'));
  try {
    const specDir = path.join(tmpDir, 'docs', 'sdd', 'vsdd', '001-galeria');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'spec.md'), sampleSpec, 'utf8');

    const targetFile = path.join(tmpDir, 'tests', 'gallery.test.ts');

    // 1. Escritura inicial
    runOracle(['001-galeria', '--target', targetFile], tmpDir);
    assert.equal(fs.existsSync(targetFile), true);
    const content = fs.readFileSync(targetFile, 'utf8');
    assert.match(content, /describe\('RF-01:/);

    // 2. Intento de sobreescritura sin --force debe fallar con aviso
    const originalExitCode = process.exitCode;
    try {
      process.exitCode = 0;
      runOracle(['001-galeria', '--target', targetFile], tmpDir);
      assert.equal(process.exitCode, 1);

      // 3. Sobreescritura con --force debe permitirse
      process.exitCode = 0;
      runOracle(['001-galeria', '--target', targetFile, '--force'], tmpDir);
      assert.equal(process.exitCode, 0);
    } finally {
      process.exitCode = originalExitCode;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('oracle: runOracle --json emite objeto estructurado parseable', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-oracle-json-'));
  try {
    const specDir = path.join(tmpDir, 'docs', 'sdd', 'vsdd', '001-galeria');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'spec.md'), sampleSpec, 'utf8');

    let captured = '';
    const originalLog = console.log;
    console.log = (msg) => { captured += msg; };

    runOracle(['001-galeria', '--json'], tmpDir);
    console.log = originalLog;

    const parsed = JSON.parse(captured);
    assert.equal(parsed.meta.featureId, '001-galeria');
    assert.equal(parsed.requirements.length, 3);
    assert.equal(parsed.requirements[0].id, 'RF-01');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('oracle: tabla de 3 columnas mapea escenario, entrada y salida sin desplazar columnas por celdas vacías', () => {
  const specWith3ColTable = `
# Spec 002 Tabla 3 columnas
## Contexto y objetivos
Objetivo
## Requisitos funcionales
### RF-01 Tabla de tres columnas
| Escenario | Entrada | Salida |
| :--- | :--- | :--- |
| Caso normal | click boton | 200 OK |
| Caso con entrada vacía | | Error 400 |
| Caso con salida | Salida: 201 Created |
`;
  const reqs = extractAcceptanceOracle(specWith3ColTable);
  assert.equal(reqs.length, 1);
  const examples = reqs[0].examples;
  assert.equal(examples.length, 3);

  // Fila 1: Escenario | Entrada | Salida
  assert.equal(examples[0].scenario, 'Caso normal');
  assert.equal(examples[0].input, 'click boton');
  assert.equal(examples[0].expected, '200 OK');

  // Fila 2: Celda vacía intermedia no desplaza columnas
  assert.equal(examples[1].scenario, 'Caso con entrada vacía');
  assert.equal(examples[1].input, '');
  assert.equal(examples[1].expected, 'Error 400');

  // Fila 3: Salida con prefijo limpiado
  assert.equal(examples[2].scenario, 'Tabla: Caso con salida');
  assert.equal(examples[2].input, 'Caso con salida');
  assert.equal(examples[2].expected, '201 Created');
});

test('oracle: limpia dos puntos o guiones en títulos de RF y prefijos Salida/Resultado en Example Mapping', () => {
  const specWithPrefixes = `
# Spec 003 Prefijos
## Contexto y objetivos
Objetivo
## Requisitos funcionales
### RF-01: Título con dos puntos
- Cuando se envía petición, el sistema debe responder.
- **Ejemplo concreto:** Entrada: Datos válidos → Salida: Código 200
- **Ejemplo concreto:** Entrada: Datos inválidos → Salida esperada: Código 422
- **Ejemplo concreto:** Entrada: Token vencido → Resultado observable: Código 401

### RF-02 - Título con guión
- **Ejemplo concreto:** Entrada: ID inexistente → Resultado: Código 404
`;
  const reqs = extractAcceptanceOracle(specWithPrefixes);
  assert.equal(reqs.length, 2);
  assert.equal(reqs[0].title, 'Título con dos puntos');
  assert.equal(reqs[1].title, 'Título con guión');

  assert.equal(reqs[0].examples[0].input, 'Datos válidos');
  assert.equal(reqs[0].examples[0].expected, 'Código 200');

  assert.equal(reqs[0].examples[1].input, 'Datos inválidos');
  assert.equal(reqs[0].examples[1].expected, 'Código 422');

  assert.equal(reqs[0].examples[2].input, 'Token vencido');
  assert.equal(reqs[0].examples[2].expected, 'Código 401');

  assert.equal(reqs[1].examples[0].input, 'ID inexistente');
  assert.equal(reqs[1].examples[0].expected, 'Código 404');
});

test('oracle: ignora encabezados falsos dentro de code fences de 4 backticks o tildes', () => {
  const specWithFences = `
# Spec 004 Fences
## Contexto y objetivos
Objetivo
## Requisitos funcionales
### RF-01 Bloques de código
- El sistema debe procesar bloques de código.

\`\`\`\`markdown
### RF-99 Requisito falso en 4 backticks
\`\`\`
Dentro de bloque anidado
\`\`\`
\`\`\`\`

~~~python
### RF-98 Requisito falso en tildes
~~~

- **Ejemplo concreto:** Entrada: Bloque válido → Salida: Parseado OK
`;
  const reqs = extractAcceptanceOracle(specWithFences);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].id, 'RF-01');
  assert.equal(reqs[0].examples.length, 1);
  assert.equal(reqs[0].examples[0].input, 'Bloque válido');
  assert.equal(reqs[0].examples[0].expected, 'Parseado OK');
});

test('oracle: sanitiza saltos de línea y caracteres problemáticos en todos los formateadores', () => {
  const reqs = [{
    id: 'RF-01',
    title: 'Título con\nsalto de línea',
    criteria: [],
    examples: [{
      scenario: 'Escenario\nmultilínea',
      input: 'Ruta C:\\directorio\\',
      expected: 'Respuesta con comillas """triples""" y barra \\',
      raw: 'raw\nmultiline',
    }],
  }];

  // TypeScript
  const ts = formatTypeScript(reqs);
  assert.ok(!ts.includes('\nsalto'));
  assert.match(ts, /describe\('RF-01: Título con salto de línea'/);

  // Python
  const py = formatPython(reqs);
  assert.ok(!py.includes('"""triples"""'));
  assert.match(py, /\\"\\"\\"/);
  // El número de barras invertidas antes de las comillas triples de cierre debe ser par
  // para no escapar la primera comilla y provocar SyntaxError en Python
  const backslashesBeforeClose = py.match(/(\\+)"""/)[1];
  assert.equal(backslashesBeforeClose.length % 2, 0);

  // Go
  const go = formatGo(reqs);
  assert.ok(!go.includes('\nmultilínea'));

  // Rust
  const rs = formatRust(reqs);
  assert.ok(!rs.includes('\nmultilínea'));

  // C#
  const cs = formatCSharp(reqs);
  assert.ok(!cs.includes('\nmultilínea'));

  // Markdown
  const md = formatUniversalMarkdown(reqs);
  assert.match(md, /## RF-01: Título con salto de línea/);
  assert.match(md, /- \[ \] \*\*Escenario multilínea:\*\*/);
});

test('oracle: formatGo genera stub dummy con t.Skip cuando no hay casos', () => {
  const reqs = [{
    id: 'RF-01',
    title: 'Sin ejemplos',
    criteria: [],
    examples: [],
  }];
  const go = formatGo(reqs);
  assert.match(go, /import "testing"/);
  assert.match(go, /func TestOracle_NoCases\(t \*testing\.T\)/);
  assert.match(go, /t\.Skip\("Sin casos definidos en spec"\)/);
});

test('oracle: resolveSpecPath no cae en Paso 3 si featureArg no existe y usa prefijo estricto', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-oracle-resolve-'));
  try {
    const specDir1 = path.join(tmpDir, 'docs', 'sdd', 'vsdd', '001-galeria');
    const specDir2 = path.join(tmpDir, 'docs', 'sdd', 'vsdd', '002-login');
    fs.mkdirSync(specDir1, { recursive: true });
    fs.mkdirSync(specDir2, { recursive: true });
    fs.writeFileSync(path.join(specDir1, 'spec.md'), sampleSpec, 'utf8');
    fs.writeFileSync(path.join(specDir2, 'spec.md'), sampleSpec, 'utf8');

    // 1. Argumento exacto o prefijo funciona
    assert.equal(resolveSpecPath('001', tmpDir), path.join(specDir1, 'spec.md'));
    assert.equal(resolveSpecPath('001-galeria', tmpDir), path.join(specDir1, 'spec.md'));

    // 2. Argumento que no coincide exactamente ni es prefijo no debe resolver (no includes)
    assert.equal(resolveSpecPath('galeria', tmpDir), null);

    // 3. Argumento inexistente no debe hacer fallback accidental a la última feature (Paso 3)
    assert.equal(resolveSpecPath('999-no-existe', tmpDir), null);

    // 4. Sin argumento, sí hace autodetección (Paso 3) devolviendo la última ordenada
    assert.equal(resolveSpecPath(null, tmpDir), path.join(specDir2, 'spec.md'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('oracle: runOracle rechaza --target sin argumento o seguido de bandera', () => {
  const originalExitCode = process.exitCode;
  const originalError = console.error;
  let capturedErr = '';
  console.error = (msg) => { capturedErr += msg + '\n'; };

  try {
    // 1. --target al final sin argumento
    process.exitCode = 0;
    runOracle(['001', '--target']);
    assert.equal(process.exitCode, 1);
    assert.match(capturedErr, /requiere especificar la ruta/);

    // 2. --target seguido de otra bandera
    capturedErr = '';
    process.exitCode = 0;
    runOracle(['001', '--target', '--dry-run']);
    assert.equal(process.exitCode, 1);
    assert.match(capturedErr, /requiere especificar la ruta/);

    // 3. -t seguido de bandera
    capturedErr = '';
    process.exitCode = 0;
    runOracle(['001', '-t', '-h']);
    assert.equal(process.exitCode, 1);
    assert.match(capturedErr, /requiere especificar la ruta/);
  } finally {
    console.error = originalError;
    process.exitCode = originalExitCode;
  }
});

test('oracle: runOracle con --help o -h muestra ayuda y sale con exitCode 0', () => {
  const originalExitCode = process.exitCode;
  const originalLog = console.log;
  let capturedLog = '';
  console.log = (msg) => { capturedLog += msg + '\n'; };

  try {
    process.exitCode = 99;
    runOracle(['--help']);
    assert.equal(process.exitCode, 0);
    assert.match(capturedLog, /Uso: vsdd oracle/);

    capturedLog = '';
    process.exitCode = 99;
    runOracle(['-h']);
    assert.equal(process.exitCode, 0);
    assert.match(capturedLog, /Uso: vsdd oracle/);
  } finally {
    console.log = originalLog;
    process.exitCode = originalExitCode;
  }
});

test('oracle: parsea celdas con pipes escapados y flechas en resultados sin truncar', () => {
  const spec = `
## Requisitos funcionales
### RF-01 Comando con pipe
| Entrada | Salida esperada |
| :--- | :--- |
| echo a \\| grep a | Salida: OK -> Redirección -> Fin |
`;
  const reqs = extractAcceptanceOracle(spec);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].examples.length, 1);
  assert.equal(reqs[0].examples[0].input, 'echo a | grep a');
  assert.equal(reqs[0].examples[0].expected, 'OK -> Redirección -> Fin');
});

test('oracle: trailing backslashes en TypeScript y C# no rompen la sintaxis de strings', () => {
  const reqs = [{
    id: 'RF-01',
    title: 'Ruta Windows C:\\Users\\',
    examples: [{
      scenario: 'Windows path',
      input: 'C:\\test\\dir\\',
      expected: 'Status 200\\',
      raw: 'C:\\test\\dir\\ -> Status 200\\',
    }],
  }];

  const ts = formatTypeScript(reqs);
  // Verificar que el string generado en TypeScript es sintácticamente válido evaluándolo con new Function
  assert.doesNotThrow(() => {
    // Declaramos mock de describe e it para probar la sintaxis completa
    const fn = new Function('describe', 'it', ts);
    fn(() => {}, { todo: () => {} });
  });

  const cs = formatCSharp(reqs);
  // En C# la barra invertida debe estar escapada antes de la comilla de cierre
  assert.match(cs, /C:\\\\test\\\\dir\\\\/);
});

test('oracle: soporta sintaxis --target=<ruta> y rechaza directorios existentes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-oracle-target-'));
  const originalExitCode = process.exitCode;
  const originalError = console.error;
  let capturedErr = '';
  console.error = (msg) => { capturedErr += msg + '\n'; };

  try {
    const specDir = path.join(tmpDir, 'docs', 'sdd', 'vsdd', '001-test');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'spec.md'), '## Requisitos funcionales\n### RF-01 Test\n- Entrada: X -> Salida: Y\n', 'utf8');

    const targetFile = path.join(tmpDir, 'test_out.ts');
    process.exitCode = 0;
    runOracle(['001-test', `--target=${targetFile}`], tmpDir);
    assert.equal(process.exitCode, 0);
    assert.equal(fs.existsSync(targetFile), true);

    // Intento con directorio existente
    process.exitCode = 0;
    capturedErr = '';
    runOracle(['001-test', `--target=${tmpDir}`], tmpDir);
    assert.equal(process.exitCode, 1);
    assert.match(capturedErr, /directorio existente/);
  } finally {
    console.error = originalError;
    process.exitCode = originalExitCode;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
