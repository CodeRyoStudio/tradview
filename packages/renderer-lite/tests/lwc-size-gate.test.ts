import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const bundlePath = resolve(repoRoot, 'bundle/lwc-gate/dist/lwc-gate.min.js');
const maxGzipKb = Number(process.env.TRADVIEW_LWC_MAX_KB ?? 180);
const bundleExists = existsSync(bundlePath);
const ci = process.env.CI === 'true' || process.env.CI === '1';

describe('PR-06 LWC bundle size gate (DESIGN D18)', () => {
  it('fails in CI when bundle artifact is missing', () => {
    if (bundleExists || !ci) return;
    throw new Error(
      'Missing bundle/lwc-gate/dist/lwc-gate.min.js — run: pnpm check:lwc-size (builds @coderyo/lwc-gate)',
    );
  });

  it.skipIf(!bundleExists)(
    'lwc-gate.min.js gzip stays under budget when built',
    () => {
      const gzipKb = gzipSync(readFileSync(bundlePath)).length / 1024;
      expect(gzipKb).toBeLessThanOrEqual(maxGzipKb);
    },
  );
});