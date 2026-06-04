import { describe, expect, it } from 'vitest';
import { lodDecimateBars } from '@coderyo/series';
import type { Bar } from '@coderyo/data';

function bars(count: number): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    t: i * 1000,
    o: i,
    h: i + 1,
    l: i - 1,
    c: i,
    v: 1,
  }));
}

describe('lodDecimateBars (V2-R8)', () => {
  it('passes through when under max points', () => {
    const input = bars(100);
    expect(lodDecimateBars(input, 4000)).toHaveLength(100);
  });

  it('downsamples when over max points', () => {
    const input = bars(10_000);
    const out = lodDecimateBars(input, 500);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out.length).toBeGreaterThan(0);
    expect(out[out.length - 1]!.c).toBe(input[input.length - 1]!.c);
  });
});