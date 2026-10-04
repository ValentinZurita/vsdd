'use strict';

const DEFAULT_TIMEOUT_MS = 1500;
const MAX_FS_FILES = 20000;
const MAX_NODES_DEFAULT = 40;

const IGNORED_FS_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
  'vendor',
  '__pycache__',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
]);

module.exports = {
  DEFAULT_TIMEOUT_MS,
  MAX_FS_FILES,
  MAX_NODES_DEFAULT,
  IGNORED_FS_DIRS,
};
