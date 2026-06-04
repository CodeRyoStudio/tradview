import type { Bar } from '@coderyo/data';
import { describe, expect, it } from 'vitest';
import { maxVolumeForBars, priceRangeForBars, priceToY } from './price-scale.js';

const bars: Bar[] = [
  { t: 1, o: 10, h: 12, l: 9, c: 11, v: 100 },
  { t: 2, o: 11, h: 13, l: 10, c: 10, v: 200 },
  { t: 3, o: 10, h: 11, l: 8, c: 9, v: 50 },
];

describe('price-scale', () => {
  it('computes padded OHLC range', () => {
    const r = priceRangeForBars(bars, 0, 2);
    expect(r.min).toBeLessThan(8);
    expect(r.max).toBeGreaterThan(13);
  });

  it('maxVolumeForBars finds peak', () => {
    expect(maxVolumeForBars(bars, 0, 2)).toBe(200);
  });

  it('priceToY maps min to bottom and max to top', () => {
    const r = { min: 0, max: 100 };
    expect(priceToY(0, r, 0, 100)).toBeCloseTo(100, 5);
    expect(priceToY(100, r, 0, 100)).toBeCloseTo(0, 5);
  });

  it('empty bar slice returns default range', () => {
    expect(priceRangeForBars([], 0, 5)).toEqual({ min: 0, max: 1 });
    expect(maxVolumeForBars([], 0, 5)).toBe(1);
  });

  it('flat OHLC expands symmetric padding', () => {
    const flat: Bar[] = [{ t: 1, o: 50, h: 50, l: 50, c: 50, v: 10 }];
    const r = priceRangeForBars(flat, 0, 0);
    expect(r.min).toBeLessThan(50);
    expect(r.max).toBeGreaterThan(50);
  });

  it('priceToY returns midpoint when span is zero', () => {
    expect(priceToY(50, { min: 1, max: 1 }, 10, 110)).toBeCloseTo(60, 5);
  });
});