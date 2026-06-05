import type { Bar } from '@coderyo/data';
import type { ChartViewport } from './chart-viewport.js';
import {
  priceRangeForBars,
  priceToY as mapPriceToY,
  yToPrice as mapYToPrice,
  type PriceRange,
  type PriceScaleMode,
} from './price-scale.js';

/** Device-pixel layout for mapping price/time to the main chart pane. */
export interface MainPaneLayout {
  canvasWidth: number;
  canvasHeight: number;
  mainPaneHeight: number;
  /** CSS width used by {@link ChartViewport} plot math. */
  cssWidth: number;
}

export interface ChartCoordinateMapperOptions {
  priceRange?: PriceRange;
  priceScaleMode?: PriceScaleMode;
}

export interface ChartCoordinateMapper {
  timeToX: (tMs: number) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => number | null;
  yToPrice: (y: number) => number | null;
}

/** Fractional bar index for a timestamp (bars sorted by `t` ms). */
export function barIndexForTimeMs(bars: readonly Bar[], tMs: number): number {
  if (bars.length === 0) return 0;
  if (tMs <= bars[0]!.t) return 0;
  const last = bars[bars.length - 1]!;
  if (tMs >= last.t) return bars.length - 1;

  let lo = 0;
  let hi = bars.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.t <= tMs) lo = mid;
    else hi = mid;
  }
  const t0 = bars[lo]!.t;
  const t1 = bars[hi]!.t;
  if (t1 === t0) return lo;
  return lo + (tMs - t0) / (t1 - t0);
}

/** Interpolate bar time at a fractional logical index. */
export function timeMsAtBarIndex(bars: readonly Bar[], index: number): number {
  if (bars.length === 0) return 0;
  if (index <= 0) return bars[0]!.t;
  if (index >= bars.length - 1) return bars[bars.length - 1]!.t;
  const i = Math.floor(index);
  const f = index - i;
  return bars[i]!.t + f * (bars[i + 1]!.t - bars[i]!.t);
}

/**
 * Map bar time/price ↔ overlay canvas pixels (device pixels, main pane only).
 */
export function createChartCoordinateMapper(
  viewport: ChartViewport,
  bars: readonly Bar[],
  layout: MainPaneLayout,
  mapperOpts: ChartCoordinateMapperOptions = {},
): ChartCoordinateMapper {
  const dpr = layout.canvasWidth / Math.max(1, layout.cssWidth);
  const plotW = viewport.plotWidthPx(layout.cssWidth);
  const { from, to } = viewport.visibleBarIndexRange();
  const mode = mapperOpts.priceScaleMode ?? 'linear';
  const priceRange =
    mapperOpts.priceRange ?? priceRangeForBars(bars, from, to, mode);
  const mainTop = 0;
  const mainBottom = layout.mainPaneHeight;

  return {
    timeToX(tMs: number) {
      if (bars.length === 0 || plotW <= 0) return null;
      const idx = barIndexForTimeMs(bars, tMs);
      return viewport.barCenterDeviceX(idx, layout.cssWidth, dpr, 0);
    },
    priceToY(price: number) {
      if (layout.mainPaneHeight <= 0) return null;
      return mapPriceToY(price, priceRange, mainTop, mainBottom, mode);
    },
    xToTime(x: number) {
      if (bars.length === 0 || plotW <= 0) return null;
      const plotX = x / dpr - viewport.plotOffsetPx();
      const idx = viewport.barIndexAtPlotX(plotX, plotW);
      return timeMsAtBarIndex(bars, idx);
    },
    yToPrice(y: number) {
      return mapYToPrice(y, priceRange, mainTop, mainBottom, mode);
    },
  };
}