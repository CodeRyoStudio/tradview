import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresWsDataProvider,
  parseBarsJson,
} from '../src/postgres-ws-provider.js';

describe('parseBarsJson', () => {
  it('parses array body and sorts by time', () => {
    const bars = parseBarsJson(
      [
        { t: 3000, o: 1, h: 2, l: 0.5, c: 1.5 },
        { time: 1000, open: 10, high: 11, low: 9, close: 10.5, volume: 5 },
      ],
      10_000,
    );
    expect(bars.map((b) => b.t)).toEqual([1000, 3000]);
    expect(bars[0]?.v).toBe(5);
  });

  it('parses { bars: [...] } envelope', () => {
    const bars = parseBarsJson({ bars: [{ t: 2, c: 3 }] }, 100);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.c).toBe(3);
  });

  it('stops at maxRows', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ t: i, c: i }));
    const bars = parseBarsJson(rows, 5);
    expect(bars).toHaveLength(5);
  });

  it('skips rows without finite time or close', () => {
    const bars = parseBarsJson([{ t: 'x', c: 1 }, { t: 1 }, { t: 2, c: 2 }], 100);
    expect(bars).toEqual([{ t: 2, o: 2, h: 2, l: 2, c: 2, v: undefined }]);
  });
});

describe('createPostgresWsDataProvider', () => {
  it('exposes history + realtime capabilities', async () => {
    const provider = createPostgresWsDataProvider({
      restBaseUrl: 'https://example.com/api',
      wsUrl: 'wss://example.com/ws',
    });
    const caps = await provider.getCapabilities();
    expect(caps.historyModes).toContain('range');
    expect(caps.realtimeModes).toContain('bar');
  });

  it('getHistory passes AbortSignal to fetch', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = createPostgresWsDataProvider({
      restBaseUrl: 'https://example.com/api',
      wsUrl: 'wss://example.com/ws',
      fetchTimeoutMs: 30,
    });
    const promise = provider.getHistory({
      symbol: 'X',
      interval: '1m',
      mode: 'initial',
      limit: 100,
    });
    await expect(promise).rejects.toThrow();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    vi.unstubAllGlobals();
  });

  it('unsubscribe closes socket and removes subscription', async () => {
    const close = vi.fn();
    let ws: {
      onopen: (() => void) | null;
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    } | null = null;
    class MockWebSocket {
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      send = vi.fn();
      close = close;
      constructor() {
        ws = this;
      }
    }
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

    const provider = createPostgresWsDataProvider({
      restBaseUrl: 'https://example.com/api',
      wsUrl: 'wss://example.com/ws',
    });
    const sub = await provider.subscribe(
      { symbol: 'BTC', interval: '1m' },
      { onConnectionChange: vi.fn() },
    );
    ws?.onopen?.();
    await provider.unsubscribe(sub.id);
    expect(close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});