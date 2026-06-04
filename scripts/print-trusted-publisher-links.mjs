#!/usr/bin/env node
/** Print npm Trusted Publishing setup links for Method A (OIDC). */
const packages = [
  '@coderyo/bridge',
  '@coderyo/core',
  '@coderyo/data',
  '@coderyo/series',
  '@coderyo/virtual-window',
  '@coderyo/renderer-lite',
  '@coderyo/renderer-webgl',
  '@coderyo/interaction',
  '@coderyo/pine-lite',
  '@coderyo/indicators',
  '@coderyo/i18n',
  '@coderyo/drawings',
  '@coderyo/ui-shell',
];

const enc = (name) => encodeURIComponent(name);

console.log('Trusted Publishing — 每個套件各設一次（workflow: release.yml）\n');
console.log('| Package | npm Settings |');
console.log('|---------|----------------|');
for (const name of packages) {
  const url = `https://www.npmjs.com/package/${enc(name)}/settings`;
  console.log(`| ${name} | ${url} |`);
}
console.log('\n表單欄位（每包相同）：');
console.log('  Organization or user: CodeRyoStudio');
console.log('  Repository: tradview');
console.log('  Workflow filename: release.yml');
console.log('  Allowed actions: npm publish');
console.log('\n完成後：GitHub → Actions → Release → Run workflow');