import type { Bar } from '@tradview/data';

export interface KdjResult {
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
}

export function kdj(bars: Bar[], period = 9, kSmooth = 3, dSmooth = 3): KdjResult {
  const rsv: (number | null)[] = [];
  const k: (number | null)[] = [];
  const d: (number | null)[] = [];
  const j: (number | null)[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      rsv.push(null);
      k.push(null);
      d.push(null);
      j.push(null);
      continue;
    }
    let hh = -Infinity;
    let ll = Infinity;
    for (let x = i - period + 1; x <= i; x++) {
      hh = Math.max(hh, bars[x]!.h);
      ll = Math.min(ll, bars[x]!.l);
    }
    const r = hh === ll ? 50 : ((bars[i]!.c - ll) / (hh - ll)) * 100;
    rsv.push(r);
    const prevK = k[i - 1] ?? 50;
    const prevD = d[i - 1] ?? 50;
    const kv = (prevK * (kSmooth - 1) + r) / kSmooth;
    const dv = (prevD * (dSmooth - 1) + kv) / dSmooth;
    k.push(kv);
    d.push(dv);
    j.push(3 * kv - 2 * dv);
  }
  return { k, d, j };
}