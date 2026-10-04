#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOSTS = ['claude-code', 'codex', 'cursor', 'antigravity'];

function usage() {
  return `Usage: node scripts/install-skill.js --scope project|global --hosts claude-code,codex,cursor,antigravity|all [--project PATH] [--source PATH] [--apply] [--update] [--uninstall]\n\nDefaults to dry-run. Writes only when --apply is present.\nUse --update to safely overwrite / upgrade an existing installation.\nUse --uninstall to remove existing installations for the selected scope and hosts.`;
}

function parseArgs(argv) {
  const options = {
    projectRoot: process.cwd(),
    homeDir: os.homedir(),
    apply: false,
    update: false,
    uninstall: false,
    sourceDir: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--update') {
      options.update = true;
    } else if (arg === '--uninstall') {
      options.uninstall = true;
    } else if (arg === '--scope') {
      options.scope = argv[++i];
    } else if (arg === '--hosts') {
      options.hosts = argv[++i].split(',').map((host) => host.trim()).filter(Boolean);
    } else if (arg === '--project') {
      options.projectRoot = argv[++i];
    } else if (arg === '--source') {
      options.sourceDir = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function uniqueTargets(targets) {
  const seen = new Map();
  for (const target of targets) {
    const key = path.resolve(target.destination);
    if (!seen.has(key)) {
      seen.set(key, { ...target, destination: key });
    } else {
      seen.get(key).hosts.push(...target.hosts);
    }
  }
  return Array.from(seen.values()).map((target) => ({
    ...target,
    hosts: Array.from(new Set(target.hosts)),
  }));
}

function calculateTargets({ hosts, scope, projectRoot = process.cwd(), homeDir = os.homedir() }) {
  if (scope !== 'project' && scope !== 'global') {
    throw new Error('Scope is required and must be project or global');
  }
  if (!Array.isArray(hosts) || hosts.length === 0) {
    throw new Error('Hosts are required');
  }
  const requested = hosts.includes('all') ? HOSTS : hosts;
  for (const host of requested) {
    if (!HOSTS.includes(host)) {
      throw new Error(`Unsupported host: ${host}`);
    }
  }

  const project = path.resolve(projectRoot);
  const home = path.resolve(homeDir);
  const base = scope === 'project' ? project : home;
  const targets = [];
  const add = (host, destination) => targets.push({ host, hosts: [host], scope, destination });

  for (const host of requested) {
    if (host === 'claude-code') {
      add(host, path.join(base, '.claude', 'skills', 'vsdd'));
    } else if (host === 'codex') {
      add(host, path.join(base, '.agents', 'skills', 'vsdd'));
    } else if (host === 'cursor') {
      add(host, path.join(base, '.agents', 'skills', 'vsdd'));
    } else if (host === 'antigravity') {
      const root = scope === 'project'
        ? path.join(project, '.agents', 'skills', 'vsdd')
        : path.join(home, '.gemini', 'config', 'skills', 'vsdd');
      add(host, root);
    }
  }

  return uniqueTargets(targets);
}

function walkSource(sourceDir) {
  const root = path.resolve(sourceDir);
  const entries = [];

  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory()) {
    throw new Error(`Source is not a directory: ${root}`);
  }

  const isRepoRoot = fs.existsSync(path.join(root, '.git')) || fs.existsSync(path.join(root, 'scripts', 'install-skill.js'));

  function visit(current) {
    const stat = fs.lstatSync(current);
    const relative = path.relative(root, current);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) {
      throw new Error(`Unsupported source entry: ${relative || current}`);
    }

    if (isRepoRoot) {
      if (relative && relative !== 'SKILL.md' && relative !== 'references' && !relative.startsWith(`references${path.sep}`)) {
        return;
      }
    }

    if (stat.isDirectory()) {
      if (relative) entries.push({ type: 'dir', relative });
      const children = fs.readdirSync(current).sort();
      for (const child of children) visit(path.join(current, child));
    } else {
      entries.push({ type: 'file', relative });
    }
  }

  visit(root);
  return entries;
}

