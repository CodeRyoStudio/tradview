import { intervalMs, parseInterval, type Interval } from '../interval.js';
import type { Bar } from '../types.js';

export interface BarGeneratorOptions {
  symbol: string;
  interval: Interval;
  /** Bar open time for the last bar in the series (ms UTC). */
  endTime: number;
  count: number;
  basePrice?: number;
  /** Continue random walk from this close (newest bar builds backward if unset). */
  anchorClose?: number;
}

const SYMBOL_BASE: Record<string, number> = {
  'BINANCE:BTCUSDT': 94_250,
  'BINANCE:ETHUSDT': 3_420,
  'BINANCE:SOLUSDT': 148,
};

function hashSeed(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function defaultBasePrice(symbol: string): number {
  if (SYMBOL_BASE[symbol]) return SYMBOL_BASE[symbol]!;
  const seed = hashSeed(symbol);
  return 100 + (seed % 5000) / 10;
}

/** Volatility fraction per bar (~0.15%–0.4% depending on interval). */
function volatilityFor(symbol: string, interval: Interval): number {
  const base = defaultBasePrice(symbol);
  const ms = intervalMs(interval);
  const scale = Math.min(1.2, Math.max(0.35, Math.sqrt(ms / 60_000) * 0.12));
  return base * 0.003 * scale;
}

/** Deterministic synthetic OHLCV — random-walk style, not real market data. */
export function generateBars(opts: BarGeneratorOptions): Bar[] {
  const ms = intervalMs(opts.interval);
  const seed = hashSeed(opts.symbol) ^ (Math.floor(opts.endTime / ms) >>> 0);
  const rand = mulberry32(seed);
  const vol = volatilityFor(opts.symbol, opts.interval);
  const bars: Bar[] = [];

  let close = opts.anchorClose ?? opts.basePrice ?? defaultBasePrice(opts.symbol);

  // Walk backward from newest to oldest, then reverse.
  const stack: Bar[] = [];
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

/** Seed a new realtime bar from previous close. */
export function seedNextBar(
  symbol: string,
  interval: Interval,
  openTime: number,
  prevClose: number,
): Bar {
  const rand = mulberry32(hashSeed(symbol) ^ (Math.floor(openTime / intervalMs(interval)) >>> 0));
  const vol = volatilityFor(symbol, interval);
  const o = prevClose;
  const c = o + (rand() - 0.48) * vol * 0.6;
  const wick = rand() * vol * 0.35;
  return {
    t: openTime,
    o,
    h: Math.max(o, c) + wick,
    l: Math.min(o, c) - wick,
    c,
    v: Math.round(600 + rand() * 2500),
  };
}

export function floorBarOpenTime(t: number, interval: Interval): number {
  const ms = intervalMs(interval);
  return Math.floor(t / ms) * ms;
}

export function parseHistoryQuery(url: URL): {
  symbol: string;
  interval: Interval;
  mode: 'range' | 'cursor' | 'loadMore';
  from?: number;
  to?: number;
  endTime?: number;
  limit: number;
  cursor?: string;
} {
  const symbol = url.searchParams.get('symbol');
  const intervalRaw = url.searchParams.get('interval');
  if (!symbol || !intervalRaw) {
    throw new Error('MISSING_PARAMS');
  }

  const interval = parseInterval(intervalRaw);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '500'), 1), 5000);

  if (url.searchParams.has('from') && url.searchParams.has('to')) {
    return {
      symbol,
      interval,
      mode: 'range',
      from: Number(url.searchParams.get('from')),
      to: Number(url.searchParams.get('to')),
      limit,
    };
  }

  if (url.searchParams.has('endTime')) {
    return {
      symbol,
      interval,
      mode: 'loadMore',
      endTime: Number(url.searchParams.get('endTime')),
      limit,
    };
  }

  return {
    symbol,
    interval,
    mode: 'cursor',
    limit,
    cursor: url.searchParams.get('cursor') ?? undefined,
  };
}

export function resolveHistoryBars(
  query: ReturnType<typeof parseHistoryQuery>,
  now = Date.now(),
): { bars: Bar[]; nextCursor?: string; hasMore: boolean } {
  const ms = intervalMs(query.interval);

  if (query.mode === 'range') {
    const from = query.from!;
    const to = query.to!;
    if (from >= to) {
      throw new Error('INVALID_RANGE');
    }
    const count = Math.min(Math.ceil((to - from) / ms), query.limit);
    const endTime = to - ms;
    const bars = generateBars({
      symbol: query.symbol,
      interval: query.interval,
      endTime,
      count,
    }).filter((b) => b.t >= from && b.t < to);
    return { bars, hasMore: false };
  }

  if (query.mode === 'loadMore') {
    const endTime = query.endTime!;
    const bars = generateBars({
      symbol: query.symbol,
      interval: query.interval,
      endTime,
      count: query.limit,
    });
    const oldest = bars[0]?.t ?? endTime;
    const hasMore = oldest > ms * 10;
    return { bars, hasMore };
  }

  const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0;
  const endTime = now - offset * ms - ms;
  const bars = generateBars({
    symbol: query.symbol,
    interval: query.interval,
    endTime,
    count: query.limit,
  });
  const hasMore = offset + query.limit < 10_000;
  const nextCursor = hasMore ? String(offset + query.limit) : undefined;
  return { bars, nextCursor, hasMore };
}