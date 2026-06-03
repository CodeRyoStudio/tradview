import type { Bar } from '@coderyo/data';
import { sma } from './ma.js';

export interface BollResult {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

/** Bollinger Bands on close. */
export function boll(bars: Bar[], period = 20, mult = 2): BollResult {
  const middle = sma(bars, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    const m = middle[i];
    if (m == null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      const c = bars[i - j]!.c;
      const d = c - m;
      sumSq += d * d;
    }
    const std = Math.sqrt(sumSq / period);
    upper.push(m + mult * std);
    lower.push(m - mult * std);
  }
  return { upper, middle, lower };
}