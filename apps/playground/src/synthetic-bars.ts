/**
 * Browser-only synthetic OHLCV for webgl-demo (V2-R4b).
 * Avoids `@coderyo/data/mock` barrel (http/ws server re-exports).
 */

export interface DemoBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

const MS_1H = 3_600_000;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic random-walk OHLCV (newest bar at endTime). */
export function generateDemoBars(opts: {
  endTime: number;
  count: number;
  basePrice?: number;
  intervalMs?: number;
  seed?: number;
}): DemoBar[] {
  const ms = opts.intervalMs ?? MS_1H;
  const rand = mulberry32(opts.seed ?? 0xdecaf);
  const base = opts.basePrice ?? 94_250;
  const vol = base * 0.003;

  let close = base;
  const stack: DemoBar[] = [];

  for (let i = 0; i < opts.count; i++) {
    const t = opts.endTime - i * ms;
    const change = (rand() - 0.48) * vol;
    const c = close;
    const o = c - change;
    const wick = rand() * vol * 0.45;
    const h = Math.max(o, c) + wick;
    const l = Math.min(o, c) - wick;
    const v = Math.round(800 + rand() * 4000);
    stack.push({ t, o, h, l, c, v });
    close = o;
  }

  stack.reverse();
  return stack;
}