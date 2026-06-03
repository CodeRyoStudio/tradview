#!/usr/bin/env node
/**
 * Sync VERSION file → all publishable package.json + bundle/cdn.
 * Skips private packages (root, apps/*, cli-dev).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const version = readFileSync(resolve(root, 'VERSION'), 'utf8').trim();

if (!/^\d+\.\d+\.\d+(-rc\.\d+)?$/.test(version)) {
  console.error(`[sync-versions] invalid VERSION: ${version}`);
  process.exit(1);
}

const targets = [
  ...readdirSync(resolve(root, 'packages')).map((d) => join('packages', d)),
  join('bundle', 'cdn'),
];

let updated = 0;
for (const rel of targets) {
  const pkgPath = resolve(root, rel, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const raw = readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, '');
  const pkg = JSON.parse(raw);
  if (pkg.private) continue;
  let changed = false;
  if (pkg.version !== version) {
    pkg.version = version;
    changed = true;
  }
  if (!pkg.files) {
    pkg.files = ['dist'];
    changed = true;
  }
  const repo = {
    type: 'git',
    url: 'git+https://github.com/CodeRyoStudio/tradview.git',
    directory: rel.replace(/\\/g, '/'),
  };
  if (JSON.stringify(pkg.repository) !== JSON.stringify(repo)) {
    pkg.repository = repo;
    changed = true;
  }
  if (pkg.license === 'MIT' && pkg.publishConfig?.access !== 'public') {
    pkg.publishConfig = { access: 'public' };
    changed = true;
  }
  if (!changed) continue;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  updated += 1;
  console.log(`[sync-versions] ${pkg.name} → ${version}`);
}

const coreVersionTs = resolve(root, 'packages/core/src/version.ts');
writeFileSync(
  coreVersionTs,
  `/** Synced by scripts/sync-versions.mjs from repo VERSION file */\nexport const TRADVIEW_VERSION = '${version}' as const;\n`,
  'utf8',
);
console.log(`[sync-versions] packages/core/src/version.ts → ${version}`);
console.log(`[sync-versions] done (${updated} package.json updated)`);