import type { Bar, DataProvider, HistoryQuery, SubscribeParams } from '@coderyo/data';
import type { RealtimeHandlers } from '@coderyo/data/client';
import { DEFAULT_DATA_PROVIDER_CAPABILITIES } from '@coderyo/data';

export interface CsvRestProviderOptions {
  /** Base URL for CSV history endpoint, e.g. `https://host/api/csv`. */
  restBaseUrl: string;
  /** Path template: `{symbol}` and `{interval}` replaced; default `/history/{symbol}/{interval}.csv`. */
  historyPath?: string;
  /** Max response body bytes (default 2 MiB). */
  maxBytes?: number;
  /** Max parsed rows (default 50_000). */
  maxRows?: number;
  /** Fetch timeout ms (default 15_000). */
  fetchTimeoutMs?: number;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_ROWS = 50_000;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function parseCsv(text: string, maxRows: number): Bar[] {
  const lines = text.trim().split(/\r?\n/);
  const bars: Bar[] = [];
  for (const line of lines) {
    if (bars.length >= maxRows) break;
    if (!line || line.startsWith('#')) continue;
    const [t, o, h, l, c, v] = line.split(',').map((s) => s.trim());
    if (!t || !o) continue;
    if (t.toLowerCase() === 'time' || t.toLowerCase() === 't') continue;
    bars.push({
      t: Number(t),
      o: Number(o),
      h: Number(h),
      l: Number(l),
      c: Number(c),
      v: v != null && v !== '' ? Number(v) : undefined,
    });
  }
  return bars.filter((b) => Number.isFinite(b.t) && Number.isFinite(b.c));
}

function historyUrl(base: string, path: string, symbol: string, interval: string): string {
  const p = path
    .replace('{symbol}', encodeURIComponent(symbol))
    .replace('{interval}', encodeURIComponent(interval));
  return `${base.replace(/\/$/, '')}${p.startsWith('/') ? p : `/${p}`}`;
}

async function fetchTextWithLimits(
  url: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) {
      throw new Error(`csv-rest: ${res.status} ${res.statusText}`);
    }
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      if (text.length > maxBytes) {
        throw new Error(`csv-rest: response exceeds ${maxBytes} bytes`);
      }
      return text;
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`csv-rest: response exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    return new TextDecoder().decode(merged);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reference self-hosted adapter: fetches OHLCV history from a CSV REST endpoint (V2-C).
 * Realtime is a no-op stub — integrators attach their own WS or poll loop.
 */
export function createCsvRestDataProvider(opts: CsvRestProviderOptions): DataProvider {
  const path = opts.historyPath ?? '/history/{symbol}/{interval}.csv';
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const fetchTimeoutMs = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;

  return {
    async getCapabilities() {
      return {
        ...DEFAULT_DATA_PROVIDER_CAPABILITIES,
        historyModes: ['range', 'loadMore'],
        realtimeModes: [],
      };
    },

    async getHistory(query: HistoryQuery) {
      const url = historyUrl(opts.restBaseUrl, path, query.symbol, query.interval);
      const text = await fetchTextWithLimits(url, maxBytes, fetchTimeoutMs);
      let bars = parseCsv(text, maxRows);
      if (query.mode === 'range') {
        bars = bars.filter((b) => b.t >= query.from && b.t <= query.to);
      } else if (query.mode === 'loadMore') {
        bars = bars.filter((b) => b.t <= query.endTime).slice(-query.limit);
      } else {
        bars = bars.slice(-query.limit);
      }
      bars.sort((a, b) => a.t - b.t);
      return { bars, hasMore: false };
    },

    async subscribe(params: SubscribeParams, handlers: RealtimeHandlers) {
      handlers.onConnectionChange?.('disconnected');
      const id = `csv-rest-${Date.now()}`;
      return {
        id,
        clientRef: id,
        symbol: params.symbol,
        interval: params.interval,
        channels: params.channels ?? ['bar'],
        streamMode: params.streamMode ?? 'bar',
      };
    },

    async unsubscribe() {
      /* no-op */
    },
  };
}