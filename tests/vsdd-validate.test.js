const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const {
  validateContent,
  validateFile,
  validateFeatureDir,
  parseMarkdownLines,
  formatReport,
} = require('../scripts/vsdd-validate');

// ============================================================================
// Fixtures Válidos
// ============================================================================

const VALID_IDEA = `# Idea 001 Autenticación OAuth

Estado: listo-para-spec

## Problema
Los usuarios no pueden iniciar sesión con su cuenta de Google, lo que genera fricción en el registro y abandono del carrito.

## Qué vamos a hacer
Implementar un botón de inicio de sesión único con Google OAuth 2.0 que cree o enlace la cuenta del usuario.

## En alcance / Fuera de alcance
En alcance:
- Inicio de sesión con Google.
- Vinculación de correo existente.

Fuera de alcance:
- Otros proveedores (Apple, GitHub).

## Listo cuando
- Se puede comprobar que al pulsar 'Continuar con Google' el usuario es redirigido y queda autenticado.
- Se puede comprobar que si el usuario cancela, regresa a la vista de login con un mensaje explicativo.
`;

const VALID_SPEC = `# Spec 001 Autenticación OAuth

Estado: listo-para-plan

## Contexto y objetivos
Permitir a los clientes autenticarse con su cuenta de Google para agilizar las compras.

### Usuarios y actores
- Cliente: puede iniciar sesión con Google. No puede acceder a datos de otros clientes.

### Historias de usuario
- Como cliente, quiero autenticarme con Google para no recordar otra contraseña.

## Requisitos funcionales

### RF-01 Iniciar sesión con Google
- Cuando el usuario hace clic en el botón de Google, el sistema debe redirigir a la pantalla de consentimiento.
- Si la autenticación es exitosa, la interfaz debe mostrar la sesión activa.
- Si el usuario rechaza los permisos, el sistema no debe iniciar sesión; debe mostrar un mensaje amigable.
- **Ejemplo concreto:** Entrada: Clic en botón 'Iniciar sesión con Google' → Resultado observable: Redirección exitosa y nombre visible en barra superior.

## Casos límite
- Si se corta la conexión durante la redirección, se debe mostrar una pantalla de error reintentable.

## Requisitos no funcionales
- El flujo de login debe responder en menos de 2 segundos.

## Fuera de alcance
- No se soportan otros proveedores en este corte.

## Criterios de finalización
- Se puede comprobar que el usuario autenticado visualiza su nombre en la barra superior.
- Se puede comprobar que un usuario no registrado que inicia sesión con Google queda registrado en la base de datos.

## Dudas abiertas
Ninguna.
`;

const VALID_PLAN = `# Plan 001 Autenticación OAuth

Estado: listo-para-tareas

Idea: \`001-oauth/idea.md\`
Spec: \`001-oauth/spec.md\`

## Alineación
Este plan implementa la autenticación OAuth 2.0 respetando la arquitectura del proyecto sin agregar dependencias innecesarias.

## Módulos y arquitectura
- **AuthModule:** Maneja la interacción con el proveedor OAuth. Cubre: RF-01.

## Prerrequisitos y validaciones previas (Spikes)
Ninguno: el entorno cuenta con todo lo necesario y no hay incertidumbre técnica previa.

## Árbol de cambios
- \`+ src/auth/oauth-client.js\`
- \`~ src/auth/session-manager.js\`

## Estrategia de tests
- **AuthOAuthTest:** Valida Listo cuando: el usuario autenticado visualiza su nombre. Cubre: RF-01.

### Paseo de Verificación Manual (Golden Path Walkthrough)
- **Superficie:** Web
- **Duración estimada:** ≤ 2 minutos
- **Paso 1 (Arranque):** Navegar a \`/login\`
- **Paso 2 (Acción):** Clic en 'Iniciar con Google'
- **Paso 3 (Resultado esperado observable):** Dashboard con nombre visible en la barra superior

## Cobertura RF / RNF
| ID | Dónde se resuelve (Módulo, DT, Tests) |
| :--- | :--- |
| RF-01 | AuthModule, DT-01, AuthOAuthTest |

## Decisiones técnicas

### DT-01 Uso de cliente OAuth ligero
- **Decisión:** Usar el cliente ligero nativo de fetch en lugar de una librería pesada.
- **Por qué es la mejor opción actual:** Reduce el tamaño del bundle y simplifica el mantenimiento.
- **Alternativa descartada:** Instalar passport.js.
- **Por qué se descarta:** Sobrecarga innecesaria para un solo proveedor.
- **Cubre:** RF-01.

## Dudas abiertas
Ninguna.
`;

const VALID_TASKS = `# Tareas 001 Autenticación OAuth

Estado: listo-para-aplicar

Idea: \`001-oauth/idea.md\`
Plan: \`001-oauth/plan.md\`

## Reglas de ejecución
- Granularidad orientada a Slicing Vertical atómico.
- TDD estricto.

## Fase 1: Dominio y Cliente OAuth

- [ ] **TASK-01: Cliente OAuth básico**
  - **Qué:** Implementar función que genera la URL de autorización.
  - **Cubre:** RF-01, DT-01
  - **Archivos:** \`+ src/auth/oauth-client.js\`
  - **Test primero (TDD):** \`tests/oauth-client.test.js\`
  - **Listo cuando:** Genera la URL correcta con clientId y redirectUri.
  - [ ] **Commit de tarea:** \`feat(auth): add google oauth client\`

### Control de Fase 1
- [ ] **Auditoría independiente de Fase 1:** auditoría QA.
- [ ] **Commit de Fase 1:** commit de cierre validado con tests.

## Fuera de este corte
Nada: el plan cabe completo.

## Dudas abiertas
Ninguna.
`;

