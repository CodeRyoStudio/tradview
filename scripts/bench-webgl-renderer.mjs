#!/usr/bin/env node
/**
 * V2-R7: document WebGL renderer bundle size; GPU frame bench runs in playground (?bench=1).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'packages/renderer-webgl/dist/index.js');

if (!existsSync(bundlePath)) {
  spawnSync('pnpm', ['--filter', '@coderyo/renderer-webgl', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const rawKb = readFileSync(bundlePath).length / 1024;
console.log('[bench-webgl] bundle dist/index.js:', rawKb.toFixed(1), 'KB raw');
console.log('[bench-webgl] GPU frame timing: open playground webgl-demo with ?bench=1');
console.log('[bench-webgl] Example: http://127.0.0.1:5173/webgl-demo.html?bench=1');