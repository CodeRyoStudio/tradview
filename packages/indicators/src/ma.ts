import type { Bar } from '@tradview/data';

export function sma(bars: Bar[], period: number, field: 'close' | 'open' = 'close'): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += bars[i - j]![field === 'close' ? 'c' : 'o'];
    }
    out.push(sum / period);
  }
  return out;
}

export function ema(bars: Bar[], period: number, field: 'close' | 'open' = 'close'): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < bars.length; i++) {
    const v = bars[i]![field === 'close' ? 'c' : 'o'];
    if (prev === null) {
      prev = v;
      out.push(i < period - 1 ? null : v);
    } else {
      prev = v * k + prev * (1 - k);
      out.push(i < period - 1 ? null : prev);
    }
  }
  return out;
}