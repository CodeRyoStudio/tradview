#!/usr/bin/env node
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'bundle/cdn/dist/tradview.min.js');
const maxGzipKb = Number(process.env.TRADVIEW_CDN_MAX_KB ?? 400);

if (!existsSync(bundlePath)) {
  console.error(`[cdn-size] missing bundle: ${bundlePath}\nRun: pnpm --filter @tradview/cdn-bundle build`);
  process.exit(1);
}

const raw = readFileSync(bundlePath);
const gzipBytes = gzipSync(raw).length;
const gzipKb = gzipBytes / 1024;

console.log(`[cdn-size] tradview.min.js gzip: ${gzipKb.toFixed(1)} KB (limit ${maxGzipKb} KB)`);

if (gzipKb > maxGzipKb) {
  console.error(`[cdn-size] FAIL: exceeds ${maxGzipKb} KB gzip budget (DESIGN D17)`);
  process.exit(1);
}

console.log('[cdn-size] OK');