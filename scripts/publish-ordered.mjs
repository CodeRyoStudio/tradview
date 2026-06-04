#!/usr/bin/env node
/**
 * Publish workspace packages in dependency-friendly order (OIDC / npm login).
 * Fails fast with package name so Trusted Publishing gaps are obvious.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** Leaf-first-ish order for @coderyo monorepo */
const ORDER = [
  '@coderyo/bridge',
  '@coderyo/virtual-window',
  '@coderyo/series',
  '@coderyo/i18n',
  '@coderyo/data',
  '@coderyo/renderer-lite',
  '@coderyo/renderer-webgl',
  '@coderyo/interaction',
  '@coderyo/pine-lite',
  '@coderyo/indicators',
  '@coderyo/drawings',
  '@coderyo/core',
  '@coderyo/ui-shell',
];

const tag = process.argv.includes('--tag')
  ? process.argv[process.argv.indexOf('--tag') + 1]
  : 'latest';

function pkgDir(name) {
  const map = {
    '@coderyo/bridge': 'packages/bridge',
    '@coderyo/core': 'packages/core',
    '@coderyo/data': 'packages/data',
    '@coderyo/series': 'packages/series',
    '@coderyo/virtual-window': 'packages/virtual-window',
    '@coderyo/renderer-lite': 'packages/renderer-lite',
    '@coderyo/renderer-webgl': 'packages/renderer-webgl',
    '@coderyo/interaction': 'packages/interaction',
    '@coderyo/pine-lite': 'packages/pine-lite',
    '@coderyo/indicators': 'packages/indicators',
    '@coderyo/i18n': 'packages/i18n',
    '@coderyo/drawings': 'packages/drawings',
    '@coderyo/ui-shell': 'packages/ui-shell',
  };
  return resolve(root, map[name]);
}

function isVersionOnRegistry(name, version) {
  const r = spawnSync('npm', ['view', `${name}@${version}`, 'version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return r.status === 0 && r.stdout?.trim() === version;
}

for (const name of ORDER) {
  const dir = pkgDir(name);
  if (!existsSync(resolve(dir, 'package.json'))) {
    console.error(`[publish] skip missing ${name}`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  if (isVersionOnRegistry(name, pkg.version)) {
    console.log(`\n[publish] skip ${name}@${pkg.version} (already on npm)`);
    continue;
  }
  console.log(`\n[publish] ${name}@${pkg.version} …`);
  const r = spawnSync(
    'npm',
    ['publish', '--access', 'public', '--tag', tag],
    { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (r.status !== 0) {
    console.error(
      `\n[publish] FAILED: ${name}\n` +
        '  → 若為 E404/ENEEDAUTH：到 npm 套件 Settings → Trusted publishing 綁定 release.yml\n' +
        `  → https://www.npmjs.com/package/${encodeURIComponent(name)}/settings`,
    );
    process.exit(r.status ?? 1);
  }
}

console.log('\n[publish] All packages published.');