function destinationState(sourceDir, destination, entries) {
  if (!fs.existsSync(destination)) return 'missing';
  const stat = fs.lstatSync(destination);
  if (!stat.isDirectory()) return 'conflict';

  const expected = new Map(entries.map((entry) => [entry.relative, entry.type]));
  let conflict = false;

  function scan(current) {
    const relative = path.relative(destination, current);
    const currentStat = fs.lstatSync(current);
    const expectedType = relative ? expected.get(relative) : 'dir';
    if (currentStat.isSymbolicLink() || !expectedType) {
      conflict = true;
      return;
    }
    if (currentStat.isDirectory()) {
      if (expectedType !== 'dir') {
        conflict = true;
        return;
      }
      for (const child of fs.readdirSync(current)) scan(path.join(current, child));
    } else if (currentStat.isFile()) {
      if (expectedType !== 'file') {
        conflict = true;
        return;
      }
      const sourceFile = path.join(sourceDir, relative);
      if (!fs.readFileSync(current).equals(fs.readFileSync(sourceFile))) {
        conflict = true;
      }
    } else {
      conflict = true;
    }
  }

  scan(destination);
  return conflict ? 'conflict' : 'identical';
}

function copyTree(sourceDir, destination, entries, { update = false } = {}) {
  const created = [];

  function ensureDir(dir) {
    if (fs.existsSync(dir)) return;
    const parent = path.dirname(dir);
    if (parent && parent !== dir) {
      ensureDir(parent);
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      created.push({ type: 'dir', path: dir });
    }
  }

  try {
    ensureDir(destination);
    for (const entry of entries) {
      const target = path.join(destination, entry.relative);
      if (entry.type === 'dir') {
        ensureDir(target);
      } else {
        ensureDir(path.dirname(target));
        if (update && fs.existsSync(target)) {
          fs.copyFileSync(path.join(sourceDir, entry.relative), target);
        } else {
          fs.copyFileSync(path.join(sourceDir, entry.relative), target, fs.constants.COPYFILE_EXCL);
        }
        created.push({ type: 'file', path: target });
      }
    }

    if (update && fs.existsSync(destination)) {
      const allowed = new Set(entries.map((e) => e.relative));
      function cleanObsolete(current) {
        const relative = path.relative(destination, current);
        if (relative && !allowed.has(relative)) {
          const stat = fs.lstatSync(current);
          if (stat.isDirectory()) {
            for (const child of fs.readdirSync(current)) {
              cleanObsolete(path.join(current, child));
            }
            if (fs.readdirSync(current).length === 0) fs.rmdirSync(current);
          } else {
            fs.unlinkSync(current);
          }
          return;
        }
        if (fs.lstatSync(current).isDirectory()) {
          for (const child of fs.readdirSync(current)) {
            cleanObsolete(path.join(current, child));
          }
        }
      }
      cleanObsolete(destination);
    }
  } catch (error) {
    if (!update) {
      for (const item of created.reverse()) {
        try {
          if (item.type === 'file' && fs.existsSync(item.path)) fs.unlinkSync(item.path);
          if (item.type === 'dir' && fs.existsSync(item.path) && fs.readdirSync(item.path).length === 0) fs.rmdirSync(item.path);
        } catch (_) {
          // Best-effort rollback
        }
      }
    }
    throw error;
  }
}

function resolveSourceDir(projectRoot, customSource) {
  if (customSource) return path.resolve(customSource);
  const root = path.resolve(projectRoot);
  if (fs.existsSync(path.join(root, 'SKILL.md'))) {
    return root;
  }
  const agentsPath = path.join(root, '.agents', 'skills', 'vsdd');
  if (fs.existsSync(path.join(agentsPath, 'SKILL.md'))) {
    return agentsPath;
  }
  const pkgRoot = path.resolve(__dirname, '..');
  if (fs.existsSync(path.join(pkgRoot, 'SKILL.md'))) {
    return pkgRoot;
  }
  return root;
}

