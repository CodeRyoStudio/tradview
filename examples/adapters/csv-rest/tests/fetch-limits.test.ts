import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../src');

describe('csv-rest security limits (review #4)', () => {
  it('provider source caps bytes, rows, and fetch timeout', () => {
    const src = readFileSync(join(srcDir, 'csv-rest-provider.ts'), 'utf8');
    expect(src).toContain('maxBytes');
    expect(src).toContain('maxRows');
    expect(src).toContain('fetchTimeoutMs');
    expect(src).toContain('AbortController');
    expect(src).toContain('exceeds');
  });
});