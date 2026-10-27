'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  saveFeatureContext,
  saveFeatureExploration,
  saveInterviewAnswer,
} = require('../scripts/lib/state');
const { assembleBrief } = require('../scripts/lib/harness/brief');
const { parseCliCommand } = require('../scripts/cli');
const { spawnSync } = require('node:child_process');

function createTempFeatureFixture() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-harness-t01-'));
  const featureDir = path.join(tmpRoot, 'docs', 'sdd', 'vsdd', '001-test-harness-tribunal');
  fs.mkdirSync(featureDir, { recursive: true });

  const ideaContent = [
    '# Idea 001: Test Harness Antifraude',
    '',
    'Estado: listo-para-spec',
    '',
    '## Problema',
    'El mismo subagente escribe tests y codigo de produccion generando conflicto de interes.',
    '',
    '## Qué vamos a hacer',
    'Separar el Autor de Tests del Implementador mediante sellado SHA-256 y contexto por trazabilidad.',
    '',
    '## En alcance / Fuera de alcance',
    '- **En alcance:** CLI determinista en 0 tokens.',
    '- **Fuera de alcance:** Motores externos de mutation testing.',
    '',
    '## Listo cuando',
    '- El CLI ensambla el contexto por trazabilidad y sella tests en Rojo.',
    '',
  ].join('\n');

  const specContent = [
    '# Spec 001 Test Harness Antifraude',
    '',
    'Estado: listo-para-plan',
    '',
    '## Requisitos funcionales',
    '',
    '### RF-01 Ensamblar contexto compartido y corte específico de tarea',
    '- Cuando el CLI recibe la solicitud de briefing para una tarea, el sistema debe ensamblar el Contexto Compartido Global con el Corte Específico.',
    '- El Corte Específico debe incluir las tablas completas de Example Mapping sin truncar líneas.',
    '',
    '| Escenario | Entrada | Resultado esperado |',
    '| :--- | :--- | :--- |',
    '| Tarea válida con caché fría | `vsdd harness brief TASK-01` | Emite contexto compartido + RF-01 íntegro + DT-01 + DT-02 |',
    '| Tarea con tabla extensa fila 2 | `TASK-01 --json` | Conserva todas las filas de Example Mapping sin recortar |',
    '| Tarea inexistente | `vsdd harness brief TASK-99` | Error descriptivo con lista de tareas válidas |',
    '',
    '### RF-02 Sellar archivos de pruebas en Rojo',
    '- Cuando el Autor de Tests finaliza, el comando sella el archivo en estado Rojo con SHA-256.',
    '',
    '## Requisitos no funcionales',
    '- Rendimiento y economía de tokens: menos de 100 ms y 0 tokens de LLM.',
    '',
    '## Límites y exclusiones (Non-Goals y Anti-Goals)',
    '',
    '### Fuera de alcance (Non-Goals)',
    '- No instalar librerías externas de mutation testing.',
    '',
    '### Anti-objetivos e invariantes prohibidas (Anti-Goals)',
    '- Prohibido que el Implementador modifique archivos de pruebas sellados.',
    '- Prohibido truncar tablas de Example Mapping por conteo arbitrario de líneas.',
    '',
  ].join('\n');

  const planContent = [
    '# Plan 001 Test Harness Antifraude',
    '',
    'Estado: listo-para-tareas',
    '',
    '## Módulos y arquitectura',
    '- **Ensamblador (`scripts/lib/harness/brief.js`):** Construye y cachea el Contexto Compartido Global.',
    '',
    '## Modelo de datos',
    '```json',
    '{ "harness": { "testCommand": "node --test" } }',
    '```',
    '',
    '## Algoritmos y lógica de negocio',
    '```text',
    'FUNCIÓN buildTaskBrief(featureDir, taskId):',
    '  1. Validar taskId en tasks.md.',
    '  2. Cachear sharedBrief por mtimeMs.',
    '```',
    '',
    '## Decisiones técnicas',
    '',
    '### DT-01 Persistencia unificada del Harness en context.json',
    '- **Decisión:** Almacenar estado bajo la clave `harness` en `context.json`.',
    '- **Cubre:** RF-01, RF-02',
    '',
    '### DT-02 Ensamblaje de contexto en dos tiempos con invalidación por mtime',
    '- **Decisión:** Cachear Contexto Compartido Global e invalidar si cambia `mtime` de `idea.md`, `spec.md` o `plan.md`.',
    '- **Cubre:** RF-01',
    '',
    '### DT-03 Runner de pruebas agnóstico',
    '- **Decisión:** Autodetectar runner del proyecto.',
    '- **Cubre:** RF-02',
    '',
    '## Árbol de cambios',
    '- `~ scripts/lib/state.js`',
    '- `+ scripts/lib/harness/brief.js`',
    '- `+ tests/vsdd-harness.test.js`',
    '',
  ].join('\n');

  const tasksContent = [
    '# Tareas 001 Test Harness Antifraude',
    '',
    'Estado: listo-para-aplicar',
    '',
    '## Reglas de ejecución',
    '- **TDD estricto:** cada tarea define y ejecuta primero la prueba en Rojo.',
    '',
    '## Fase 1: Core Vertical Slice',
    '',
    '- [x] **TASK-00: Preparación de contrato base en estado**',
    '  - **Qué:** Inicializa estructura base de pruebas.',
    '  - **Cubre:** DT-01',
    '',
    '- [ ] **TASK-01: Ensamblador de Contexto Compartido y Corte de Tarea con persistencia en context.json**',
    '  - **Qué:** Extiende `scripts/lib/state.js` e implementa `scripts/lib/harness/brief.js`.',
    '  - **Cubre:** RF-01, DT-01, DT-02, RNF (Rendimiento y 0 tokens)',
    '  - **Archivos:** `~ scripts/lib/state.js`, `+ scripts/lib/harness/brief.js`, `+ tests/vsdd-harness.test.js`',
    '  - **Listo cuando:** Las pruebas unitarias pasan en verde en menos de 100 ms.',
    '',
    '- [ ] **TASK-02: Enrutamiento de vsdd harness brief en CLI**',
    '  - **Qué:** Crea `scripts/vsdd-harness.js`.',
    '  - **Cubre:** RF-02, DT-03',
    '',
  ].join('\n');

  const memoryContent = JSON.stringify(
    {
      version: '1.0',
      entries: [
        {
          id: 'MEM-01',
          fact: 'El repositorio utiliza node:test nativo sin dependencias externas.',
          anchor: 'package.json',
        },
      ],
    },
    null,
    2
  );

  fs.writeFileSync(path.join(featureDir, 'idea.md'), ideaContent, 'utf8');
  fs.writeFileSync(path.join(featureDir, 'spec.md'), specContent, 'utf8');
  fs.writeFileSync(path.join(featureDir, 'plan.md'), planContent, 'utf8');
  fs.writeFileSync(path.join(featureDir, 'tasks.md'), tasksContent, 'utf8');
  fs.writeFileSync(path.join(tmpRoot, 'docs', 'sdd', 'vsdd', 'repo-memory.json'), memoryContent, 'utf8');

  return { tmpRoot, featureDir };
}

