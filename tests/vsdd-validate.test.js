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

## Árbol de cambios
- \`+ src/auth/oauth-client.js\`
- \`~ src/auth/session-manager.js\`

## Estrategia de tests
- **AuthOAuthTest:** Valida Listo cuando: el usuario autenticado visualiza su nombre. Cubre: RF-01.

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
- Granularidad de 20 a 30 minutos.
- TDD estricto.

## Fase 1: Dominio y Cliente OAuth

- [ ] **TASK-01: Cliente OAuth básico (25 min)**
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

test('tasks.md: detecta tarea sin duración explícita (min)', () => {
  const badTask = VALID_TASKS.replace(
    '**TASK-01: Cliente OAuth básico (25 min)**',
    '**TASK-01: Cliente OAuth básico**'
  );
  const result = validateContent(badTask, 'tasks.md');
  assert.equal(result.valid, false);
  const durationError = result.errors.find((e) => e.rule === 'task-duracion-faltante');
  assert.ok(durationError, 'Debe exigir duración explícita en minutos');
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

    // Archivo válido -> exit code 0
    const stdout = execSync(`node scripts/vsdd-validate.js "${validFile}" --json`, {
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
        execSync(`node scripts/vsdd-validate.js "${invalidFile}"`, {
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

test('validateContent aprueba artefactos cancelados con 0 errores mediante early-exit', () => {
  const cancelledIdea = `# Idea Cancelada
Estado: cancelado
Motivo de cancelación: El cliente cambió de requerimiento.
`;
  const resIdea = validateContent(cancelledIdea, 'idea.md');
  assert.equal(resIdea.valid, true);
  assert.equal(resIdea.errors.length, 0);

  const cancelledSpec = `# Spec Cancelada
Estado: cancelado
Motivo de cancelación: Duplicada.
`;
  const resSpec = validateContent(cancelledSpec, 'spec.md');
  assert.equal(resSpec.valid, true);
  assert.equal(resSpec.errors.length, 0);

  const cancelledPlan = `# Plan Cancelado
Estado: cancelado
`;
  const resPlan = validateContent(cancelledPlan, 'plan.md');
  assert.equal(resPlan.valid, true);
  assert.equal(resPlan.errors.length, 0);

  const cancelledTasks = `# Tasks Canceladas
Estado: cancelado
`;
  const resTasks = validateContent(cancelledTasks, 'tasks.md');
  assert.equal(resTasks.valid, true);
  assert.equal(resTasks.errors.length, 0);
});

