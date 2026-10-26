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
