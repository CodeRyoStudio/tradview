import type { PriceRange, PriceScaleMode } from '../price-scale.js';
import { yToPrice } from '../price-scale.js';
import type { SymbolPriceFormat } from './scale-types.js';
import { decimalsFromMinMove, MIN_TICK_SPACING_PX } from './scale-types.js';

export interface PriceTick {
  price: number;
  /** Device-pixel Y in pane band [top, bottom]. */
  y: number;
  label: string;
}

export interface PriceTickParams {
  range: PriceRange;
  top: number;
  bottom: number;
  mode?: PriceScaleMode;
  format?: SymbolPriceFormat;
  minSpacingPx?: number;
}

/** Nice-number tick step (TradingView-style). */
export function niceTickStep(span: number, targetTicks: number): number {
  if (!Number.isFinite(span) || span <= 0 || targetTicks <= 0) return 1;
  const rough = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}

/** Format price for axis labels using symbol minMove / precision. */
export function formatPriceLabel(
  price: number,
  format: SymbolPriceFormat = {},
  mode: PriceScaleMode = 'linear',
): string {
  if (!Number.isFinite(price)) return '—';
  const displayPrice = mode === 'log' ? price : price;
  const minMove = format.minMove;
  const precision =
    format.precision ??
    (minMove != null && minMove > 0 ? decimalsFromMinMove(minMove) : undefined);

  if (minMove != null && minMove > 0 && precision != null) {
    const rounded = Math.round(displayPrice / minMove) * minMove;
    return rounded.toFixed(precision);
  }

  const abs = Math.abs(displayPrice);
  if (abs >= 1e9) return `${(displayPrice / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(displayPrice / 1e6).toFixed(2)}M`;
  if (abs >= 10_000) return displayPrice.toFixed(0);
  if (precision != null) return displayPrice.toFixed(precision);
  if (abs >= 100) return displayPrice.toFixed(1);
  if (abs >= 1) return displayPrice.toFixed(2);
  if (abs >= 0.01) return displayPrice.toFixed(4);
  return displayPrice.toPrecision(3);
}

/** Format volume axis values (independent scale). */
export function formatVolumeLabel(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 1) return value.toFixed(1);
  return value.toPrecision(2);
}

export function computePriceTicks(params: PriceTickParams): PriceTick[] {
  const {
    range,
    top,
    bottom,
    mode = 'linear',
    format = {},
    minSpacingPx = MIN_TICK_SPACING_PX,
  } = params;
  const height = bottom - top;
  if (height <= 0) return [];

  const span = range.max - range.min;
  if (!Number.isFinite(span) || span <= 0) {
    const mid = yToPrice((top + bottom) / 2, range, top, bottom, mode);
    return [{ price: mid, y: (top + bottom) / 2, label: formatPriceLabel(mid, format, mode) }];
  }

  const targetTicks = Math.max(2, Math.floor(height / minSpacingPx));
  const step = niceTickStep(span, targetTicks);
  const start = Math.ceil(range.min / step) * step;
  const ticks: PriceTick[] = [];

  for (let v = start; v <= range.max + step * 0.001; v += step) {
    const t = (v - range.min) / span;
    const y = bottom - t * height;
    if (y < top - 1 || y > bottom + 1) continue;
    const price = mode === 'log' ? Math.exp(v) : v;
    ticks.push({
      price,
      y,
      label: formatPriceLabel(price, format, mode),
    });
  }

  if (ticks.length === 0) {
    const midPrice = yToPrice((top + bottom) / 2, range, top, bottom, mode);
    ticks.push({
      price: midPrice,
      y: (top + bottom) / 2,
      label: formatPriceLabel(midPrice, format, mode),
    });
  }
  return ticks;
}

/**
 * Scale range around center by factor (>1 zooms out).
 * When mode is log, range min/max are already in log space — scaling stays in that domain.
 */
export function scalePriceRange(
  range: PriceRange,
  factor: number,
  anchorFraction = 0.5,
  _mode: PriceScaleMode = 'linear',
): PriceRange {
  const span = range.max - range.min;
  if (span <= 0 || !Number.isFinite(factor) || factor <= 0) return range;
  const anchor = range.min + span * anchorFraction;
  const half = (span * factor) / 2;
  return { min: anchor - half, max: anchor + half };
}

/** Shift visible price range by delta (linear or log domain values). */
export function translatePriceRange(range: PriceRange, delta: number): PriceRange {
  if (!Number.isFinite(delta) || delta === 0) return range;
  return { min: range.min + delta, max: range.max + delta };
}