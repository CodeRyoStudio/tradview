import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const coreRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const coreSrc = join(coreRoot, 'src');

const UI_SHELL_IMPORT_PATTERNS = [
  /from\s+['"]@coderyo\/ui-shell(?:\/[^'"]*)?['"]/,
  /import\s*\(\s*['"]@coderyo\/ui-shell(?:\/[^'"]*)?['"]/,
  /require\s*\(\s*['"]@coderyo\/ui-shell(?:\/[^'"]*)?['"]/,
  /export\s+[\w*{}\s,]+\s+from\s+['"]@coderyo\/ui-shell(?:\/[^'"]*)?['"]/,
  /from\s+['"]\.\.[^'"]*ui-shell[^'"]*['"]/,
];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...listSourceFiles(path));
    } else if ((name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.d.ts')) {
      out.push(path);
    }
  }
  return out;
}

function findUiShellImportViolations(rel: string, content: string): string | undefined {
  if (rel.includes('ui-shell')) {
    return 'path segment ui-shell';
  }
  for (const pattern of UI_SHELL_IMPORT_PATTERNS) {
    if (pattern.test(content)) {
      return pattern.source;
    }
  }
  return undefined;
}

describe('@coderyo/core architecture boundary (V2-00)', () => {
  it('does not declare @coderyo/ui-shell in package.json dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(coreRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ];
    expect(names).not.toContain('@coderyo/ui-shell');
  });

  it('does not import ui-shell from packages/core/src (.ts/.tsx, multiline)', () => {
    const violations: { file: string; detail: string }[] = [];
    for (const file of listSourceFiles(coreSrc)) {
      const rel = file.slice(coreSrc.length + 1).replace(/\\/g, '/');
      const content = readFileSync(file, 'utf8');
      const detail = findUiShellImportViolations(rel, content);
      if (detail) {
        violations.push({ file: rel, detail });
      }
    }
    expect(violations).toEqual([]);
  });
});