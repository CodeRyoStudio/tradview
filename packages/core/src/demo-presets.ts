import type { IndicatorConfig } from '@tradview/indicators';
import { DEFAULT_INDICATOR_CONFIG } from '@tradview/indicators';
import type { Interval } from '@tradview/data';
import type { ChartFeatures } from './chart-features.js';
import type { ChartOptions } from './chart-controller.js';

/** Playground / docs: opt-in full TV-like chart features. */
export function createDemoChartFeatures(opts: {
  indicatorConfig?: IndicatorConfig;
  returnToCursorAfterDraw?: boolean;
}): ChartFeatures {
  return {
    fetchPolicy: 'lazy-left-only',
    streamMode: 'bar',
    gaps: { whitespace: false, fillVisibleHoles: false },
    drawings: { layer: true, persist: true },
    indicators: opts.indicatorConfig ?? DEFAULT_INDICATOR_CONFIG,
    indicatorPersist: true,
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