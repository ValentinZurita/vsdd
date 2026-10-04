'use strict';

const { execFileSync } = require('child_process');

function execGit(args, cwd, timeout = 3000) {
  try {
    return execFileSync('git', args, {
      cwd,
      timeout,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return null;
  }
}

function getGitRoot(cwd = process.cwd()) {
  const stdout = execGit(['rev-parse', '--show-toplevel'], cwd, 1500);
  return stdout ? stdout.trim() : null;
}

function hasGitCommits(gitRoot) {
  if (!gitRoot) return false;
  const stdout = execGit(['rev-parse', '--verify', 'HEAD'], gitRoot, 1000);
  return stdout !== null;
}

function isCommitInTree(gitRoot, commitSha) {
  if (!gitRoot || !commitSha) return false;
  const stdout = execGit(['cat-file', '-e', `${commitSha}^{commit}`], gitRoot, 1000);
  return stdout !== null;
}

function getCurrentBranch(gitRoot) {
  if (!gitRoot) return '';
  const stdout = execGit(['branch', '--show-current'], gitRoot, 1000);
  return stdout ? stdout.trim() : '';
}

function getRepositoryBranches(gitRoot) {
  if (!gitRoot) return [];
  const out = execGit(['branch', '--format=%(refname:short)'], gitRoot, 1000);
  if (!out) return [];
  return out.split('\n').map((b) => b.trim()).filter(Boolean);
}

function getDefaultBranch(gitRoot) {
  if (!gitRoot) return 'main';
  const originHead = execGit(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], gitRoot, 1000);
  if (originHead) {
    return originHead.replace(/^origin\//, '').trim();
  }
  const branches = getRepositoryBranches(gitRoot);
  for (const trunk of ['main', 'master', 'develop', 'dev', 'trunk']) {
    if (branches.includes(trunk)) return trunk;
  }
  if (branches.length === 1) {
    return branches[0];
  }
  return 'main';
}

module.exports = {
  execGit,
  getGitRoot,
  hasGitCommits,
  isCommitInTree,
  getCurrentBranch,
  getRepositoryBranches,
  getDefaultBranch,
};
