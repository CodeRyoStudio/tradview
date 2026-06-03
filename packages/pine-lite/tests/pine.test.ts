import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { compilePineLite, runPineLite } from '../src/index.js';

function mockBars(n: number): Bar[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i * 60_000,
    o: 100 + i,
    h: 101 + i,
    l: 99 + i,
    c: 100 + i * 0.5,
    v: 1000 + i,
  }));
}

describe('compilePineLite', () => {
  it('compiles plot(sma(close, 20))', () => {
    const r = compilePineLite('plot(sma(close, 20))');
    expect(r.ok).toBe(true);
    expect(r.ir?.plots).toEqual(['plot_0']);
  });

  it('rejects unknown identifier', () => {
    const r = compilePineLite('plot(foo)');
    expect(r.ok).toBe(false);
  });
});

describe('runPineLite', () => {
  it('produces SMA values after warmup', () => {
    const compiled = compilePineLite('plot(sma(close, 3))');
    expect(compiled.ok).toBe(true);
    const bars = mockBars(10);
    const out = runPineLite(compiled.ir!, bars);
    expect(out.plots[0]?.values[2]).not.toBeNull();
    expect(out.plots[0]?.values[0]).toBeNull();
  });
});