// ============================================================================
// Pruebas Unitarias
// ============================================================================

test('validateContent aprueba idea.md válido con 0 errores', () => {
  const result = validateContent(VALID_IDEA, 'idea.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.type, 'idea');
});

test('validateContent aprueba spec.md válido con 0 errores', () => {
  const result = validateContent(VALID_SPEC, 'spec.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.type, 'spec');
});

test('validateContent aprueba plan.md válido con 0 errores', () => {
  const result = validateContent(VALID_PLAN, 'plan.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.type, 'plan');
});

test('validateContent aprueba tasks.md válido con 0 errores', () => {
  const result = validateContent(VALID_TASKS, 'tasks.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.type, 'tasks');
});

test('Higiene Universal: detecta marcadores residuales **Llenar:** y placeholders angulares', () => {
  const malformed = VALID_SPEC + '\n**Llenar:** texto residual que quedó de la plantilla\nEstado: <en-revision | listo-para-plan>\n';
  const result = validateContent(malformed, 'spec.md');
  assert.equal(result.valid, false);
  const fillError = result.errors.find((e) => e.rule === 'marcador-plantilla-residual');
  assert.ok(fillError, 'Debe detectar **Llenar:**');
  const placeholderError = result.errors.find((e) => e.rule === 'placeholder-sin-resolver');
  assert.ok(placeholderError, 'Debe detectar placeholder angular');
});

test('Extensibilidad Libre: permite secciones adicionales no vacías (ej: ## Plan de Rollback)', () => {
  const extendedPlan = VALID_PLAN + '\n## Plan de Rollback\nEn caso de falla crítica en producción, se revierte el commit y se limpia la cookie de sesión.\n';
  const result = validateContent(extendedPlan, 'plan.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('State Machine: ignora encabezados Markdown falsos dentro de bloques de código (```)', () => {
  const specWithCode = VALID_SPEC.replace(
    'Ninguna.',
    '```markdown\n# Encabezado falso en bloque de código\n## Otra sección de mentira\n```\n'
  );
  const result = validateContent(specWithCode, 'spec.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('spec.md: detecta violación de prefijo estricto en Criterios de Finalización', () => {
  const badCriteria = VALID_SPEC.replace(
    '- Se puede comprobar que el usuario autenticado visualiza su nombre en la barra superior.',
    '- El usuario ve su nombre en la barra superior.'
  );
  const result = validateContent(badCriteria, 'spec.md');
  assert.equal(result.valid, false);
  const critError = result.errors.find((e) => e.rule === 'criterio-finalizacion-prefijo-estricto');
  assert.ok(critError, 'Debe fallar si no empieza con "- Se puede comprobar que:"');
  assert.ok(critError.message.includes('- Se puede comprobar que:'));
});

test('spec.md: detecta identificador de RF de 1 solo dígito (ej: RF-1 en vez de RF-01)', () => {
  const badRf = VALID_SPEC.replace('### RF-01 Iniciar sesión', '### RF-1 Iniciar sesión');
  const result = validateContent(badRf, 'spec.md');
  assert.equal(result.valid, false);
  const rfError = result.errors.find((e) => e.rule === 'rf-identificador-formato');
  assert.ok(rfError, 'Debe exigir 2 dígitos correlativos');
});

test('plan.md: detecta archivo en Árbol de Cambios sin prefijo (+, ~, -)', () => {
  const badTree = VALID_PLAN.replace(
    '- `+ src/auth/oauth-client.js`',
    '- src/auth/oauth-client.js'
  );
  const result = validateContent(badTree, 'plan.md');
  assert.equal(result.valid, false);
  const treeError = result.errors.find((e) => e.rule === 'arbol-prefijo-invalido');
  assert.ok(treeError, 'Debe fallar si la línea no tiene prefijo +, ~ o -');
});

test('plan.md: detecta DT sin alternativa descartada', () => {
  const badDt = VALID_PLAN.replace(
    '- **Alternativa descartada:** Instalar passport.js.\n- **Por qué se descarta:** Sobrecarga innecesaria para un solo proveedor.',
    ''
  );
  const result = validateContent(badDt, 'plan.md');
  assert.equal(result.valid, false);
  const dtError = result.errors.find((e) => e.rule === 'dt-campo-alternativa-faltante');
  assert.ok(dtError, 'Debe exigir alternativa descartada');
});

test('tasks.md: rechaza tarea con estimación de tiempo ficticia en minutos u horas (task-duracion-ficticia-prohibida)', () => {
  const taskWithMinutes = VALID_TASKS.replace(
    '**TASK-01: Cliente OAuth básico**',
    '**TASK-01: Cliente OAuth básico (25 min)**'
  );
  const result = validateContent(taskWithMinutes, 'tasks.md');
  assert.equal(result.valid, false);
  const err = result.errors.find((e) => e.rule === 'task-duracion-ficticia-prohibida');
  assert.ok(err, 'Debe detectar y prohibir duración en minutos');
  assert.ok(err.message.includes('Slicing Vertical estricto'));
});

test('Detector de Alias: sugiere asistidamente si se usó un sinónimo para sección obligatoria', () => {
  const aliasedSpec = VALID_SPEC.replace(
    '## Casos límite',
    '## Casos de borde'
  );
  const result = validateContent(aliasedSpec, 'spec.md');
  assert.equal(result.valid, false);
  const aliasError = result.errors.find((e) => e.rule === 'seccion-mal-nombrada');
  assert.ok(aliasError, 'Debe detectar el alias utilizado');
  assert.ok(aliasError.message.includes('Casos de borde'));
  assert.ok(aliasError.message.includes('Casos límite'));
});

test('CLI: ejecución de scripts/vsdd-validate.js con archivo temporal e invocación --json', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-val-test-'));
  try {
    const validFile = path.join(tempDir, 'idea.md');
    fs.writeFileSync(validFile, VALID_IDEA);

    const scriptPath = path.resolve(__dirname, '../scripts/vsdd-validate.js');
    // Archivo válido -> exit code 0
    const stdout = execSync(`node "${scriptPath}" "${validFile}" --json`, {
      encoding: 'utf8',
    });
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.results[0].errors.length, 0);

    // Archivo inválido -> exit code 1
    const invalidFile = path.join(tempDir, 'spec.md');
    fs.writeFileSync(invalidFile, '# Spec 001\nEstado: en-revision\n\n## Contexto y objetivos\nTexto\n');
    assert.throws(
      () => {
        execSync(`node "${scriptPath}" "${invalidFile}"`, {
          encoding: 'utf8',
          stdio: 'pipe',
        });
      },
      (err) => err.status === 1
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI: directorio vacío falla con JSON explícito y código 1', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-val-empty-test-'));
  const emptyDir = path.join(tempDir, 'empty');
  fs.mkdirSync(emptyDir);

  try {
    const scriptPath = path.resolve(__dirname, '../scripts/vsdd-validate.js');
    let error;
    try {
      execSync(`node "${scriptPath}" "${emptyDir}" --json`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error, 'Un directorio vacío debe producir una salida no exitosa');
    assert.equal(error.status, 1);
    const parsed = JSON.parse(error.stdout);
    assert.equal(parsed.valid, false);
    assert.deepEqual(parsed.results, []);
    assert.match(parsed.message, /artefactos VSDD|archivos para validar/i);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('CLI: layout sin artefactos informa el motivo en texto y falla con código 1', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-val-layout-test-'));
  const featureDir = path.join(tempDir, 'features', '001-empty');
  fs.mkdirSync(featureDir, { recursive: true });

  try {
    const scriptPath = path.resolve(__dirname, '../scripts/vsdd-validate.js');
    let error;
    try {
      execSync(`node "${scriptPath}" "${path.join(tempDir, 'features')}"`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error, 'Un layout sin artefactos VSDD debe producir una salida no exitosa');
    assert.equal(error.status, 1);
    assert.match(error.stdout, /No se encontraron artefactos VSDD/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('State Machine: maneja bloques anidados con 4 backticks sin cerrarse antes de tiempo', () => {
  const contentWith4Fences = VALID_SPEC.replace(
    'Ninguna.',
    '````markdown\n```javascript\n// Comentario\nconst x = 1;\n```\n# Encabezado que no debe detectarse\n````\n'
  );
  const result = validateContent(contentWith4Fences, 'spec.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('Tolerancia a puntuación: encabezados con punto o dos puntos al final son válidos', () => {
  const punctuatedSpec = VALID_SPEC
    .replace('## Contexto y objetivos', '## Contexto y objetivos.')
    .replace('## Requisitos no funcionales', '## Requisitos no funcionales:');
  const result = validateContent(punctuatedSpec, 'spec.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('Criterios de finalización: tolera sub-viñetas indentadas sin exigir prefijo estricto', () => {
  const withSubBullets = VALID_SPEC.replace(
    '- Se puede comprobar que el usuario autenticado visualiza su nombre en la barra superior.',
    '- Se puede comprobar que el usuario autenticado visualiza su nombre en la barra superior.\n  - Nota complementaria: debe reflejarse en tiempo real sin recargar.'
  );
  const result = validateContent(withSubBullets, 'spec.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('Árbol de cambios: tolera sub-viñetas descriptivas indentadas', () => {
  const withSubBulletsTree = VALID_PLAN.replace(
    '- `+ src/auth/oauth-client.js`',
    '- `+ src/auth/oauth-client.js`\n  - Implementa cliente HTTP nativo con fetch'
  );
  const result = validateContent(withSubBulletsTree, 'plan.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('Decisiones técnicas: tolera dos puntos afuera de las negritas (ej: **Decisión**: )', () => {
  const dtWithColonOutside = VALID_PLAN.replace(
    '- **Decisión:** Usar el cliente ligero nativo de fetch en lugar de una librería pesada.',
    '- **Decisión**: Usar el cliente ligero nativo de fetch en lugar de una librería pesada.'
  );
  const result = validateContent(dtWithColonOutside, 'plan.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('spec.md: detecta RF sin sintaxis EARS en sus viñetas', () => {
  const badEars = VALID_SPEC.replace(
    '- Cuando el usuario hace clic en el botón de Google, el sistema debe redirigir a la pantalla de consentimiento.\n- Si la autenticación es exitosa, la interfaz debe mostrar la sesión activa.\n- Si el usuario rechaza los permisos, el sistema no debe iniciar sesión; debe mostrar un mensaje amigable.',
    '- El usuario hace clic y va a Google.\n- Mostrar pantalla activa.'
  );
  const result = validateContent(badEars, 'spec.md');
  assert.equal(result.valid, false);
  const earsError = result.errors.find((e) => e.rule === 'rf-sintaxis-ears-faltante');
  assert.ok(earsError, 'Debe detectar ausencia de sintaxis EARS');
});

test('tasks.md: detecta tarea que no contiene el campo obligatorio Test primero (TDD)', () => {
  const badTdd = VALID_TASKS.replace(
    '  - **Test primero (TDD):** `tests/oauth-client.test.js`\n',
    ''
  );
  const result = validateContent(badTdd, 'tasks.md');
  assert.equal(result.valid, false);
  const tddError = result.errors.find((e) => e.rule === 'task-tdd-faltante');
  assert.ok(tddError, 'Debe exigir campo Test primero (TDD)');
});

test('plan.md: aprueba estructura con subsección de Golden Path Walkthrough con 0 errores', () => {
  const planWithGoldenPath = VALID_PLAN.replace(
    '## Estrategia de tests\n- **AuthOAuthTest:** Valida Listo cuando: el usuario autenticado visualiza su nombre. Cubre: RF-01.\n',
    `## Estrategia de tests
- **AuthOAuthTest:** Valida Listo cuando: el usuario autenticado visualiza su nombre. Cubre: RF-01.

### Paseo de Verificación Manual (Golden Path Walkthrough)
- **Superficie:** CLI Interactivo
- **Duración estimada:** ≤ 2 minutos
- **Paso 1 (Arranque):** \`node src/cli.js --login\`
- **Paso 2 (Acción):** Ingresar credenciales de prueba y presionar Enter
- **Paso 3 (Resultado esperado observable):** Mensaje de bienvenida en verde
`
  );
  const result = validateContent(planWithGoldenPath, 'plan.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateContent aprueba artefactos cancelados con 0 errores mediante early-exit y limpia errores de higiene', () => {
  const cancelledIdea = `# Idea Cancelada
Estado: cancelado
Motivo de cancelación: El cliente cambió de requerimiento.
**Llenar:** esto deberia ser un error pero se ignora
<placeholder>
`;
  const resIdea = validateContent(cancelledIdea, 'idea.md');
  assert.equal(resIdea.valid, true);
  assert.equal(resIdea.errors.length, 0);

  const cancelledSpec = `# Spec Cancelada
Estado: cancelado
Motivo de cancelación: Duplicada.
**Llenar:** esto deberia ser un error pero se ignora
<placeholder>
`;
  const resSpec = validateContent(cancelledSpec, 'spec.md');
  assert.equal(resSpec.valid, true);
  assert.equal(resSpec.errors.length, 0);

  const cancelledPlan = `# Plan Cancelado
Estado: cancelado
**Llenar:** esto deberia ser un error pero se ignora
<placeholder>
`;
  const resPlan = validateContent(cancelledPlan, 'plan.md');
  assert.equal(resPlan.valid, true);
  assert.equal(resPlan.errors.length, 0);

  const cancelledTasks = `# Tasks Canceladas
Estado: cancelado
**Llenar:** esto deberia ser un error pero se ignora
<placeholder>
`;
  const resTasks = validateContent(cancelledTasks, 'tasks.md');
  assert.equal(resTasks.valid, true);
  assert.equal(resTasks.errors.length, 0);
});

test('plan.md: detecta DT sin justificación de mejor opción actual (dt-campo-mejor-opcion-faltante)', () => {
  const badDt = VALID_PLAN.replace(
    '- **Por qué es la mejor opción actual:** Reduce el tamaño del bundle y simplifica el mantenimiento.\n',
    ''
  );
  const result = validateContent(badDt, 'plan.md');
  assert.equal(result.valid, false);
  const dtError = result.errors.find((e) => e.rule === 'dt-campo-mejor-opcion-faltante');
  assert.ok(dtError, 'Debe exigir justificación de mejor opción actual');
});

test('tasks.md: detecta tarea no automatizable o con verificación manual (task-no-automatizable)', () => {
  const manualTask = VALID_TASKS.replace(
    '- [ ] **TASK-01: Cliente OAuth básico**',
    '- [ ] **TASK-01: Probar manualmente la API externa**'
  );
  const result = validateContent(manualTask, 'tasks.md');
  assert.equal(result.valid, false);
  const manualError = result.errors.find((e) => e.rule === 'task-no-automatizable');
  assert.ok(manualError, 'Debe rechazar tareas con pruebas manuales');
  assert.ok(manualError.message.includes('tasks.md está reservado para código puro'));
});

test('tasks.md: descripción en Qué con acción manual no genera falso positivo', () => {
  const taskWithManualDesc = VALID_TASKS.replace(
    '- **Qué:** Implementar función que genera la URL de autorización.',
    '- **Qué:** Implementar botón para probar manualmente la conexión.'
  );
  const result = validateContent(taskWithManualDesc, 'tasks.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('tasks.md: detecta Test primero (TDD) no automatizable (Ninguno o n/a)', () => {
  const taskTddNinguno = VALID_TASKS.replace(
    '  - **Test primero (TDD):** `tests/oauth-client.test.js`',
    '  - **Test primero (TDD):** Ninguno'
  );
  const res1 = validateContent(taskTddNinguno, 'tasks.md');
  assert.equal(res1.valid, false);
  const err1 = res1.errors.find((e) => e.rule === 'task-no-automatizable');
  assert.ok(err1, 'Debe rechazar Test primero (TDD): Ninguno');
  assert.equal(err1.found, '- **Test primero (TDD):** Ninguno');

  const taskTddNa = VALID_TASKS.replace(
    '  - **Test primero (TDD):** `tests/oauth-client.test.js`',
    '  * **Test primero (TDD):** n/a'
  );
  const res2 = validateContent(taskTddNa, 'tasks.md');
  assert.equal(res2.valid, false);
  const err2 = res2.errors.find((e) => e.rule === 'task-no-automatizable');
  assert.ok(err2, 'Debe rechazar * **Test primero (TDD):** n/a');
  assert.equal(err2.found, '* **Test primero (TDD):** n/a');
});

test('plan.md: tolera DT con "Por qué es la mejor opción" sin la palabra "actual"', () => {
  const planWithoutActual = VALID_PLAN.replace(
    '- **Por qué es la mejor opción actual:** Reduce el tamaño del bundle y simplifica el mantenimiento.',
    '- **Por qué es la mejor opción:** Reduce el tamaño del bundle y simplifica el mantenimiento.'
  );
  const result = validateContent(planWithoutActual, 'plan.md');
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('plan.md: detecta ausencia de sección obligatoria de Prerrequisitos y Spikes', () => {
  const planNoPrereqs = VALID_PLAN.replace(
    '## Prerrequisitos y validaciones previas (Spikes)\nNinguno: el entorno cuenta con todo lo necesario y no hay incertidumbre técnica previa.\n\n',
    ''
  );
  const result = validateContent(planNoPrereqs, 'plan.md');
  assert.equal(result.valid, false);
  const prereqErr = result.errors.find((e) => e.rule === 'seccion-obligatoria-faltante');
  assert.ok(prereqErr, 'Debe exigir la sección de Prerrequisitos');
  assert.ok(prereqErr.message.includes('Prerrequisitos y validaciones previas'));
});

test('tasks.md: detecta evasión de TDD sin formato de negritas (- Test primero: ninguna o na)', () => {
  const taskNoBoldTdd = VALID_TASKS.replace(
    '- **Test primero (TDD):** `tests/oauth-client.test.js`',
    '- Test primero: ninguna'
  );
  const res = validateContent(taskNoBoldTdd, 'tasks.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'task-no-automatizable');
  assert.ok(err, 'Debe detectar evasión sin negritas');

  const taskSpikeTitle = VALID_TASKS.replace(
    '- [ ] **TASK-01: Cliente OAuth básico**',
    '- [ ] **TASK-01: Hacer spike de viabilidad técnica**'
  );
  const res2 = validateContent(taskSpikeTitle, 'tasks.md');
  assert.equal(res2.valid, false);
  const err2 = res2.errors.find((e) => e.rule === 'task-no-automatizable');
  assert.ok(err2, 'Debe rechazar tareas de spike en tasks.md');
});

test('spec.md: aprueba estructura moderna con Límites y exclusiones (Non-Goals y Anti-Goals) y Example Mapping', () => {
  const modernSpec = VALID_SPEC.replace(
    `### RF-01 Iniciar sesión con Google\n- Cuando el usuario hace clic en el botón de Google, el sistema debe redirigir a la pantalla de consentimiento.\n- Si la autenticación es exitosa, la interfaz debe mostrar la sesión activa.\n- Si el usuario rechaza los permisos, el sistema no debe iniciar sesión; debe mostrar un mensaje amigable.`,
    `### RF-01 Iniciar sesión con Google\n- Cuando el usuario hace clic en el botón de Google, el sistema debe redirigir a la pantalla de consentimiento.\n- Si la autenticación es exitosa, la interfaz debe mostrar la sesión activa.\n- Si el usuario rechaza los permisos, el sistema no debe iniciar sesión; debe mostrar un mensaje amigable.\n- **Ejemplo concreto:**\n  * Entrada: clic en "Iniciar con Google" con permisos aceptados → Resultado observable: redirección al dashboard con sesión activa.`
  ).replace(
    `## Fuera de alcance\n- No se soportan otros proveedores en este corte.`,
    `## Límites y exclusiones\n\n### Fuera de alcance (Non-Goals)\n- No se soportan otros proveedores (Apple, GitHub) en este corte.\n\n### Anti-objetivos e invariantes prohibidas (Anti-Goals)\n- Bajo ninguna circunstancia se debe almacenar contraseñas en texto plano ni tokens sin cifrar.`
  );

  const res = validateContent(modernSpec, 'spec.md');
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test('spec.md: aprueba sección extensible de Decisiones y alternativas descartadas', () => {
  const specWithAdr = VALID_SPEC + `
## Decisiones y alternativas descartadas
- **Alternativa descartada:** Implementar OAuth 2.0 manual sin librería.
  • Por qué se descarta: Mayor complejidad de mantenimiento y riesgo de vulnerabilidades de seguridad.
`;
  const res = validateContent(specWithAdr, 'spec.md');
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test('spec.md: detecta alias sugerido cuando se usa Non-goals como H2 directo', () => {
  const specWithBadHeading = VALID_SPEC.replace('## Fuera de alcance', '## Non-goals');
  const res = validateContent(specWithBadHeading, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'seccion-mal-nombrada');
  assert.ok(err, 'Debe detectar sección mal nombrada');
  assert.ok(err.message.includes('Fuera de alcance'));
});

test('spec.md: detecta placeholders angulares modernos en Example Mapping y EARS (<valor o acción de prueba>)', () => {
  const specWithPlaceholder = VALID_SPEC.replace(
    '### RF-01 Iniciar sesión con Google',
    `### RF-01 Iniciar sesión con Google\n- **Ejemplo concreto:**\n  * Entrada: <valor o acción de prueba> → Resultado: <salida visible>`
  );
  const res = validateContent(specWithPlaceholder, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'placeholder-sin-resolver');
  assert.ok(err, 'Debe detectar el placeholder residual <valor o acción de prueba>');
});

test('spec.md: detecta formato inválido en Decisiones y alternativas descartadas cuando falta Alternativa descartada', () => {
  const specWithMalformedAdr = VALID_SPEC + `
## Decisiones y alternativas descartadas
- Se decidió usar OAuth nativo porque es más rápido y seguro.
`;
  const res = validateContent(specWithMalformedAdr, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'spec-decisiones-formato-invalido');
  assert.ok(err, 'Debe detectar formato inválido en Decisiones descartadas');
});

test('spec.md: detecta Alternativa descartada sin formato de negritas (- Alternativa descartada:)', () => {
  const specWithoutBold = VALID_SPEC + `
## Decisiones y alternativas descartadas
- Alternativa descartada: Usar OAuth manual.
  • Por qué se descarta: Demasiada complejidad.
`;
  const res = validateContent(specWithoutBold, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'spec-decisiones-formato-invalido');
  assert.ok(err, 'Debe rechazar viñeta sin negritas');
});

test('spec.md: tolera dos puntos fuera de las negritas en Alternativa descartada (- **Alternativa descartada**:) ', () => {
  const specColonOutside = VALID_SPEC + `
## Decisiones y alternativas descartadas
- **Alternativa descartada**: Usar OAuth manual.
  • Por qué se descarta: Demasiada complejidad.
`;
  const res = validateContent(specColonOutside, 'spec.md');
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test('spec.md: detecta si una segunda alternativa descartada carece del formato correcto', () => {
  const specMultipleAlt = VALID_SPEC + `
## Decisiones y alternativas descartadas
- **Alternativa descartada:** Usar OAuth manual.
  • Por qué se descarta: Demasiada complejidad.
- Usar librería externa pesada sin justificar.
`;
  const res = validateContent(specMultipleAlt, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'spec-decisiones-formato-invalido');
  assert.ok(err, 'Debe detectar error en la segunda alternativa');
});

test('spec.md: aprueba múltiples alternativas descartadas bien estructuradas', () => {
  const specMultipleAltValid = VALID_SPEC + `
## Decisiones y alternativas descartadas
- **Alternativa descartada:** Usar OAuth manual.
  • Por qué se descarta: Demasiada complejidad.
- **Alternativa descartada:** Guardar tokens en localStorage.
  • Por qué se descarta: Riesgo de seguridad XSS.
`;
  const res = validateContent(specMultipleAltValid, 'spec.md');
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
});

test('spec.md: detecta ausencia de Example Mapping en Requisitos Funcionales', () => {
  const specWithoutExample = VALID_SPEC.replace(
    '- **Ejemplo concreto:** Entrada: Clic en botón \'Iniciar sesión con Google\' → Resultado observable: Redirección exitosa y nombre visible en barra superior.',
    ''
  );
  const res = validateContent(specWithoutExample, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'spec-example-mapping-faltante');
  assert.ok(err, 'Debe exigir Example Mapping en RFs');
  assert.ok(err.message.includes('ejemplo concreto'));
});

test('spec.md: detecta ausencia de Non-Goals o Anti-Goals en Límites y exclusiones', () => {
  const specLimitesIncomplete = VALID_SPEC.replace(
    '## Fuera de alcance\n- No se soportan otros proveedores en este corte.',
    '## Límites y exclusiones\n### Fuera de alcance (Non-Goals)\n- No se soportan otros proveedores.'
  );
  const res = validateContent(specLimitesIncomplete, 'spec.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'spec-anti-goals-faltante');
  assert.ok(err, 'Debe exigir Anti-Goals cuando se usa Límites y exclusiones');
});

test('plan.md: detecta ausencia de Golden Path Walkthrough en Estrategia de tests', () => {
  const planWithoutGoldenPath = VALID_PLAN; // VALID_PLAN no tenía Golden Path originalmente
  const res = validateContent(planWithoutGoldenPath, 'plan.md');
  assert.equal(res.valid, true); // ahora VALID_PLAN sí tiene Golden Path
  const planBroken = VALID_PLAN.replace(
    '### Paseo de Verificación Manual (Golden Path Walkthrough)\n- **Superficie:** Web\n- **Duración estimada:** ≤ 2 minutos\n- **Paso 1 (Arranque):** Navegar a `/login`\n- **Paso 2 (Acción):** Clic en \'Iniciar con Google\'\n- **Paso 3 (Resultado esperado observable):** Dashboard con nombre visible en la barra superior\n',
    ''
  );
  const resBroken = validateContent(planBroken, 'plan.md');
  assert.equal(resBroken.valid, false);
  const err = resBroken.errors.find((e) => e.rule === 'plan-golden-path-faltante');
  assert.ok(err, 'Debe exigir Golden Path Walkthrough o No aplica');
});

test('tasks.md: detecta ausencia de sección obligatoria Fuera de este corte o Dudas abiertas', () => {
  const tasksNoDudas = VALID_TASKS.replace(
    '## Dudas abiertas\nNinguna.\n',
    ''
  );
  const res = validateContent(tasksNoDudas, 'tasks.md');
  assert.equal(res.valid, false);
  const err = res.errors.find((e) => e.rule === 'seccion-obligatoria-faltante');
  assert.ok(err, 'Debe exigir Dudas abiertas');
  assert.ok(err.message.includes('Dudas abiertas'));
});

// ============================================================================
// Pruebas de Trazabilidad Cruzada Determinista (Cross-Artifact Linker)
// ============================================================================

test('trazabilidad cruzada: detecta requisito huérfano de spec.md cuando tasks está en listo-para-aplicar', () => {
  // spec define RF-01 y RF-02
  const specWithTwoRFs = VALID_SPEC + '\n### RF-02 Manejo de errores de conexión\n- Si la red falla, el sistema debe reintentar.\n- **Ejemplo concreto:** Error 500 -> Reintento automático.\n';
  
  // tasks solo cubre RF-01
  const res = validateContent(VALID_TASKS, 'tasks.md', { specContent: specWithTwoRFs });
  assert.equal(res.valid, false, 'Debe fallar porque falta cubrir RF-02 en estado listo-para-aplicar');
  const err = res.errors.find((e) => e.rule === 'trazabilidad-rf-huerfano');
  assert.ok(err, 'Debe emitir error trazabilidad-rf-huerfano');
  assert.ok(err.message.includes('RF-02'), 'El mensaje debe mencionar RF-02');
});

test('trazabilidad cruzada: requisito huérfano en estado en-revision emite advertencia no bloqueante', () => {
  const specWithTwoRFs = VALID_SPEC + '\n### RF-02 Manejo de errores de conexión\n- Si la red falla, el sistema debe reintentar.\n';
  const tasksEnRevision = VALID_TASKS.replace('Estado: listo-para-aplicar', 'Estado: en-revision');

  const res = validateContent(tasksEnRevision, 'tasks.md', { specContent: specWithTwoRFs });
  assert.equal(res.valid, true, 'No debe bloquear con error si está en revisión');
  const warn = res.warnings.find((w) => w.rule === 'trazabilidad-rf-huerfano');
  assert.ok(warn, 'Debe emitir advertencia trazabilidad-rf-huerfano');
  assert.ok(warn.message.includes('RF-02'));
});

test('trazabilidad cruzada: detecta requisito fantasma citado en tasks que no existe en spec.md', () => {
  // tasks cita RF-01 y RF-99
  const tasksWithPhantom = VALID_TASKS.replace('**Cubre:** RF-01, DT-01', '**Cubre:** RF-01, RF-99, DT-01');

  const res = validateContent(tasksWithPhantom, 'tasks.md', { specContent: VALID_SPEC });
  assert.equal(res.valid, false, 'Debe fallar ante un requisito inexistente');
  const err = res.errors.find((e) => e.rule === 'trazabilidad-rf-inexistente');
  assert.ok(err, 'Debe emitir error trazabilidad-rf-inexistente');
  assert.ok(err.message.includes('RF-99'), 'Debe mencionar RF-99');
});

test('trazabilidad cruzada: cobertura 100% entre spec.md y tasks.md aprueba sin errores', () => {
  const res = validateContent(VALID_TASKS, 'tasks.md', { specContent: VALID_SPEC });
  assert.equal(res.valid, true);
  assert.equal(res.errors.length, 0);
  const huerfanos = res.errors.filter((e) => e.rule.startsWith('trazabilidad'));
  assert.equal(huerfanos.length, 0);
});

test('trazabilidad cruzada: detecta archivo no declarado en el árbol de cambios de plan.md', () => {
  // tasks cita un archivo no existente en plan
  const tasksWithAlienFile = VALID_TASKS.replace(
    '`+ src/auth/oauth-client.js`',
    '`+ src/auth/oauth-client.js`, `src/inventado/foo.js`'
  );

  const res = validateContent(tasksWithAlienFile, 'tasks.md', { planContent: VALID_PLAN });
  const warn = res.warnings.find((w) => w.rule === 'trazabilidad-archivo-no-en-plan');
  assert.ok(warn, 'Debe advertir sobre archivo no contemplado en el plan');
  assert.ok(warn.message.includes('src/inventado/foo.js'));
});

test('trazabilidad cruzada en disco: validateFeatureDir verifica automáticamente la trazabilidad entre archivos', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsdd-trace-test-'));
  try {
    const specWithTwoRFs = VALID_SPEC + '\n### RF-02 Manejo de errores de conexión\n- Si la red falla, el sistema debe reintentar.\n';
    fs.writeFileSync(path.join(tmpDir, 'spec.md'), specWithTwoRFs, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'plan.md'), VALID_PLAN, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'tasks.md'), VALID_TASKS, 'utf8'); // solo cubre RF-01

    const results = validateFeatureDir(tmpDir);
    const tasksRes = results.find((r) => r.type === 'tasks');
    assert.ok(tasksRes, 'Debe validar tasks.md en el directorio');
    assert.equal(tasksRes.valid, false, 'tasks.md debe fallar por trazabilidad cruzada en disco');
    const err = tasksRes.errors.find((e) => e.rule === 'trazabilidad-rf-huerfano');
    assert.ok(err, 'Debe cazar el requisito huérfano automáticamente desde disco sin comandos extra');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('diagnóstico AST: genera snippet visual de código con contexto y puntero en los errores', () => {
  const malformedSpec = `# Spec 001 Test
Estado: listo-para-plan

## Contexto y objetivos
Objetivo claro.

## Requisitos funcionales
### RF-1 Mal Identificador
- Cuando pasa X debe ocurrir Y.
- **Ejemplo concreto:** Entrada: A -> Resultado observable: B

## Casos límite
- Ninguno.

## Requisitos no funcionales
- Rápido.

## Fuera de alcance
- Nada.

## Criterios de finalización
- Se puede comprobar que: funciona.
`;
  const res = validateContent(malformedSpec, 'spec.md');
  assert.equal(res.valid, false);
  const rfErr = res.errors.find((e) => e.rule === 'rf-identificador-formato');
  assert.ok(rfErr, 'Debe detectar identificador RF inválido');
  assert.equal(rfErr.line, 8);
  assert.ok(rfErr.snippet, 'El error debe incluir un snippet de código');
  assert.match(rfErr.snippet, />\s+8\s+\|/);
  assert.match(rfErr.snippet, /### RF-1 Mal Identificador/);
});

test('diagnóstico AST: provee sugerencia accionable en errores de sintaxis y secciones', () => {
  const badIdea = `# Idea 001 Test
Estado: estado-invalido

## Problema
Problema descripto.
`;
  const res = validateContent(badIdea, 'idea.md');
  assert.equal(res.valid, false);
  const estadoErr = res.errors.find((e) => e.rule === 'estado-invalido');
  assert.ok(estadoErr);
  assert.ok(estadoErr.suggestion, 'Debe incluir sugerencia de solución');
  assert.match(estadoErr.suggestion, /listo-para-spec|en-revision/i);
});

test('diagnóstico AST: calcula la línea de inserción contextual para secciones obligatorias intermedias', () => {
  const specMissingCasosLimite = `# Spec 001 Test
Estado: listo-para-plan

## Contexto y objetivos
Objetivo claro.

## Requisitos funcionales
### RF-01 Login
- Cuando el usuario ingresa sus datos debe iniciar sesión.
- **Ejemplo concreto:** Entrada: datos válidos → Resultado observable: sesión iniciada.

## Requisitos no funcionales
- Rápido.

## Fuera de alcance
- Nada.

## Criterios de finalización
- Se puede comprobar que: inicia sesión.
`;
  const res = validateContent(specMissingCasosLimite, 'spec.md');
  assert.equal(res.valid, false);
  const missingErr = res.errors.find((e) => e.message.includes('Casos límite'));
  assert.ok(missingErr, 'Debe detectar que falta Casos límite');
  // En vez de clavar línea 1 ciego, debe calcular la inserción después de Requisitos funcionales (línea > 8)
  assert.ok(missingErr.line > 8, `La línea de inserción debe ser posterior a RF (${missingErr.line} > 8)`);
});

test('spec.md: aprueba Example Mapping estructurado en tabla Markdown dentro de RF', () => {
  const specWithTableExample = `# Spec 001 Test Table
Estado: listo-para-plan

## Contexto y objetivos
Objetivo claro.

## Requisitos funcionales

### RF-01 Cálculo de Descuento
- Cuando el total supera $100 el sistema debe aplicar 10% de descuento.

| Escenario | Entrada | Salida observable |
| :--- | :--- | :--- |
| Carrito mayor a $100 | Total $150 | Total con descuento: $135 |

## Casos límite
- Si el cupón expiró debe rechazarlo.

## Requisitos no funcionales
- Tiempo < 100ms.

## Fuera de alcance
- Envíos internacionales.

## Criterios de finalización
- Se puede comprobar que: el descuento se calcula correctamente.
`;
  const res = validateContent(specWithTableExample, 'spec.md');
  assert.equal(res.valid, true, `Debe validar como válida la spec con Example Mapping en tabla. Errores: ${JSON.stringify(res.errors)}`);
  assert.equal(res.errors.length, 0);
});

test('report: formatReport formatea e indenta snippets y sugerencias para la terminal', () => {
  const fakeResults = [
    {
      filePath: 'docs/sdd/vsdd/001-test/spec.md',
      type: 'spec',
      errors: [
        {
          line: 12,
          rule: 'rf-identificador-formato',
          message: "El identificador 'RF-1' debe usar 2 dígitos.",
          expected: 'RF-01',
          found: 'RF-1',
          snippet: '  11 | ## Requisitos\n> 12 | ### RF-1 Test\n  13 | - Criterio',
          suggestion: "Renombra 'RF-1' por 'RF-01'.",
        },
      ],
      warnings: [],
    },
  ];

  const report = formatReport(fakeResults);
  assert.match(report.output, /> 12 \| ### RF-1 Test/);
  assert.match(report.output, /Sugerencia: Renombra 'RF-1' por 'RF-01'/);
  assert.equal(report.totalErrors, 1);
});

test('validatePlan aprueba ## Prerrequisitos y validaciones previas sin sufijo (Spikes)', () => {
  const planWithoutSpikesSuffix = VALID_PLAN.replace(
    '## Prerrequisitos y validaciones previas (Spikes)',
    '## Prerrequisitos y validaciones previas'
  );
  const res = validateContent(planWithoutSpikesSuffix, 'plan.md');
  assert.equal(res.valid, true, `Debe aprobar plan con prerrequisitos sin sufijo. Errores: ${JSON.stringify(res.errors)}`);
});

test('validateSpec aprueba ## Límites y exclusiones (Non-Goals y Anti-Goals)', () => {
  const specWithFullLimitsTitle = VALID_SPEC.replace(
    '## Fuera de alcance',
    '## Límites y exclusiones (Non-Goals y Anti-Goals)\n### Fuera de alcance (Non-Goals)\n- Nada\n### Anti-objetivos e invariantes prohibidas (Anti-Goals)\n- Nada'
  );
  const res = validateContent(specWithFullLimitsTitle, 'spec.md');
  assert.equal(res.valid, true, `Debe aprobar spec con título canónico completo de límites. Errores: ${JSON.stringify(res.errors)}`);
});

test('traceability y drift toleran ## Arbol de cambios sin tilde', () => {
  const planWithoutAccent = VALID_PLAN.replace('## Árbol de cambios', '## Arbol de cambios');
  const res = validateContent(VALID_TASKS, 'tasks.md', { planContent: planWithoutAccent });
  assert.equal(res.valid, true);
  const warn = res.warnings.find((w) => w.rule === 'trazabilidad-archivo-no-en-plan');
  assert.equal(warn, undefined, 'No debe advertir archivos faltantes cuando Arbol de cambios no tiene tilde');
});

test('validateSpec exige H3 obligatorios incluso con título completo ## Límites y exclusiones (Non-Goals y Anti-Goals)', () => {
  const specWithEmptyFullLimits = VALID_SPEC.replace(
    '## Fuera de alcance',
    '## Límites y exclusiones (Non-Goals y Anti-Goals)\n- Contenido genérico sin subsecciones H3'
  );
  const res = validateContent(specWithEmptyFullLimits, 'spec.md');
  assert.equal(res.valid, false);
  const nonGoalsErr = res.errors.find((e) => e.rule === 'spec-non-goals-faltante');
  const antiGoalsErr = res.errors.find((e) => e.rule === 'spec-anti-goals-faltante');
  assert.ok(nonGoalsErr, 'Debe exigir subsección Non-Goals');
  assert.ok(antiGoalsErr, 'Debe exigir subsección Anti-Goals');
});









