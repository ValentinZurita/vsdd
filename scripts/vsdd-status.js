#!/usr/bin/env node
'use strict';

const path = require('path');

// -------------------------------------------------------------
// Importación modular desde scripts/lib/
// -------------------------------------------------------------
const {
  resolveReferenceFile,
  resolveTargetFile,
  getIntakeDraftPath,
} = require('./lib/paths');

const {
  truncateText,
  readFileSafe,
  isGenericUtility,
} = require('./lib/utils');

const {
  execGit,
  getGitRoot,
  hasGitCommits,
  isCommitInTree,
  getCurrentBranch,
  getRepositoryBranches,
  getDefaultBranch,
} = require('./lib/git');

const {
  parseTrackedFilesFromPlanContent,
  extractTrackedFiles,
  calculateFeatureDrift,
} = require('./lib/drift');

const {
  saveFeatureContext,
  saveFeatureExploration,
  getFeatureExploration,
  saveIntakeDraft,
  getIntakeDraft,
  clearIntakeDraft,
  promoteIntakeDraft,
  saveInterviewAnswer,
  getInterviewProgress,
  clearInterviewProgress,
  saveIntakeInterviewAnswer,
} = require('./lib/state');

const {
  extractHeaderState,
  extractObjective,
  extractArchivosClaveSafe,
  parseFeatureDirectory,
  scanFeatures,
  generateFeatureCatalog,
} = require('./lib/features');

const {
  formatUpdateBanner,
  formatMismatchBanner,
  formatHubMenu,
} = require('./lib/tui');

const {
  abortFeature,
} = require('./lib/abort');

const {
  compareSemver,
  getLocalVsddVersion,
  getCanonicalVersion,
} = require('./lib/version');

const {
  detectDualInstallationMismatch,
  checkVersionUpdate,
  performVsddUpdate,
} = require('./lib/update');

