import { describe, expect, it } from 'vitest';
import {
  TRADVIEW_API_VERSION,
  TRADVIEW_VERSION,
  DEFAULT_CHART_FEATURES,
  resolveChartFeatures,
  createChart,
} from '../src/index.js';

describe('RC API freeze (apiVersion 1)', () => {
  it('exports stable version constants', () => {
    expect(TRADVIEW_API_VERSION).toBe(1);
    expect(TRADVIEW_VERSION).toMatch(/^\d+\.\d+\.\d+(-rc\.\d+)?$/);
  });

  it('createChart factory exists', () => {
    expect(typeof createChart).toBe('function');
  });

  it('minimal chart feature defaults', () => {
    expect(resolveChartFeatures()).toEqual(DEFAULT_CHART_FEATURES);
    expect(DEFAULT_CHART_FEATURES.indicators).toBeNull();
    expect(DEFAULT_CHART_FEATURES.drawings.layer).toBe(false);
    expect(DEFAULT_CHART_FEATURES.gaps.whitespace).toBe(false);
    expect(DEFAULT_CHART_FEATURES.smoothPriceUpdate).toBe(false);
    expect(DEFAULT_CHART_FEATURES.smoothPriceDurationMs).toBe(150);
    expect(DEFAULT_CHART_FEATURES.pineWorker).toBe(true);
  });
});