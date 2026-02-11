#!/usr/bin/env node

/**
 * Fix ESM imports in TypeScript-compiled output.
 * Adds .js extensions to relative imports missing them.
 * Handles both file imports (./foo → ./foo.js) and
 * directory imports (./skills → ./skills/index.js).
 *
 * Usage: node scripts/fix-esm-imports.mjs <dist-dir>
 */

import { readdir, readFile, writeFile, stat, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const distDir = process.argv[2];
if (!distDir) {
  console.error('Usage: node scripts/fix-esm-imports.mjs <dist-dir>');
  process.exit(1);
}

const resolvedDistDir = resolve(distDir);

// Regex to match: from './path' or from '../path' (without .js/.json extension)
// Also matches: export ... from './path'
const IMPORT_RE = /(from\s+['"])(\.\.?\/[^'"]*?)(?<!\.js)(?<!\.json)(['"])/g;

// Regex to match: from './path.js' where path.js doesn't actually exist as a file
// but ./path/ is a directory with index.js (stale fix from previous runs)
const STALE_JS_RE = /(from\s+['"])(\.\.?\/[^'"]*?)(\.js)(['"])/g;

async function* walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts')) {
      yield fullPath;
    }
  }
}

/**
 * Determine the correct .js extension path for an import.
 * If the import points to a directory with an index.js, use /index.js.
 * Otherwise, add .js.
 */
function resolveImportPath(importPath, fromFile) {
  const fromDir = dirname(fromFile);
  const resolved = resolve(fromDir, importPath);

  // Check if it's a directory with index.js
  if (existsSync(resolved) && existsSync(join(resolved, 'index.js'))) {
    return `${importPath}/index.js`;
  }

  // Check if it's a directory with index.d.ts (for .d.ts files)
  if (existsSync(resolved) && existsSync(join(resolved, 'index.d.ts'))) {
    return `${importPath}/index.js`;
  }

  // Otherwise, just add .js
  return `${importPath}.js`;
}

let fixedFiles = 0;
let fixedImports = 0;

for await (const filePath of walkDir(resolvedDistDir)) {
  const content = await readFile(filePath, 'utf-8');
  let modified = false;

  // Pass 1: Fix imports without .js extension
  let newContent = content.replace(IMPORT_RE, (match, prefix, path, suffix) => {
    if (path.endsWith('.js') || path.endsWith('.json')) {
      return match;
    }
    modified = true;
    fixedImports++;
    const fixedPath = resolveImportPath(path, filePath);
    return `${prefix}${fixedPath}${suffix}`;
  });

  // Pass 2: Fix stale .js imports (e.g., ./transports.js → ./transports/index.js)
  // This handles cases where a previous run added .js but the path is actually a directory.
  newContent = newContent.replace(STALE_JS_RE, (match, prefix, basePath, ext, suffix) => {
    const fromDir = dirname(filePath);
    const resolvedWithJs = resolve(fromDir, basePath + ext);
    const resolvedAsDir = resolve(fromDir, basePath);

    // If ./foo.js doesn't exist as a file, but ./foo/ is a directory with index.js
    if (!existsSync(resolvedWithJs) && existsSync(resolvedAsDir) && existsSync(join(resolvedAsDir, 'index.js'))) {
      modified = true;
      fixedImports++;
      return `${prefix}${basePath}/index.js${suffix}`;
    }
    return match;
  });

  if (modified) {
    await writeFile(filePath, newContent, 'utf-8');
    fixedFiles++;
  }
}

console.log(`Fixed ${fixedImports} imports in ${fixedFiles} files`);