test('saveFeatureContext preserva e hidrata el objeto harness sin perder datos al actualizar phases o interviews', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const initial = saveFeatureContext(
      featureDir,
      {
        harness: {
          testCommand: 'node --test',
          sharedBrief: {
            content: '# Brief Inicial',
            sourceMtimes: { idea: 100, spec: 200, plan: 300 },
          },
          seals: {
            'tests/vsdd-harness.test.js': {
              sha256: 'abc123def456',
              taskId: 'TASK-01',
              status: 'locked',
            },
          },
          tasks: {
            'TASK-01': { attempts: 1, maxAttempts: 3, status: 'in-progress' },
          },
          appeals: [
            { id: 'APPEAL-01', taskId: 'TASK-01', status: 'pending' },
          ],
        },
      },
      tmpRoot
    );

    assert.equal(initial.harness.testCommand, 'node --test');
    assert.equal(initial.harness.sharedBrief.content, '# Brief Inicial');
    assert.equal(initial.harness.seals['tests/vsdd-harness.test.js'].sha256, 'abc123def456');
    assert.equal(initial.harness.tasks['TASK-01'].attempts, 1);
    assert.equal(initial.harness.appeals.length, 1);

    // Actualizar phases e interview sin pasar harness explícito
    saveFeatureExploration(featureDir, 'spec', { summary: 'Exploración spec' }, tmpRoot);
    const afterInterview = saveInterviewAnswer(
      featureDir,
      'spec',
      { index: 1, topic: 'Alcance', question: '¿Límite?', answer: 'Sin truncar líneas' },
      tmpRoot
    );

    assert.equal(afterInterview.harness.testCommand, 'node --test');
    assert.equal(afterInterview.harness.sharedBrief.content, '# Brief Inicial');
    assert.deepEqual(afterInterview.harness.sharedBrief.sourceMtimes, {
      idea: 100,
      spec: 200,
      plan: 300,
    });
    assert.equal(
      afterInterview.harness.seals['tests/vsdd-harness.test.js'].sha256,
      'abc123def456'
    );
    assert.equal(afterInterview.harness.tasks['TASK-01'].attempts, 1);
    assert.equal(afterInterview.harness.appeals[0].id, 'APPEAL-01');
    assert.equal(afterInterview.phases.spec.interview.questions[0].answer, 'Sin truncar líneas');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('assembleBrief genera Contexto Compartido Global + Corte Específico íntegro y lo persiste con sourceMtimes', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const result = assembleBrief(featureDir, 'TASK-01');

    assert.equal(result.cacheHit, false);
    assert.equal(result.meta.cacheHit, false);

    // Verificar persistencia en context.json bajo harness.sharedBrief con sourceMtimes
    const contextJson = JSON.parse(
      fs.readFileSync(path.join(featureDir, 'context.json'), 'utf8')
    );
    assert.equal(typeof contextJson.harness.sharedBrief.content, 'string');
    assert.equal(typeof contextJson.harness.sharedBrief.sourceMtimes.idea, 'number');
    assert.equal(typeof contextJson.harness.sharedBrief.sourceMtimes.spec, 'number');
    assert.equal(typeof contextJson.harness.sharedBrief.sourceMtimes.plan, 'number');

    // Contexto Compartido Global: Objetivo de negocio, Diseño técnico, Pseudocódigo y reglas, Anti-Goals y Memoria
    assert.match(result.sharedBrief, /El mismo subagente escribe tests y codigo de produccion/);
    assert.match(result.sharedBrief, /FUNCIÓN buildTaskBrief\(featureDir, taskId\):/);
    assert.match(result.sharedBrief, /TDD estricto/);
    assert.match(result.sharedBrief, /Prohibido que el Implementador modifique archivos de pruebas sellados/);
    assert.match(result.sharedBrief, /El repositorio utiliza node:test nativo sin dependencias externas/);

    // Corte Específico de TASK-01: bloque TASK-01, RF-01 con tabla Example Mapping íntegra, DT-01, DT-02 y tareas previas [x]
    assert.match(result.taskSlice, /TASK-01: Ensamblador de Contexto Compartido/);
    assert.match(result.taskSlice, /### RF-01 Ensamblar contexto compartido y corte específico de tarea/);
    assert.match(result.taskSlice, /\| Tarea con tabla extensa fila 2 \| `TASK-01 --json` \| Conserva todas las filas de Example Mapping sin recortar \|/);
    assert.match(result.taskSlice, /### DT-01 Persistencia unificada del Harness en context\.json/);
    assert.match(result.taskSlice, /### DT-02 Ensamblaje de contexto en dos tiempos con invalidación por mtime/);
    assert.match(result.taskSlice, /TASK-00: Preparación de contrato base en estado/);

    // Ruido filtrado del corte específico: no debe incluir TASK-02 incompleta ni RF-02 ni DT-03 ajenos
    assert.doesNotMatch(result.taskSlice, /TASK-02: Enrutamiento de vsdd harness brief en CLI/);
    assert.doesNotMatch(result.taskSlice, /### RF-02 Sellar archivos de pruebas en Rojo/);
    assert.doesNotMatch(result.taskSlice, /### DT-03 Runner de pruebas agnóstico/);

    // fullText combina ambos bloques
    assert.ok(result.fullText.includes(result.sharedBrief));
    assert.ok(result.fullText.includes(result.taskSlice));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('assembleBrief reutiliza la caché en segunda llamada e invalida cuando cambia mtime de spec.md', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const first = assembleBrief(featureDir, 'TASK-01');
    assert.equal(first.cacheHit, false);

    const second = assembleBrief(featureDir, 'TASK-01');
    assert.equal(second.cacheHit, true);
    assert.equal(second.sharedBrief, first.sharedBrief);

    // Modificar spec.md (contenido y mtime)
    const specPath = path.join(featureDir, 'spec.md');
    const updatedSpec =
      fs.readFileSync(specPath, 'utf8') +
      '\n- Prohibido usar mocks en memoria para el sistema de archivos.\n';
    fs.writeFileSync(specPath, updatedSpec, 'utf8');
    const futureTime = new Date(Date.now() + 5000);
    fs.utimesSync(specPath, futureTime, futureTime);

    const third = assembleBrief(featureDir, 'TASK-01');
    assert.equal(third.cacheHit, false);
    assert.match(
      third.sharedBrief,
      /Prohibido usar mocks en memoria para el sistema de archivos/
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('assembleBrief lanza error descriptivo con tareas válidas cuando la tarea solicitada no existe en tasks.md', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    assert.throws(
      () => assembleBrief(featureDir, 'TASK-99'),
      (err) => {
        assert.match(err.message, /TASK-99/);
        assert.match(err.message, /tasks\.md/);
        assert.match(err.message, /TASK-01/);
        return true;
      }
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('cli: parseCliCommand(["harness", "brief", "TASK-01"]) rutea a vsdd-harness.js con action run', () => {
  const parsed = parseCliCommand(['harness', 'brief', 'TASK-01']);
  assert.equal(parsed.action, 'run');
  assert.ok(parsed.script.endsWith('vsdd-harness.js'));
  assert.deepEqual(parsed.args, ['brief', 'TASK-01']);
});

test('vsdd-harness brief: ejecución exportada y por CLI emite briefing (texto <=80 cols en cabecera y --json) con código 0', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const { runHarness, formatBriefHeader } = require('../scripts/vsdd-harness');

    // Ejecución por función exportada con autodescubrimiento de feature en cwd
    const textRes = runHarness(['brief', 'TASK-01'], { cwd: tmpRoot });
    assert.equal(textRes.exitCode, 0);
    assert.match(textRes.stdout, /Contexto Compartido Global/);
    assert.match(textRes.stdout, /Corte Específico de Tarea: TASK-01/);

    // Verificar que todas las líneas de la cabecera/caja de resumen tienen <= 80 columnas
    const headerLines = formatBriefHeader(textRes.data).split('\n');
    assert.ok(headerLines.length >= 3);
    for (const line of headerLines) {
      assert.ok(
        line.length <= 80,
        `Línea de cabecera excede 80 columnas (${line.length}): ${line}`
      );
    }

    // Ejecución real desde CLI con --feature y --json
    const cliPath = path.resolve(__dirname, '..', 'scripts', 'cli.js');
    const proc = spawnSync(
      process.execPath,
      [cliPath, 'harness', 'brief', 'TASK-01', '--feature', featureDir, '--json'],
      { cwd: tmpRoot, encoding: 'utf8' }
    );

    assert.equal(proc.status, 0);
    const parsedJson = JSON.parse(proc.stdout);
    assert.equal(parsedJson.cacheHit, true);
    assert.equal(parsedJson.meta.taskId, 'TASK-01');
    assert.match(parsedJson.taskSlice, /### RF-01 Ensamblar contexto compartido/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('vsdd-harness brief: falla con código 1 y mensaje descriptivo en stderr ante tarea inexistente o sin argumentos', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const { runHarness } = require('../scripts/vsdd-harness');

    // Sin argumentos requeridos
    const missingTask = runHarness(['brief'], { cwd: tmpRoot });
    assert.equal(missingTask.exitCode, 1);
    assert.match(missingTask.stderr, /TASK-/i);

    // Tarea inexistente desde CLI
    const cliPath = path.resolve(__dirname, '..', 'scripts', 'cli.js');
    const proc = spawnSync(
      process.execPath,
      [cliPath, 'harness', 'brief', 'TASK-99', '--feature', featureDir],
      { cwd: tmpRoot, encoding: 'utf8' }
    );

    assert.equal(proc.status, 1);
    assert.match(proc.stderr, /TASK-99/);
    assert.match(proc.stderr, /tasks\.md/);
    assert.match(proc.stderr, /TASK-01/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('analyzer.inspectTestPurity: rechaza modificadores skip/todo/ignore en múltiples lenguajes', () => {
  const { inspectTestPurity } = require('../scripts/lib/harness/analyzer');

  const skipSamples = [
    "test.skip('omite prueba', () => { assert.equal(1, 1); });",
    "it.todo('pendiente de implementar');",
    "test.todo('pendiente');",
    "xit('desactivado temporalmente', () => { expect(1).toBe(1); });",
    "xdescribe('suite omitida', () => {});",
    "@pytest.mark.skip(reason='no listo')\ndef test_algo():\n    assert suma(1, 2) == 3",
    'func TestAlgo(t *testing.T) {\n  t.Skip("omitido")\n}',
    '#[test]\n#[ignore]\nfn test_rust() { assert_eq!(2, 2); }',
  ];

  for (const sample of skipSamples) {
    const res = inspectTestPurity(sample);
    assert.equal(res.valid, false, `Debió rechazar muestra con skip/todo: ${sample}`);
    assert.ok(res.violations.some((v) => v.type === 'test-skip'));
  }
});

test('analyzer.inspectTestPurity: rechaza aserciones cosméticas o ausencia de aserciones y aprueba tests reales', () => {
  const { inspectTestPurity } = require('../scripts/lib/harness/analyzer');

  const cosmeticSamples = [
    "test('cosmético 1', () => { expect(fn()).toBeDefined(); });",
    "test('cosmético 2', () => { expect(fn()).toBeTruthy(); });",
    "test('cosmético 3', () => { expect(fn()).not.toBeNull(); });",
    "test('cosmético 4', () => { expect(true).toBe(true); });",
    "test('cosmético 5', () => { assert.ok(true); });",
    "test('sin aserciones', () => { const x = calcular(5); console.log(x); });",
  ];

  for (const sample of cosmeticSamples) {
    const res = inspectTestPurity(sample);
    assert.equal(res.valid, false, `Debió rechazar muestra cosmética/vacía: ${sample}`);
    assert.ok(
      res.violations.some(
        (v) => v.type === 'cosmetic-assertion' || v.type === 'missing-real-assertion'
      )
    );
  }

  const validSample = [
    "test('calcula impuesto correctamente', () => {",
    "  assert.equal(calcularImpuesto(100), 116);",
    "  assert.deepEqual(desglosar(100), { base: 100, iva: 16 });",
    "  assert.match(formatearMoneda(116), /\\$116\\.00/);",
    "  assert.throws(() => calcularImpuesto(-1), /monto invalido/);",
    '});',
  ].join('\n');

  const cleanRes = inspectTestPurity(validSample);
  assert.equal(cleanRes.valid, true);
  assert.equal(cleanRes.violations.length, 0);
});

test('analyzer.inspectProductionCode: detecta funciones > 50 líneas efectivas en JS y Python', () => {
  const { inspectProductionCode } = require('../scripts/lib/harness/analyzer');

  const jsLines = ['function procesarFacturaGigante(items) {'];
  for (let i = 1; i <= 52; i += 1) {
    jsLines.push(`  const paso${i} = items.length + ${i};`);
  }
  jsLines.push('  return paso52;');
  jsLines.push('}');

  const jsRes = inspectProductionCode(jsLines.join('\n'));
  assert.equal(jsRes.valid, false);
  assert.ok(
    jsRes.violations.some(
      (v) => v.type === 'function-too-long' && v.name === 'procesarFacturaGigante'
    )
  );

  const pyLines = ['def procesar_lote_extenso(datos):'];
  for (let i = 1; i <= 52; i += 1) {
    pyLines.push(`    acumulado_${i} = len(datos) + ${i}`);
  }
  pyLines.push('    return acumulado_52');

  const pyRes = inspectProductionCode(pyLines.join('\n'));
  assert.equal(pyRes.valid, false);
  assert.ok(
    pyRes.violations.some(
      (v) => v.type === 'function-too-long' && v.name === 'procesar_lote_extenso'
    )
  );
});

test('analyzer.inspectProductionCode: detecta anidamiento > 3 niveles, catch vacíos, supresores y literales espejo', () => {
  const {
    extractTestLiterals,
    inspectProductionCode,
    inspectProductionDiff,
  } = require('../scripts/lib/harness/analyzer');

  const testCode = [
    "test('valida cupon corporativo', () => {",
    "  assert.equal(aplicarCupon('CUPON-MEGA-SECRETO-2026'), 'DESCUENTO-AUTORIZADO-99');",
    '});',
  ].join('\n');

  const literals = extractTestLiterals(testCode);
  assert.ok(literals.includes('CUPON-MEGA-SECRETO-2026'));
  assert.ok(literals.includes('DESCUENTO-AUTORIZADO-99'));

  const badProdCode = [
    '// @ts-ignore',
    'function evaluarReglasComplejas(entrada) {',
    '  try {',
    '    if (entrada.activo) {',
    '      for (const item of entrada.lista) {',
    '        while (item.intentos > 0) {',
    '          if (item.codigo === "CUPON-MEGA-SECRETO-2026") {',
    '            return "DESCUENTO-AUTORIZADO-99";',
    '          }',
    '        }',
    '      }',
    '    }',
    '  } catch (err) {}',
    '  return null;',
    '}',
  ].join('\n');

  const res = inspectProductionDiff(badProdCode, literals);
  assert.equal(res.valid, false);
  assert.ok(res.violations.some((v) => v.type === 'excessive-nesting'));
  assert.ok(res.violations.some((v) => v.type === 'empty-catch'));
  assert.ok(res.violations.some((v) => v.type === 'type-suppressor'));
  assert.ok(
    res.violations.some(
      (v) =>
        v.type === 'hardcoded-test-literal' &&
        v.literal === 'CUPON-MEGA-SECRETO-2026'
    )
  );

  // Código limpio y el propio analyzer.js deben aprobar sin violaciones
  const cleanProdCode = [
    'function calcularTotalLimpio(items) {',
    '  if (!Array.isArray(items)) {',
    '    return 0;',
    '  }',
    '  try {',
    '    return items.reduce((acc, item) => acc + item.precio, 0);',
    '  } catch (err) {',
    '    return -1;',
    '  }',
    '}',
  ].join('\n');

  const cleanRes = inspectProductionCode(cleanProdCode, literals);
  assert.equal(cleanRes.valid, true);
  assert.equal(cleanRes.violations.length, 0);

  const selfCode = fs.readFileSync(
    path.resolve(__dirname, '..', 'scripts', 'lib', 'harness', 'analyzer.js'),
    'utf8'
  );
  const selfRes = inspectProductionCode(selfCode, []);
  assert.equal(
    selfRes.valid,
    true,
    `analyzer.js debe aprobarse a sí mismo sin violaciones: ${JSON.stringify(selfRes.violations)}`
  );
});

test('seal.sealTestFile (Caso 1): sella en Rojo con SHA-256, registra literals y vincula taskId en context.json', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const { sealTestFile } = require('../scripts/lib/harness/seal');
    const testsDir = path.join(tmpRoot, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });
    const relTestPath = 'tests/descuento.test.js';
    const absTestPath = path.join(tmpRoot, relTestPath);

    fs.writeFileSync(
      absTestPath,
      [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "test('aplica cupon', () => {",
        "  assert.equal(calcular('CUPON-INVIERNO-2026'), 'REBAJA-APLICADA-50');",
        '});',
      ].join('\n'),
      'utf8'
    );

    const res = sealTestFile(featureDir, relTestPath, {
      cwd: tmpRoot,
      taskId: 'TASK-01',
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'ReferenceError: calcular is not defined' }),
    });

    assert.equal(res.ok, true);
    assert.equal(res.redVerified, true);
    assert.equal(res.redExitCode, 1);
    assert.match(res.sha256, /^[a-f0-9]{64}$/);
    assert.ok(res.literals.includes('CUPON-INVIERNO-2026'));

    const ctx = JSON.parse(fs.readFileSync(path.join(featureDir, 'context.json'), 'utf8'));
    const sealEntry = ctx.harness.seals[relTestPath];
    assert.equal(sealEntry.sha256, res.sha256);
    assert.equal(sealEntry.redExitCode, 1);
    assert.equal(sealEntry.taskId, 'TASK-01');
    assert.equal(sealEntry.status, 'locked');
    assert.ok(sealEntry.literals.includes('REBAJA-APLICADA-50'));
    assert.equal(ctx.harness.testCommand, 'node --test');
    assert.equal(ctx.harness.tasks['TASK-01'].testFile, relTestPath);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('seal.sealTestFile y CLI (Casos 2 y 3): rechaza si pasa en Verde antes de implementar o si el test es impuro', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const { sealTestFile } = require('../scripts/lib/harness/seal');
    const { runHarness } = require('../scripts/vsdd-harness');
    const testsDir = path.join(tmpRoot, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });

    // Caso 2: Pasa en Verde (exitCode === 0)
    const greenTestRel = 'tests/pasa-verde.test.js';
    fs.writeFileSync(
      path.join(tmpRoot, greenTestRel),
      "test('falso positivo', () => { assert.equal(2 + 2, 4); });",
      'utf8'
    );

    const greenRes = sealTestFile(featureDir, greenTestRel, {
      cwd: tmpRoot,
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 0, stdout: 'PASS', stderr: '' }),
    });
    assert.equal(greenRes.ok, false);
    assert.match(greenRes.errors.join(' '), /verde|Red Gate/i);

    // Caso 3: Impureza del test (.skip / toBeDefined) rechazado antes de sellar y desde CLI
    const impureTestRel = 'tests/impuro.test.js';
    fs.writeFileSync(
      path.join(tmpRoot, impureTestRel),
      "test.skip('trampa con skip', () => { expect(fn()).toBeDefined(); });",
      'utf8'
    );

    const cliRes = runHarness(
      ['seal', impureTestRel, '--task', 'TASK-01', '--feature', featureDir, '--cmd', 'node --test'],
      { cwd: tmpRoot }
    );
    assert.equal(cliRes.exitCode, 1);
    assert.match(cliRes.stderr, /omisión|skip|cosmética/i);

    const ctxPath = path.join(featureDir, 'context.json');
    if (fs.existsSync(ctxPath)) {
      const ctx = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      assert.equal(ctx.harness.seals[impureTestRel], undefined);
      assert.equal(ctx.harness.seals[greenTestRel], undefined);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('seal.detectTestCommand y timeout (Casos 4 y 5): autodetecta manifiestos, soporta --cmd y rechaza timeout de 30s', () => {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  try {
    const { detectTestCommand, sealTestFile } = require('../scripts/lib/harness/seal');
    const { inspectProductionCode } = require('../scripts/lib/harness/analyzer');

    // Sin manifiesto ni --cmd lanza error descriptivo
    assert.throws(() => detectTestCommand(tmpRoot), /manifiesto|package\.json|--cmd/i);

    // Cargo.toml
    fs.writeFileSync(path.join(tmpRoot, 'Cargo.toml'), '[package]\nname = "demo"\n', 'utf8');
    assert.equal(detectTestCommand(tmpRoot), 'cargo test');
    fs.unlinkSync(path.join(tmpRoot, 'Cargo.toml'));

    // go.mod
    fs.writeFileSync(path.join(tmpRoot, 'go.mod'), 'module example.com/demo\n', 'utf8');
    assert.equal(detectTestCommand(tmpRoot), 'go test ./...');
    fs.unlinkSync(path.join(tmpRoot, 'go.mod'));

    // pyproject.toml
    fs.writeFileSync(path.join(tmpRoot, 'pyproject.toml'), '[tool.pytest]\n', 'utf8');
    assert.equal(detectTestCommand(tmpRoot), 'pytest');
    fs.unlinkSync(path.join(tmpRoot, 'pyproject.toml'));

    // package.json
    fs.writeFileSync(
      path.join(tmpRoot, 'package.json'),
      JSON.stringify({ scripts: { test: 'node --test' } }),
      'utf8'
    );
    assert.equal(detectTestCommand(tmpRoot), 'node --test');
    assert.equal(detectTestCommand(tmpRoot, 'npx vitest run'), 'npx vitest run');

    // Caso 5: Timeout de 30s
    const testsDir = path.join(tmpRoot, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });
    const timeoutTestRel = 'tests/bucle.test.js';
    fs.writeFileSync(
      path.join(tmpRoot, timeoutTestRel),
      "test('bucle infinito', () => { assert.equal(fn(), 42); });",
      'utf8'
    );

    const timeoutRes = sealTestFile(featureDir, timeoutTestRel, {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: null, timedOut: true, error: { code: 'ETIMEDOUT' } }),
    });
    assert.equal(timeoutRes.ok, false);
    assert.equal(timeoutRes.timedOut, true);
    assert.match(timeoutRes.errors.join(' '), /timeout|30s/i);

    // Autoverificación de higiene en seal.js y vsdd-harness.js
    const sealCode = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'lib', 'harness', 'seal.js'),
      'utf8'
    );
    const harnessCliCode = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'vsdd-harness.js'),
      'utf8'
    );
    assert.equal(inspectProductionCode(sealCode, []).valid, true);
    assert.equal(inspectProductionCode(harnessCliCode, []).valid, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

function createGitTaskFixture() {
  const { tmpRoot, featureDir } = createTempFeatureFixture();
  const srcDir = path.join(tmpRoot, 'src');
  const testsDir = path.join(tmpRoot, 'tests');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(testsDir, { recursive: true });

  const prodRel = 'src/calculadora.js';
  const testRel = 'tests/calculadora.test.js';
  const unrelatedRel = 'notas-usuario.txt';

  fs.writeFileSync(
    path.join(tmpRoot, prodRel),
    "'use strict';\nfunction calcular(x) {\n  return 0;\n}\nmodule.exports = { calcular };\n",
    'utf8'
  );
  fs.writeFileSync(path.join(tmpRoot, unrelatedRel), 'v1 original del usuario\n', 'utf8');

  // Actualizar tasks.md del fixture para que TASK-01 autorice src/calculadora.js y tests/calculadora.test.js
  const tasksPath = path.join(featureDir, 'tasks.md');
  const updatedTasks = fs
    .readFileSync(tasksPath, 'utf8')
    .replace(
      '- **Archivos:** `~ scripts/lib/state.js`, `+ scripts/lib/harness/brief.js`, `+ tests/vsdd-harness.test.js`',
      `- **Archivos:** \`~ ${prodRel}\`, \`+ ${testRel}\``
    );
  fs.writeFileSync(tasksPath, updatedTasks, 'utf8');

  spawnSync('git', ['init'], { cwd: tmpRoot });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpRoot });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpRoot });
  spawnSync('git', ['add', '.'], { cwd: tmpRoot });
  spawnSync('git', ['commit', '-m', 'chore: initial fixture'], { cwd: tmpRoot });

  fs.writeFileSync(
    path.join(tmpRoot, testRel),
    [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const { calcular } = require('../src/calculadora');",
      "test('aplica tarifa especial', () => {",
      "  assert.equal(calcular('TARIFA-CORPORATIVA-2026'), 'BONO-AUTORIZADO-77');",
      '});',
    ].join('\n'),
    'utf8'
  );

  return { tmpRoot, featureDir, prodRel, testRel, unrelatedRel };
}

test('verify.verifyTask (Casos 1, 2 y 3): detecta INTEGRITY_VIOLATION, TEST_FAILED y HYGIENE_VIOLATION', () => {
  const { tmpRoot, featureDir, prodRel, testRel } = createGitTaskFixture();
  try {
    const { sealTestFile } = require('../scripts/lib/harness/seal');
    const { verifyTask } = require('../scripts/lib/harness/verify');

    const sealRes = sealTestFile(featureDir, testRel, {
      cwd: tmpRoot,
      taskId: 'TASK-01',
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    });
    assert.equal(sealRes.ok, true);

    // Caso 1: Adulteración del archivo de test sellado -> INTEGRITY_VIOLATION
    const originalTest = fs.readFileSync(path.join(tmpRoot, testRel), 'utf8');
    fs.writeFileSync(
      path.join(tmpRoot, testRel),
      originalTest.replace('BONO-AUTORIZADO-77', 'BONO-TRAMPA-00'),
      'utf8'
    );

    const integrityRes = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 0, stdout: 'PASS', stderr: '' }),
    });
    assert.equal(integrityRes.ok, false);
    assert.equal(integrityRes.reason, 'INTEGRITY_VIOLATION');

    // Restaurar test legítimo
    fs.writeFileSync(path.join(tmpRoot, testRel), originalTest, 'utf8');

    // Caso 2: El test sigue fallando -> TEST_FAILED
    const failRes = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'AssertionError' }),
    });
    assert.equal(failRes.ok, false);
    assert.equal(failRes.reason, 'TEST_FAILED');

    // Caso 3: Test pasa en Verde pero el código productivo tiene literal espejo y catch vacío -> HYGIENE_VIOLATION
    fs.writeFileSync(
      path.join(tmpRoot, prodRel),
      [
        'function calcular(x) {',
        '  try {',
        '    if (x === "TARIFA-CORPORATIVA-2026") return "BONO-AUTORIZADO-77";',
        '  } catch (err) {}',
        '  return 0;',
        '}',
        'module.exports = { calcular };',
      ].join('\n'),
      'utf8'
    );

    const hygieneRes = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 0, stdout: 'PASS', stderr: '' }),
    });
    assert.equal(hygieneRes.ok, false);
    assert.equal(hygieneRes.reason, 'HYGIENE_VIOLATION');
    assert.ok(hygieneRes.violations.some((v) => v.type === 'hardcoded-test-literal'));
    assert.ok(hygieneRes.violations.some((v) => v.type === 'empty-catch'));
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('verify.verifyTask (Casos 4 y 5): aplica cortacircuitos 2+1 con git restore quirúrgico y aprueba en Verde', () => {
  const { tmpRoot, featureDir, prodRel, testRel, unrelatedRel } = createGitTaskFixture();
  try {
    const { sealTestFile } = require('../scripts/lib/harness/seal');
    const { verifyTask } = require('../scripts/lib/harness/verify');
    const { runHarness } = require('../scripts/vsdd-harness');
    const { inspectProductionCode } = require('../scripts/lib/harness/analyzer');

    sealTestFile(featureDir, testRel, {
      cwd: tmpRoot,
      taskId: 'TASK-01',
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    });

    // Modificar archivo ajeno del usuario (NUNCA debe ser revertido por el harness)
    fs.writeFileSync(path.join(tmpRoot, unrelatedRel), 'cambio valioso del usuario no tocado\n', 'utf8');
    // Ensuciar archivo de producción autorizado en Intento 1
    fs.writeFileSync(path.join(tmpRoot, prodRel), '// intento 1 sucio\nmodule.exports = {};\n', 'utf8');

    // Fallo #1: attempts === 1, status: retrying, rollbackExecuted: false
    const attempt1 = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fallo 1' }),
    });
    assert.equal(attempt1.ok, false);
    assert.equal(attempt1.attempt, 1);
    assert.equal(attempt1.status, 'retrying');
    assert.equal(attempt1.rollbackExecuted, false);
    assert.equal(attempt1.analystRequired, false);
    assert.match(fs.readFileSync(path.join(tmpRoot, prodRel), 'utf8'), /intento 1 sucio/);

    // Fallo #2: attempts === 2, status: clean_retry_required, rollbackExecuted: true
    fs.writeFileSync(path.join(tmpRoot, prodRel), '// intento 2 espagueti\nmodule.exports = {};\n', 'utf8');
    const attempt2 = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fallo 2' }),
    });
    assert.equal(attempt2.ok, false);
    assert.equal(attempt2.attempt, 2);
    assert.equal(attempt2.status, 'clean_retry_required');
    assert.equal(attempt2.rollbackExecuted, true);
    assert.equal(attempt2.analystRequired, false);

    // El archivo productivo volvió a HEAD limpio, pero el test y el archivo ajeno siguen intactos
    assert.doesNotMatch(fs.readFileSync(path.join(tmpRoot, prodRel), 'utf8'), /intento 2 espagueti/);
    assert.match(fs.readFileSync(path.join(tmpRoot, prodRel), 'utf8'), /function calcular\(x\)/);
    assert.equal(
      fs.readFileSync(path.join(tmpRoot, unrelatedRel), 'utf8'),
      'cambio valioso del usuario no tocado\n'
    );
    assert.ok(fs.existsSync(path.join(tmpRoot, testRel)));

    // Fallo #3: attempts === 3, status: blocked_analyst, rollbackExecuted: true, analystRequired: true
    fs.writeFileSync(path.join(tmpRoot, prodRel), '// intento 3 fallido\nmodule.exports = {};\n', 'utf8');
    const attempt3 = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fallo 3' }),
    });
    assert.equal(attempt3.ok, false);
    assert.equal(attempt3.attempt, 3);
    assert.equal(attempt3.status, 'blocked_analyst');
    assert.equal(attempt3.rollbackExecuted, true);
    assert.equal(attempt3.analystRequired, true);
    assert.ok(attempt3.diagnostic.split('\n').length <= 12);
    assert.doesNotMatch(fs.readFileSync(path.join(tmpRoot, prodRel), 'utf8'), /intento 3 fallido/);

    // Caso 5: Implementación limpia que pasa en Verde desde CLI / runHarness
    fs.writeFileSync(
      path.join(tmpRoot, prodRel),
      [
        "'use strict';",
        'function calcular(codigo) {',
        '  const prefijo = String(codigo || "").split("-")[0];',
        '  const sufijo = "AUTORIZADO-77";',
        '  return prefijo === "TARIFA" ? `BONO-${sufijo}` : "";',
        '}',
        'module.exports = { calcular };',
      ].join('\n'),
      'utf8'
    );

    const cliOk = runHarness(['verify', 'TASK-01', '--feature', featureDir], {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 0, stdout: 'PASS', stderr: '' }),
    });
    assert.equal(cliOk.exitCode, 0);
    for (const line of cliOk.stdout.split('\n')) {
      assert.ok(line.length <= 80, `Línea excede 80 cols: ${line}`);
    }

    const ctx = JSON.parse(fs.readFileSync(path.join(featureDir, 'context.json'), 'utf8'));
    assert.equal(ctx.harness.tasks['TASK-01'].status, 'verified');

    const verifyCode = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'lib', 'harness', 'verify.js'),
      'utf8'
    );
    const harnessCliCode = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'vsdd-harness.js'),
      'utf8'
    );
    assert.equal(inspectProductionCode(verifyCode, []).valid, true);
    assert.equal(inspectProductionCode(harnessCliCode, []).valid, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('appeal.manageAppeal y CLI (Casos 1, 2 y 3): registra apelación, valida --reason/tarea y resuelve re-sellado', () => {
  const { tmpRoot, featureDir, testRel } = createGitTaskFixture();
  try {
    const { sealTestFile } = require('../scripts/lib/harness/seal');
    const { verifyTask } = require('../scripts/lib/harness/verify');
    const { runHarness } = require('../scripts/vsdd-harness');
    const { inspectProductionCode } = require('../scripts/lib/harness/analyzer');

    sealTestFile(featureDir, testRel, {
      cwd: tmpRoot,
      taskId: 'TASK-01',
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    });

    // Caso 1: Registro exitoso de apelación (soportando TASK-01 posicional y --reason)
    const appealRes = runHarness(
      [
        'appeal',
        'TASK-01',
        '--reason',
        'El test espera status 200 pero RF-02 exige 201',
        '--feature',
        featureDir,
      ],
      { cwd: tmpRoot }
    );
    assert.equal(appealRes.exitCode, 0);
    for (const line of appealRes.stdout.split('\n')) {
      assert.ok(line.length <= 80, `Línea excede 80 cols: ${line}`);
    }

    const ctxAfterAppeal = JSON.parse(
      fs.readFileSync(path.join(featureDir, 'context.json'), 'utf8')
    );
    assert.equal(ctxAfterAppeal.harness.appeals.length, 1);
    assert.equal(ctxAfterAppeal.harness.appeals[0].taskId, 'TASK-01');
    assert.equal(
      ctxAfterAppeal.harness.appeals[0].reason,
      'El test espera status 200 pero RF-02 exige 201'
    );
    assert.equal(ctxAfterAppeal.harness.tasks['TASK-01'].status, 'appealed');

    // Caso 2: Rechazo si falta --reason, si --reason es vacío o si la tarea no existe (TASK-99)
    const noReasonRes = runHarness(['appeal', 'TASK-01', '--feature', featureDir], {
      cwd: tmpRoot,
    });
    assert.equal(noReasonRes.exitCode, 1);
    assert.match(noReasonRes.stderr, /--reason|motivo/i);

    const emptyReasonRes = runHarness(
      ['appeal', 'TASK-01', '--reason', '   ', '--feature', featureDir],
      { cwd: tmpRoot }
    );
    assert.equal(emptyReasonRes.exitCode, 1);
    assert.match(emptyReasonRes.stderr, /--reason|motivo/i);

    const badTaskRes = runHarness(
      ['appeal', 'TASK-99', '--reason', 'Motivo válido', '--feature', featureDir],
      { cwd: tmpRoot }
    );
    assert.equal(badTaskRes.exitCode, 1);
    assert.match(badTaskRes.stderr, /TASK-99/);

    // Caso 3: Resolución aprobada (--status approved) abre candado, Autor corrige test y re-sella en Rojo
    const approveRes = runHarness(
      ['appeal', 'TASK-01', '--status', 'approved', '--feature', featureDir, '--json'],
      { cwd: tmpRoot }
    );
    assert.equal(approveRes.exitCode, 0);
    const approveJson = JSON.parse(approveRes.stdout);
    assert.equal(approveJson.appeal.status, 'approved');
    assert.equal(approveJson.sealStatus, 'unlocked');

    // El Autor de Tests corrige el test y lo vuelve a sellar en Rojo
    const updatedTest = fs
      .readFileSync(path.join(tmpRoot, testRel), 'utf8')
      .replace('BONO-AUTORIZADO-77', 'BONO-CORREGIDO-201');
    fs.writeFileSync(path.join(tmpRoot, testRel), updatedTest, 'utf8');

    const resealRes = sealTestFile(featureDir, testRel, {
      cwd: tmpRoot,
      taskId: 'TASK-01',
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    });
    assert.equal(resealRes.ok, true);

    // Ahora verifyTask acepta el nuevo hash sellado cuando la implementación pasa en Verde
    const verifyAfterReseal = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 0, stdout: 'PASS', stderr: '' }),
    });
    assert.equal(verifyAfterReseal.ok, true);
    assert.equal(verifyAfterReseal.status, 'verified');

    const appealCode = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'lib', 'harness', 'appeal.js'),
      'utf8'
    );
    const harnessCliCode = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'vsdd-harness.js'),
      'utf8'
    );
    assert.equal(inspectProductionCode(appealCode, []).valid, true);
    assert.equal(inspectProductionCode(harnessCliCode, []).valid, true);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('guías operativas (Caso 4): SKILL.md y references documentan vsdd harness, Autor vs Implementador, Tribunal 3+1 y Analista 2+1', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const skillMd = fs.readFileSync(path.join(repoRoot, 'SKILL.md'), 'utf8');
  const tasksMd = fs.readFileSync(path.join(repoRoot, 'references', 'tasks.md'), 'utf8');
  const applyMd = fs.readFileSync(path.join(repoRoot, 'references', 'apply.md'), 'utf8');
  const verifyMd = fs.readFileSync(path.join(repoRoot, 'references', 'verify.md'), 'utf8');

  for (const [name, content] of [
    ['SKILL.md', skillMd],
    ['references/tasks.md', tasksMd],
    ['references/apply.md', applyMd],
    ['references/verify.md', verifyMd],
  ]) {
    assert.match(content, /vsdd harness/, `${name} debe documentar vsdd harness`);
    assert.match(content, /Autor de Tests/i, `${name} debe documentar el rol Autor de Tests`);
    assert.match(content, /Implementador/i, `${name} debe documentar el rol Implementador`);
  }

  // Subcomandos brief, seal, verify, appeal y protocolo 2+1 + Analista + Tribunal 3+1
  assert.match(applyMd, /vsdd harness brief/);
  assert.match(applyMd, /vsdd harness seal/);
  assert.match(applyMd, /vsdd harness verify/);
  assert.match(applyMd, /vsdd harness appeal/);
  assert.match(applyMd, /2\+1/);
  assert.match(applyMd, /Analista/);
  assert.match(applyMd, /12 l[ií]neas/i);

  assert.match(verifyMd, /Fiscal de(?:l)? Contrato/i);
  assert.match(verifyMd, /Cazador de Trampas/i);
  assert.match(verifyMd, /Artesano de C[oó]digo/i);
  assert.match(verifyMd, /Juez/i);
});

