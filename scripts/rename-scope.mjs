#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SKIP = new Set(['node_modules', '.git', 'agent-tools', 'terminals', 'dist']);
const EXT = /\.(json|ts|tsx|js|mjs|md|yaml|yml)$/;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.has(name)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (EXT.test(name)) files.push(p);
  }
  return files;
}

let count = 0;
for (const file of walk(root)) {
  const rel = relative(root, file);
  if (rel === 'scripts/rename-scope.mjs') continue;
  let text = readFileSync(file, 'utf8');
  if (!text.includes('@coderyo')) continue;
  text = text.replaceAll('@coderyo', '@coderyo');
  writeFileSync(file, text, 'utf8');
  count += 1;
  console.log(`[rename-scope] ${rel}`);
}
console.log(`[rename-scope] updated ${count} files`);