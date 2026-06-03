import type { Bar } from '@tradview/data';
import { ema } from './ma.js';

export interface MacdResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function macd(
  bars: Bar[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdResult {
  const fastEma = ema(bars, fast);
  const slowEma = ema(bars, slow);
  const line: (number | null)[] = bars.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f == null || s == null) return null;
    return f - s;
  });
  const pseudoBars = bars.map((b, i) => ({
    ...b,
    c: line[i] ?? b.c,
  }));
  const signal = ema(pseudoBars, signalPeriod);
  const histogram = line.map((m, i) =>
    m == null || signal[i] == null ? null : m - signal[i]!,
  );
  return { macd: line, signal, histogram };
}