function uninstallSkill({ scope, hosts, projectRoot = process.cwd(), homeDir = os.homedir(), apply = false }) {
  const project = path.resolve(projectRoot);
  const targets = calculateTargets({ hosts, scope, projectRoot: project, homeDir });
  const operations = targets.map((target) => {
    const exists = fs.existsSync(target.destination);
    let status;
    if (!exists) {
      status = 'not-found';
    } else {
      status = apply ? 'removed' : 'would-remove';
    }
    return {
      ...target,
      status,
    };
  });

  if (apply) {
    for (const operation of operations) {
      if (operation.status === 'removed') {
        fs.rmSync(operation.destination, { recursive: true, force: true });
      }
    }
  }

  return { applied: Boolean(apply), uninstalled: true, operations };
}

function installSkill({ scope, hosts, projectRoot = process.cwd(), homeDir = os.homedir(), sourceDir, apply = false, update = false, uninstall = false }) {
  if (uninstall) {
    return uninstallSkill({ scope, hosts, projectRoot, homeDir, apply });
  }

  const project = path.resolve(projectRoot);
  if (scope === 'project') {
    let projectStat;
    try {
      projectStat = fs.lstatSync(project);
    } catch (_) {
      throw new Error(`Project root must already exist as a directory: ${project}`);
    }
    if (!projectStat.isDirectory()) {
      throw new Error(`Project root must already exist as a directory: ${project}`);
    }
  }

  const source = resolveSourceDir(project, sourceDir);
  const entries = walkSource(source);
  if (!entries.some((entry) => entry.type === 'file' && entry.relative === 'SKILL.md')) {
    throw new Error(`Source does not contain SKILL.md: ${source}`);
  }

  const targets = calculateTargets({ hosts, scope, projectRoot: project, homeDir });
  const operations = targets.map((target) => {
    const state = destinationState(source, target.destination, entries);
    let status;
    if (state === 'missing') {
      status = apply ? 'created' : 'would-create';
    } else if (state === 'identical') {
      status = 'unchanged';
    } else {
      if (update) {
        status = apply ? 'updated' : 'would-update';
      } else {
        status = 'conflict';
      }
    }
    return {
      ...target,
      status,
    };
  });

  const conflict = operations.find((operation) => operation.status === 'conflict');
  if (conflict) {
    throw new Error(`Conflicting destination refuses overwrite: ${conflict.destination}. Use --update to upgrade existing installations.`);
  }

  if (apply) {
    for (const operation of operations) {
      if (operation.status === 'created' || operation.status === 'updated') {
        copyTree(source, operation.destination, entries, { update });
      }
    }
  }

  return { applied: Boolean(apply), updated: Boolean(update), source, operations };
}

function printResult(result) {
  if (result.uninstalled) {
    console.log(result.applied ? 'Apply mode: removing skill files.' : 'Dry run: no files were removed. Use --apply to remove.');
    for (const operation of result.operations) {
      console.log(`${operation.status}: ${operation.destination} (${operation.hosts.join(',')})`);
    }
    return;
  }
  console.log(result.applied ? 'Apply mode: copying skill files.' : 'Dry run: no files were written. Use --apply to copy.');
  console.log(`Source: ${result.source}`);
  for (const operation of result.operations) {
    console.log(`${operation.status}: ${operation.destination} (${operation.hosts.join(',')})`);
  }
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    if (!options.scope || !options.hosts) {
      throw new Error('Both --scope and --hosts are required.');
    }
    const result = installSkill(options);
    printResult(result);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  HOSTS,
  calculateTargets,
  installSkill,
  uninstallSkill,
  parseArgs,
  walkSource,
  resolveSourceDir,
};
