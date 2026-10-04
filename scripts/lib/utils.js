'use strict';

const fs = require('fs');

function truncateText(text, maxLen) {
  if (!text) return '';
  const clean = text.replace(/\n+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 3) + '...';
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return '';
  }
}

function isGenericUtility(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  const clean = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    clean.includes('node_modules/') ||
    clean.includes('vendor/') ||
    clean.includes('.git/') ||
    clean.includes('utils/') ||
    clean.includes('util/') ||
    clean.includes('helpers/') ||
    clean.includes('types/') ||
    clean.endsWith('/index.js') ||
    clean.endsWith('/index.ts') ||
    clean.endsWith('readme.md') ||
    clean.endsWith('package.json')
  );
}

module.exports = {
  truncateText,
  readFileSafe,
  isGenericUtility,
};
