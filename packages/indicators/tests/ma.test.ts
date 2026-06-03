import { describe, expect, it } from 'vitest';
import { sma } from '../src/ma.js';

describe('sma', () => {
  it('computes simple moving average', () => {
    const bars = [1, 2, 3, 4, 5].map((c, i) => ({
      t: i * 1000,
      o: c,
      h: c,
      l: c,
      c,
      v: 1,
    }));
    expect(sma(bars, 3)).toEqual([null, null, 2, 3, 4]);
  });
});