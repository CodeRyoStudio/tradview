import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Indicators from '../src/index.js';

const PUBLIC_INDICATORS_VALUE_EXPORTS = [
  'DEFAULT_INDICATOR_CONFIG',
  'boll',
  'clearedIndicatorConfig',
  'disableIndicatorLayer',
  'ema',
  'hasAnyActiveIndicators',
  'hasMainChartOverlays',
  'hasVisibleIndicatorPanes',
  'indicatorConfigStorageKey',
  'kdj',
  'listActiveIndicatorLayers',
  'macd',
  'rsi',
  'sma',
] as const;

describe('@coderyo/indicators public exports', () => {
  it('package.json exposes only root entry', () => {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
        'utf8',
      ),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(pkg.exports).sort()).toEqual(['.']);
  });

  it('index runtime exports match allowlist', () => {
    expect(Object.keys(Indicators).sort()).toEqual(
      [...PUBLIC_INDICATORS_VALUE_EXPORTS].sort(),
    );
  });
});