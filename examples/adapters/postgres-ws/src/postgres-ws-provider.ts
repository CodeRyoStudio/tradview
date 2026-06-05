import type { Bar, DataProvider, HistoryQuery, SubscribeParams } from '@coderyo/data';
import type { RealtimeHandlers } from '@coderyo/data/client';
import { DEFAULT_DATA_PROVIDER_CAPABILITIES } from '@coderyo/data';

export interface PostgresWsProviderOptions {
  /** REST base, e.g. `https://host/api` — history at `/bars`. */
  restBaseUrl: string;
  /** WebSocket URL for live bars, e.g. `wss://host/ws`. */
  wsUrl: string;
  fetchTimeoutMs?: number;
  maxRows?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ROWS = 50_000;

/** @internal Exported for adapter tests; not part of the public provider contract. */
export function parseBarsJson(body: unknown, maxRows: number): Bar[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === 'object' && Array.isArray((body as { bars?: unknown }).bars)
      ? (body as { bars: unknown[] }).bars
      : [];
  const bars: Bar[] = [];
  for (const row of rows) {
    if (bars.length >= maxRows) break;
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const t = Number(r.t ?? r.time);
    const o = Number(r.o ?? r.open);
    const h = Number(r.h ?? r.high);
    const l = Number(r.l ?? r.low);
    const c = Number(r.c ?? r.close);
    const v = r.v != null ? Number(r.v) : r.volume != null ? Number(r.volume) : undefined;
    if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    bars.push({
      t,
      o: Number.isFinite(o) ? o : c,
      h: Number.isFinite(h) ? h : c,
      l: Number.isFinite(l) ? l : c,
      c,
      v: Number.isFinite(v!) ? v : undefined,
    });
  }
  return bars.sort((a, b) => a.t - b.t);
}

function historyUrl(base: string, query: HistoryQuery): string {
  const u = new URL('/bars', base.replace(/\/$/, '') + '/');
  u.searchParams.set('symbol', query.symbol);
  u.searchParams.set('interval', query.interval);
  if (query.mode === 'range') {
    u.searchParams.set('from', String(query.from));
    u.searchParams.set('to', String(query.to));
  } else if (query.mode === 'loadMore') {
    u.searchParams.set('endTime', String(query.endTime));
    u.searchParams.set('limit', String(query.limit));
  } else {
    u.searchParams.set('limit', String(query.limit));
  }
  return u.toString();
}

/**
 * Reference adapter for a Postgres-backed gateway (REST history + WS ticks).
 * Server contract is documented in `README.md`.
 */
export function createPostgresWsDataProvider(opts: PostgresWsProviderOptions): DataProvider {
  const timeoutMs = opts.fetchTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRows = opts.maxRows ?? DEFAULT_MAX_ROWS;
  const sockets = new Map<string, WebSocket>();

  return {
    async getCapabilities() {
      return {
        ...DEFAULT_DATA_PROVIDER_CAPABILITIES,
        historyModes: ['range', 'loadMore'],
        realtimeModes: ['bar'],
      };
    },

    async getHistory(query: HistoryQuery) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch(historyUrl(opts.restBaseUrl, query), { signal: ac.signal });
        if (!res.ok) throw new Error(`postgres-ws: ${res.status} ${res.statusText}`);
        const json: unknown = await res.json();
        const bars = parseBarsJson(json, maxRows);
        return { bars, hasMore: false };
      } finally {
        clearTimeout(timer);
      }
    },

    async subscribe(params: SubscribeParams, handlers: RealtimeHandlers) {
      const id = `pg-ws-${Date.now()}`;
      const ws = new WebSocket(opts.wsUrl);
      sockets.set(id, ws);

      ws.onopen = () => {
        handlers.onConnectionChange?.('connected');
        ws.send(
          JSON.stringify({
            op: 'subscribe',
            symbol: params.symbol,
            interval: params.interval,
            channels: params.channels ?? ['bar'],
          }),
        );
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; bar?: Bar };
          if (msg.type === 'bar' && msg.bar) {
            handlers.onBar?.(msg.bar, { partial: false, subscriptionId: id });
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onerror = () => handlers.onConnectionChange?.('failed');
      ws.onclose = () => handlers.onConnectionChange?.('disconnected');

      return {
        id,
        clientRef: id,
        symbol: params.symbol,
        interval: params.interval,
        channels: params.channels ?? ['bar'],
        streamMode: params.streamMode ?? 'bar',
      };
    },

    async unsubscribe(subscriptionId: string) {
      const ws = sockets.get(subscriptionId);
      if (ws) {
        ws.close();
        sockets.delete(subscriptionId);
      }
    },
  };
}