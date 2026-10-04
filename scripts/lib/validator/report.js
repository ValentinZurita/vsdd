'use strict';

const { getCanonicalVersion } = require('../version');

function formatReport(results) {
  const version = getCanonicalVersion();
  const lines = [];
  lines.push('================================================================================');
  lines.push(`  VSDD Format Validator (v${version}) - Compuerta Determinista`);
  lines.push('================================================================================\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const res of results) {
    lines.push(`📄 Archivo: ${res.filePath} (Tipo: ${res.type})`);
    if (res.errors.length === 0 && res.warnings.length === 0) {
      lines.push('   ✅ APROBADO: Estructura y sintaxis conformes al contrato.');
    } else {
      for (const err of res.errors) {
        totalErrors++;
        lines.push(`   ❌ [ERROR] Línea ${err.line}: ${err.message}`);
        if (err.expected && err.found) {
          lines.push(`      • Esperado: ${err.expected}`);
          lines.push(`      • Encontrado: ${err.found}`);
        }
      }
      for (const warn of res.warnings) {
        totalWarnings++;
        lines.push(`   ⚠️  [AVISO] Línea ${warn.line}: ${warn.message}`);
      }
    }
    lines.push('');
  }

  lines.push('--------------------------------------------------------------------------------');
  lines.push(`Resumen: ${totalErrors} error(es), ${totalWarnings} aviso(s).`);
  if (totalErrors === 0) {
    lines.push('Resultado: LUZ VERDE TOTAL ✅ (Listo para QA auditor y recapitulativo)');
  } else {
    lines.push('Resultado: REPROBADO ❌ (Corrige las líneas señaladas antes de continuar)');
  }
  lines.push('--------------------------------------------------------------------------------');

  return {
    output: lines.join('\n'),
    totalErrors,
    totalWarnings,
  };
}

module.exports = {
  formatReport,
};
