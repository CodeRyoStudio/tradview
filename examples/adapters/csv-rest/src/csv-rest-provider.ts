import type { Bar, DataProvider, HistoryQuery, SubscribeParams } from '@coderyo/data';
import type { RealtimeHandlers } from '@coderyo/data/client';
import { DEFAULT_DATA_PROVIDER_CAPABILITIES } from '@coderyo/data';

export interface CsvRestProviderOptions {
  /** Base URL for CSV history endpoint, e.g. `https://host/api/csv`. */
  restBaseUrl: string;
  /** Path template: `{symbol}` and `{interval}` replaced; default `/history/{symbol}/{interval}.csv`. */
  historyPath?: string;
}

function parseCsv(text: string): Bar[] {
  const lines = text.trim().split(/\r?\n/);
  const bars: Bar[] = [];
  for (const line of lines) {
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

/**
 * Reference self-hosted adapter: fetches OHLCV history from a CSV REST endpoint (V2-C).
 * Realtime is a no-op stub — integrators attach their own WS or poll loop.
 */
export function createCsvRestDataProvider(opts: CsvRestProviderOptions): DataProvider {
  const path = opts.historyPath ?? '/history/{symbol}/{interval}.csv';

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
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`csv-rest: ${res.status} ${res.statusText}`);
      }
      let bars = parseCsv(await res.text());
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