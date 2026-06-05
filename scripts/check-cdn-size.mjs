#!/usr/bin/env node
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bundles = [
  {
    path: resolve(root, 'bundle/cdn/dist/tradview.min.js'),
    label: 'tradview.min.js',
    maxKb: Number(process.env.TRADVIEW_CDN_MAX_KB ?? 400),
  },
  {
    path: resolve(root, 'bundle/cdn-webgl/dist/tradview-webgl.min.js'),
    label: 'tradview-webgl.min.js',
    maxKb: Number(process.env.TRADVIEW_CDN_WEBGL_MAX_KB ?? 400),
  },
];

let failed = false;

for (const { path: bundlePath, label, maxKb } of bundles) {
  if (!existsSync(bundlePath)) {
    console.error(`[cdn-size] missing bundle: ${bundlePath}\nRun: pnpm build:cdn`);
    failed = true;
    continue;
  }
  const raw = readFileSync(bundlePath);
  const gzipKb = gzipSync(raw).length / 1024;
  console.log(`[cdn-size] ${label} gzip: ${gzipKb.toFixed(1)} KB (limit ${maxKb} KB)`);
  if (gzipKb > maxKb) {
    console.error(`[cdn-size] FAIL: ${label} exceeds ${maxKb} KB gzip budget`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('[cdn-size] OK');