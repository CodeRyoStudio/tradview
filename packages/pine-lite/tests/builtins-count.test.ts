import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { INDICATOR_BUILTINS } from '../src/builtins.js';
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

const NEW_BUILTINS = [
  'wma',
  'stdev',
  'change',
  'roc',
  'atr',
  'cci',
  'mfi',
  'stoch',
  'sum',
  'bb',
  'macd',
] as const;

describe('Pine-lite builtins (V2-PINE2)', () => {
  it('has exactly 18 indicator builtins', () => {
    expect(INDICATOR_BUILTINS.size).toBe(18);
  });

  it.each(NEW_BUILTINS)('VM runs plot(%s(close, 5)) after warmup', (fn) => {
    const compiled = compilePineLite(`plot(${fn}(close, 5))`);
    expect(compiled.ok).toBe(true);
    const bars = mockBars(30);
    const out = runPineLite(compiled.ir!, bars);
    expect(out.plots[0]?.values[10]).not.toBeNull();
  });
});