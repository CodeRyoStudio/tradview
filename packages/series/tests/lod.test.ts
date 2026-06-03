import { describe, expect, it } from 'vitest';
import { lodDecimateBars } from '../src/lod.js';

describe('lodDecimateBars', () => {
  it('returns same array when under limit', () => {
    const bars = [{ t: 1, o: 1, h: 2, l: 0.5, c: 1.5, v: 1 }];
    expect(lodDecimateBars(bars, 10)).toHaveLength(1);
  });

  it('downsamples when over limit', () => {
    const bars = Array.from({ length: 100 }, (_, i) => ({
      t: i * 1000,
      o: i,
      h: i + 1,
      l: i - 1,
      c: i,
      v: 1,
    }));
    const out = lodDecimateBars(bars, 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });
});