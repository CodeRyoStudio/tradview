import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INDICATOR_CONFIG,
  disableIndicatorLayer,
  listActiveIndicatorLayers,
} from '@coderyo/indicators';
import { ChartController } from '../src/chart-controller.js';

describe('IChart indicator layer API', () => {
  it('ChartController exposes listIndicatorLayers and disableIndicatorLayer', () => {
    expect(typeof ChartController.prototype.listIndicatorLayers).toBe('function');
    expect(typeof ChartController.prototype.disableIndicatorLayer).toBe('function');
  });

  it('layer helpers match @coderyo/indicators contract', () => {
    const layers = listActiveIndicatorLayers(DEFAULT_INDICATOR_CONFIG);
    expect(layers.some((l) => l.id === 'rsi')).toBe(true);
    const next = disableIndicatorLayer(DEFAULT_INDICATOR_CONFIG, 'rsi');
    expect(next.showRsi).toBe(false);
    expect(listActiveIndicatorLayers(next).some((l) => l.id === 'rsi')).toBe(false);
  });

  it('create-chart IChart wrap delegates to controller', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/create-chart.ts'),
      'utf8',
    );
    expect(src).toContain('listIndicatorLayers: () => controller.listIndicatorLayers()');
    expect(src).toContain('disableIndicatorLayer: (id) => controller.disableIndicatorLayer(id)');
  });

  it('listIndicatorLayers guards null indicators in source', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/chart-controller.ts'),
      'utf8',
    );
    expect(src).toContain('if (this.features.indicators === null) return []');
    expect(src).toContain('if (this.features.indicators === null)');
  });
});