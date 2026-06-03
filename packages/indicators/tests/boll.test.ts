import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { boll } from '../src/boll.js';

const bars: Bar[] = Array.from({ length: 25 }, (_, i) => ({
  t: i,
  o: 100,
  h: 102,
  l: 98,
  c: 100 + Math.sin(i * 0.3),
  v: 1,
}));

describe('boll', () => {
  it('returns null until period satisfied', () => {
    const r = boll(bars, 20, 2);
    expect(r.middle[18]).toBeNull();
    expect(r.middle[19]).not.toBeNull();
    expect(r.upper[19]).toBeGreaterThan(r.middle[19]!);
    expect(r.lower[19]).toBeLessThan(r.middle[19]!);
  });
});