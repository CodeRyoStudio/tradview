#!/usr/bin/env node
/** RC release gate: build, test, lint, typecheck, CDN bundle + size budget. */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const version = readFileSync(resolve(root, 'VERSION'), 'utf8').trim();

function run(cmd, args) {
  console.log(`\n[check-rc] ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`[check-rc] TradView ${version}`);

if (!existsSync(resolve(root, 'packages/core/src/version.ts'))) {
  console.error('[check-rc] missing packages/core/src/version.ts — run: pnpm version:sync');
  process.exit(1);
}

run('pnpm', ['version:sync']);
run('pnpm', ['build']);
run('pnpm', ['test']);
run('pnpm', ['typecheck']);
run('pnpm', ['lint']);
run('pnpm', ['build:cdn']);
run('pnpm', ['check:cdn-size']);
run('pnpm', ['check:lwc-size']);

console.log('\n[check-rc] All gates passed.');