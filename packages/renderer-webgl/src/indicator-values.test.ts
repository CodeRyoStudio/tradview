import type { Bar } from '@coderyo/data';
import { describe, expect, it } from 'vitest';
import { macd } from '@coderyo/indicators';

function syntheticBars(count: number): Bar[] {
  const bars: Bar[] = [];
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < count; i++) {
    const c = 100 + Math.sin(i / 8) * 5;
    bars.push({
      t: t0 + i * 3_600_000,
      o: c - 0.5,
      h: c + 1,
      l: c - 1,
      c,
      v: 1000 + i,
    });
  }
  return bars;
}

describe('indicator values (V2-R5)', () => {
  it('macd output arrays match bar count', () => {
    const bars = syntheticBars(120);
    const result = macd(bars, 12, 26, 9);
    expect(result.macd.length).toBe(bars.length);
    expect(result.signal.length).toBe(bars.length);
    expect(result.histogram.length).toBe(bars.length);
  });
});