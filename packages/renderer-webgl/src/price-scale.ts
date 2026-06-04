import type { Bar } from '@coderyo/data';

export interface PriceRange {
  min: number;
  max: number;
}

const PRICE_PADDING_RATIO = 0.06;

/** Min/max OHLC for visible bars with vertical padding. */
export function priceRangeForBars(
  bars: readonly Bar[],
  fromIndex: number,
  toIndex: number,
): PriceRange {
  if (bars.length === 0 || toIndex < fromIndex) {
    return { min: 0, max: 1 };
  }

  const start = Math.max(0, fromIndex);
  const end = Math.min(bars.length - 1, toIndex);

  let min = Infinity;
  let max = -Infinity;
  for (let i = start; i <= end; i++) {
    const b = bars[i]!;
    min = Math.min(min, b.l);
    max = Math.max(max, b.h);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.01);
    return { min: min - pad, max: max + pad };
  }

  const span = max - min;
  const pad = span * PRICE_PADDING_RATIO;
  return { min: min - pad, max: max + pad };
}

export function maxVolumeForBars(
  bars: readonly Bar[],
  fromIndex: number,
  toIndex: number,
): number {
  if (bars.length === 0 || toIndex < fromIndex) return 1;

  const start = Math.max(0, fromIndex);
  const end = Math.min(bars.length - 1, toIndex);
  let max = 0;
  for (let i = start; i <= end; i++) {
    max = Math.max(max, bars[i]!.v ?? 0);
  }
  return max > 0 ? max : 1;
}

/** Map price to y in [top, bottom] pixel coordinates. */
export function priceToY(
  price: number,
  range: PriceRange,
  top: number,
  bottom: number,
): number {
  const span = range.max - range.min;
  if (span <= 0) return (top + bottom) / 2;
  const t = (price - range.min) / span;
  return bottom - t * (bottom - top);
}