#!/usr/bin/env node
/** PR-06 gate: core + renderer-lite + LWC path gzip budget (DESIGN D18). */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'bundle/lwc-gate/dist/lwc-gate.min.js');
const maxGzipKb = Number(process.env.TRADVIEW_LWC_MAX_KB ?? 180);

if (!existsSync(bundlePath)) {
  console.log('[lwc-size] building @coderyo/lwc-gate bundle…');
  const r = spawnSync('pnpm', ['--filter', '@coderyo/lwc-gate', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(bundlePath)) {
  console.error(`[lwc-size] missing bundle: ${bundlePath}`);
  process.exit(1);
}

const raw = readFileSync(bundlePath);
const gzipBytes = gzipSync(raw).length;
const gzipKb = gzipBytes / 1024;

console.log(`[lwc-size] lwc-gate.min.js gzip: ${gzipKb.toFixed(1)} KB (limit ${maxGzipKb} KB)`);

if (gzipKb > maxGzipKb) {
  console.error(`[lwc-size] FAIL: exceeds ${maxGzipKb} KB gzip budget (DESIGN D18)`);
  process.exit(1);
}

console.log('[lwc-size] OK');