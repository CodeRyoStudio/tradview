import { intervalMs, parseInterval, type Interval } from '../interval.js';
import type { Bar } from '../types.js';

export interface BarGeneratorOptions {
  symbol: string;
  interval: Interval;
  /** Bar open time for the last bar in the series (ms UTC). */
  endTime: number;
  count: number;
  basePrice?: number;
}

function hashSeed(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Deterministic synthetic OHLCV bars for mock gateway. */
export function generateBars(opts: BarGeneratorOptions): Bar[] {
  const ms = intervalMs(opts.interval);
  const seed = hashSeed(opts.symbol);
  const base = opts.basePrice ?? 100 + (seed % 5000) / 10;
  const bars: Bar[] = [];

  for (let i = opts.count - 1; i >= 0; i--) {
    const t = opts.endTime - i * ms;
    const phase = (seed + i) * 0.17;
    const o = base + Math.sin(phase) * 2;
    const c = base + Math.sin(phase + 0.4) * 2;
    const h = Math.max(o, c) + 0.5 + (i % 3) * 0.1;
    const l = Math.min(o, c) - 0.5 - (i % 2) * 0.1;
    const v = 1000 + ((seed + i) % 500);
    bars.push({ t, o, h, l, c, v });
  }

  return bars;
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

  // cursor mode
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