// -------------------------------------------------------------
// Punto de entrada CLI
// -------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const cwd = process.cwd();

    function getCliDir(cliArgs, commandFlag, workingDir) {
      const dirIdx = cliArgs.indexOf(commandFlag);
      if (dirIdx !== -1 && cliArgs[dirIdx + 1] && !cliArgs[dirIdx + 1].startsWith('--')) {
        return path.resolve(workingDir, cliArgs[dirIdx + 1]);
      }
      const explicitDirIdx = cliArgs.indexOf('--dir');
      if (explicitDirIdx !== -1 && cliArgs[explicitDirIdx + 1] && !cliArgs[explicitDirIdx + 1].startsWith('--')) {
        return path.resolve(workingDir, cliArgs[explicitDirIdx + 1]);
      }
      return '';
    }

    function getCliPhase(cliArgs) {
      const phaseIdx = cliArgs.indexOf('--phase');
      if (phaseIdx !== -1 && cliArgs[phaseIdx + 1] && !cliArgs[phaseIdx + 1].startsWith('--')) {
        return cliArgs[phaseIdx + 1];
      }
      return '';
    }

    if (args.includes('--version') || args.includes('-v')) {
      const version = getLocalVsddVersion(cwd);
      if (args.includes('--json')) {
        console.log(JSON.stringify({ version }));
      } else {
        console.log(`⚡ VSDD v${version}`);
      }
      return;
    }

    if (args.includes('update') || args.includes('--update')) {
      const isJson = args.includes('--json');
      if (!isJson) {
        console.log(
          `╭── ⚡ ACTUALIZACIÓN DE VSDD ──────────╮\n│ Buscando e instalando última versión │\n╰──────────────────────────────────────╯\n`
        );
      }
      const result = performVsddUpdate(cwd);
      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
        if (!result.success) {
          process.exit(1);
        }
      } else {
        if (result.success) {
          console.log(`✔ [✓ OK] ${result.message}`);
        } else {
          console.error(`✖ [✕ FAIL] ${result.message}`);
          process.exit(1);
        }
      }
    } else if (args.includes('--abort')) {
      const abortIdx = args.indexOf('--abort');
      const featureId = args[abortIdx + 1];
      if (!featureId || featureId.startsWith('--')) {
        console.error(
          JSON.stringify({ error: 'Debe especificar el ID de la funcionalidad a cancelar tras --abort.' })
        );
        process.exit(1);
      }
      const reasonIdx = args.indexOf('--reason');
      const reason = reasonIdx !== -1 && args[reasonIdx + 1] ? args[reasonIdx + 1] : '';
      const deleteBranch = args.includes('--delete-branch');
      const result = abortFeature(featureId, { reason, deleteBranch }, cwd);
      if (args.includes('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(`✔ ${result.message}`);
          if (result.switchedBranch) {
            console.log(`  • Retornado a la rama base '${result.baseBranch || 'main'}' con éxito.`);
          }
          if (result.branchDeleted) {
            console.log(`  ⚠️ ADVERTENCIA DESTRUCTIVA: Rama de trabajo '${result.targetBranch}' eliminada permanentemente.`);
            console.log(`    Todos los cambios y commits exclusivos de esta funcionalidad fueron descartados de Git.`);
            console.log(`    (Si fue una equivocación involuntaria, puedes recuperar los commits temporalmente con: git reflog)`);
          } else if (result.targetBranch) {
            console.log(`  ℹ Rama de trabajo '${result.targetBranch}' y código preservados en Git.`);
            console.log(
              `    (Para descartar la rama y todo su código en el futuro, ejecuta: vsdd --abort ${result.featureId} --delete-branch)`
            );
          }
        } else {
          console.error(`▲ ${result.message}`);
          process.exit(1);
        }
      }
    } else if (args.includes('--catalog')) {
      const catalog = generateFeatureCatalog(cwd);
      console.log(JSON.stringify(catalog, null, 2));
    } else if (args.includes('--json')) {
      const features = scanFeatures(cwd);
      console.log(JSON.stringify(features, null, 2));
    } else if (args.includes('--intake-draft')) {
      const draft = getIntakeDraft(cwd);
      console.log(JSON.stringify(draft, null, 2));
    } else if (args.includes('--clear-intake-draft')) {
      const success = clearIntakeDraft(cwd);
      console.log(JSON.stringify({ cleared: success }, null, 2));
    } else if (args.includes('--save-intake-draft')) {
      const dataIdx = args.indexOf('--data');
      const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
      let data = {};
      try {
        data = JSON.parse(dataRaw);
      } catch (e) {
        data = { ideaSummary: dataRaw };
      }
      const result = saveIntakeDraft(data, cwd);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--promote-intake-draft')) {
      const featureDir = getCliDir(args, '--promote-intake-draft', cwd);
      if (!featureDir) {
        console.error(JSON.stringify({ error: 'Directorio de funcionalidad requerido para --promote-intake-draft' }));
        process.exit(1);
      }
      const result = promoteIntakeDraft(featureDir, cwd);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--save-exploration')) {
      const featureDir = getCliDir(args, '--save-exploration', cwd);
      const phase = getCliPhase(args);
      if (!featureDir || !phase) {
        console.error(JSON.stringify({ error: 'Parámetros requeridos: --save-exploration <dir> --phase <phase>' }));
        process.exit(1);
      }
      const dataIdx = args.indexOf('--data');
      const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
      let data = {};
      try {
        data = JSON.parse(dataRaw);
      } catch (e) {
        data = { raw: dataRaw };
      }
      const result = saveFeatureExploration(featureDir, phase, data, cwd);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--get-exploration')) {
      const featureDir = getCliDir(args, '--get-exploration', cwd);
      const phase = getCliPhase(args);
      if (!featureDir || !phase) {
        console.error(JSON.stringify({ error: 'Parámetros requeridos: --get-exploration <dir> --phase <phase>' }));
        process.exit(1);
      }
      const result = getFeatureExploration(featureDir, phase);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--save-interview')) {
      const featureDir = getCliDir(args, '--save-interview', cwd);
      const phase = getCliPhase(args);
      if (!featureDir || !phase) {
        console.error(JSON.stringify({ error: 'Parámetros requeridos: --save-interview <dir> --phase <phase>' }));
        process.exit(1);
      }
      const dataIdx = args.indexOf('--data');
      const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
      let data = {};
      try {
        data = JSON.parse(dataRaw);
      } catch (e) {
        data = { answer: dataRaw };
      }
      const result = saveInterviewAnswer(featureDir, phase, data, cwd);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--get-interview')) {
      const featureDir = getCliDir(args, '--get-interview', cwd);
      const phase = getCliPhase(args);
      if (!featureDir || !phase) {
        console.error(JSON.stringify({ error: 'Parámetros requeridos: --get-interview <dir> --phase <phase>' }));
        process.exit(1);
      }
      const result = getInterviewProgress(featureDir, phase);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--clear-interview')) {
      const featureDir = getCliDir(args, '--clear-interview', cwd);
      const phase = getCliPhase(args);
      if (!featureDir || !phase) {
        console.error(JSON.stringify({ error: 'Parámetros requeridos: --clear-interview <dir> --phase <phase>' }));
        process.exit(1);
      }
      const result = clearInterviewProgress(featureDir, phase, cwd);
      console.log(JSON.stringify(result, null, 2));
    } else if (args.includes('--save-intake-interview')) {
      const dataIdx = args.indexOf('--data');
      const dataRaw = dataIdx !== -1 ? args[dataIdx + 1] : '{}';
      let data = {};
      try {
        data = JSON.parse(dataRaw);
      } catch (e) {
        data = { answer: dataRaw };
      }
      const result = saveIntakeInterviewAnswer(data, cwd);
      console.log(JSON.stringify(result, null, 2));
    } else {
      const features = scanFeatures(cwd);
      let updateInfo = null;
      try {
        updateInfo = await checkVersionUpdate(getLocalVsddVersion(cwd), { timeoutMs: 1500 });
      } catch (e) {}
      const mismatchInfo = detectDualInstallationMismatch(cwd);
      process.stdout.write(formatHubMenu(features, { updateInfo, mismatchInfo }));
    }
  })();
}

// -------------------------------------------------------------
// Exports canónicos (100% retrocompatibles con la suite de tests)
// -------------------------------------------------------------
module.exports = {
  scanFeatures,
  parseFeatureDirectory,
  resolveReferenceFile,
  resolveTargetFile,
  formatHubMenu,
  calculateFeatureDrift,
  extractTrackedFiles,
  parseTrackedFilesFromPlanContent,
  saveFeatureContext,
  saveFeatureExploration,
  getFeatureExploration,
  getIntakeDraftPath,
  saveIntakeDraft,
  getIntakeDraft,
  clearIntakeDraft,
  promoteIntakeDraft,
  saveInterviewAnswer,
  getInterviewProgress,
  clearInterviewProgress,
  saveIntakeInterviewAnswer,
  isGenericUtility,
  extractArchivosClaveSafe,
  generateFeatureCatalog,
  abortFeature,
  getGitRoot,
  hasGitCommits,
  isCommitInTree,
  getCurrentBranch,
  compareSemver,
  getLocalVsddVersion,
  formatUpdateBanner,
  formatMismatchBanner,
  detectDualInstallationMismatch,
  checkVersionUpdate,
  performVsddUpdate,
};
