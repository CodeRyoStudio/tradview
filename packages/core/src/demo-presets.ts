import type { IndicatorConfig } from '@coderyo/indicators';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { PINE_SAMPLE_SCRIPT } from '@coderyo/pine-lite';
import type { Interval } from '@coderyo/data';
import type { ChartFeatures } from './chart-features.js';
import type { ChartOptions } from './chart-controller.js';

/** Playground / docs: opt-in full TV-like chart features. */
export function createDemoChartFeatures(opts: {
  indicatorConfig?: IndicatorConfig;
  returnToCursorAfterDraw?: boolean;
}): ChartFeatures {
  return {
    fetchPolicy: 'lazy-left-only',
    streamMode: 'bar+tick',
    gaps: { whitespace: false, fillVisibleHoles: false },
    drawings: { layer: true, persist: true },
    indicators: opts.indicatorConfig ?? DEFAULT_INDICATOR_CONFIG,
    indicatorPersist: true,
    smoothPriceUpdate: true,
    smoothPriceDurationMs: 150,
    tickStream: true,
    pineEnabled: true,
    pineScript: PINE_SAMPLE_SCRIPT,
  };
}

export function createDemoChartOptions(
  base: Pick<ChartOptions, 'dataProvider' | 'indicatorHost' | 'symbolResolver' | 'chartId'> & {
    symbol: string;
    interval: Interval;
    theme?: 'dark' | 'light';
    showGrid?: boolean;
    indicatorConfig?: IndicatorConfig;
    returnToCursorAfterDraw?: boolean;
  },
): ChartOptions {
  const indicatorConfig = base.indicatorConfig ?? DEFAULT_INDICATOR_CONFIG;
  return {
    ...base,
    features: createDemoChartFeatures({
      indicatorConfig,
      returnToCursorAfterDraw: base.returnToCursorAfterDraw,
    }),
    indicatorConfig,
    drawingDefaults: { returnToCursorAfterDraw: base.returnToCursorAfterDraw ?? false },
  };
}