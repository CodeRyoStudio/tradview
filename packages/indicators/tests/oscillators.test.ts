import { describe, expect, it } from 'vitest';
import { kdj, macd, rsi } from '../src/index.js';

const bars = Array.from({ length: 40 }, (_, i) => ({
  t: i * 60_000,
  o: 100 + i,
  h: 102 + i,
  l: 98 + i,
  c: 100 + i * 0.5,
  v: 1000,
}));

describe('oscillators', () => {
  it('computes MACD', () => {
    const r = macd(bars);
    expect(r.macd.filter((x) => x != null).length).toBeGreaterThan(0);
  });

  it('computes RSI', () => {
    const r = rsi(bars);
    expect(r[39]).toBeGreaterThan(0);
  });

  it('computes KDJ', () => {
    const r = kdj(bars);
    expect(r.k[39]).not.toBeNull();
  });
});