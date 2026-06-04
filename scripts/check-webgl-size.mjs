#!/usr/bin/env node
/**
 * V2-R2 gate: @coderyo/renderer-webgl ESM bundle raw size (DESIGN-v2 §8).
 * Default 80 KB raw = R2 cap (40 KB) + phase_beta increment (V2-R5–R8, ≤40 KB).
 * Override: TRADVIEW_WEBGL_MAX_KB.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'packages/renderer-webgl/dist/index.js');
const maxKb = Number(process.env.TRADVIEW_WEBGL_MAX_KB ?? 80);

if (!existsSync(bundlePath)) {
  console.log('[webgl-size] building @coderyo/renderer-webgl…');
  const r = spawnSync('pnpm', ['--filter', '@coderyo/renderer-webgl', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(bundlePath)) {
  console.error(`[webgl-size] missing bundle: ${bundlePath}`);
  process.exit(1);
}

const rawBytes = readFileSync(bundlePath).length;
const rawKb = rawBytes / 1024;

console.log(`[webgl-size] dist/index.js: ${rawKb.toFixed(1)} KB (limit ${maxKb} KB raw)`);

if (rawKb > maxKb) {
  console.error(`[webgl-size] FAIL: exceeds ${maxKb} KB raw budget (DESIGN-v2 §8)`);
  process.exit(1);
}

console.log('[webgl-size] OK');