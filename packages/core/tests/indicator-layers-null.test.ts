import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { clearedIndicatorConfig } from '@coderyo/indicators';

const chartControllerSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/chart-controller.ts'),
  'utf8',
);

describe('ChartController indicator layers when indicators is null', () => {
  it('listIndicatorLayers returns empty when indicators is null', () => {
    const fn = chartControllerSrc.slice(
      chartControllerSrc.indexOf('listIndicatorLayers()'),
      chartControllerSrc.indexOf('disableIndicatorLayer(id'),
    );
    expect(fn).toContain('if (this.features.indicators === null) return []');
    expect(fn).not.toContain('DEFAULT_INDICATOR_CONFIG');
  });

  it('disableIndicatorLayer no-op returns clearedIndicatorConfig without setIndicatorConfig', () => {
    const match = chartControllerSrc.match(
      /disableIndicatorLayer\(id: IndicatorLayerId\): IndicatorConfig \{[\s\S]*?\n  \}/,
    );
    expect(match).not.toBeNull();
    const fn = match![0]!;
    expect(fn).toContain('if (this.features.indicators === null)');
    expect(fn).toContain('return clearedIndicatorConfig()');
    const nullBranch = fn.slice(
      fn.indexOf('if (this.features.indicators === null)'),
      fn.indexOf('const next = applyDisableIndicatorLayer'),
    );
    expect(nullBranch).not.toContain('setIndicatorConfig');
    expect(clearedIndicatorConfig().showMacd).toBe(false);
  });
});