test('harness fixes: soporta repo-memory como Array (sonar), Archivos multilínea y prioriza features activas', () => {
  const { tmpRoot, featureDir, prodRel, testRel } = createGitTaskFixture();
  try {
    const { sealTestFile } = require('../scripts/lib/harness/seal');
    const { verifyTask } = require('../scripts/lib/harness/verify');
    const { resolveFeatureDir } = require('../scripts/vsdd-harness');

    // 1. repo-memory.json en formato Array top-level de vsdd sonar --remember (con campo hypothesis)
    const sonarMemory = [
      {
        id: 'm-001',
        hypothesis: 'Usar git checkout acotado para no borrar archivos del usuario.',
        anchor: 'package.json',
      },
    ];
    fs.writeFileSync(
      path.join(tmpRoot, 'docs', 'sdd', 'vsdd', 'repo-memory.json'),
      JSON.stringify(sonarMemory, null, 2),
      'utf8'
    );
    // Forzar invalidación de caché de sharedBrief
    const ideaPath = path.join(featureDir, 'idea.md');
    const futureTime = new Date(Date.now() + 10000);
    fs.utimesSync(ideaPath, futureTime, futureTime);

    const briefRes = assembleBrief(featureDir, 'TASK-01');
    assert.match(briefRes.sharedBrief, /m-001/);
    assert.match(briefRes.sharedBrief, /Usar git checkout acotado/);

    // 2. Archivos multilínea en sub-viñetas y throw new Error no marcado como hardcode
    const tasksPath = path.join(featureDir, 'tasks.md');
    const multilineTasks = fs
      .readFileSync(tasksPath, 'utf8')
      .replace(
        `- **Archivos:** \`~ ${prodRel}\`, \`+ ${testRel}\``,
        `- **Archivos:**\n    - \`~ ${prodRel}\`\n    - \`+ ${testRel}\``
      );
    fs.writeFileSync(tasksPath, multilineTasks, 'utf8');

    sealTestFile(featureDir, testRel, {
      cwd: tmpRoot,
      taskId: 'TASK-01',
      cmd: 'node --test',
      runnerFn: () => ({ exitCode: 1, stdout: '', stderr: 'fail' }),
    });

    // Código productivo que lanza un Error con un literal largo y además tiene empty catch
    fs.writeFileSync(
      path.join(tmpRoot, prodRel),
      [
        'function calcular(x) {',
        '  if (!x) throw new Error("TARIFA-CORPORATIVA-2026");',
        '  try { return x; } catch (e) {}',
        '}',
        'module.exports = { calcular };',
      ].join('\n'),
      'utf8'
    );

    const verifyRes = verifyTask(featureDir, 'TASK-01', {
      cwd: tmpRoot,
      runnerFn: () => ({ exitCode: 0, stdout: 'PASS', stderr: '' }),
    });
    assert.equal(verifyRes.ok, false);
    assert.equal(verifyRes.reason, 'HYGIENE_VIOLATION');
    // Detectó el archivo multilínea (por el empty-catch), pero NO marcó el throw new Error como hardcoded-test-literal
    assert.ok(verifyRes.violations.some((v) => v.type === 'empty-catch'));
    assert.ok(!verifyRes.violations.some((v) => v.type === 'hardcoded-test-literal'));

    // 3. discoverActiveFeatureDir prioriza 001 activa aunque exista 002 completada
    const completedFeatureDir = path.join(tmpRoot, 'docs', 'sdd', 'vsdd', '002-cerrada');
    fs.mkdirSync(completedFeatureDir, { recursive: true });
    fs.writeFileSync(
      path.join(completedFeatureDir, 'tasks.md'),
      '# Tareas 002 Cerrada\n\nEstado: completado\n',
      'utf8'
    );
    const activeResolved = resolveFeatureDir('', tmpRoot);
    assert.equal(activeResolved, featureDir);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

