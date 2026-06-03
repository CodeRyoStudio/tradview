import { describe, expect, it, afterEach } from 'vitest';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { TradViewWsClient } from '../src/client/ws-client.js';
import type { Bar } from '../src/types.js';

describe('TradViewWsClient reconnect + auth refresh (PR-03)', () => {
  let server: http.Server | undefined;
  let wss: WebSocketServer | undefined;
  let port = 0;

  afterEach(async () => {
    for (const client of wss?.clients ?? []) client.terminate();
    await Promise.race([
      new Promise<void>((resolve) => {
        wss?.close(() => {
          server?.close(() => resolve());
        });
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
    server = undefined;
    wss = undefined;
  });

  it('reconnects and receives bar after server drop', async () => {
    server = http.createServer();
    wss = new WebSocketServer({ server });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    port = (server!.address() as { port: number }).port;

    let connections = 0;
    wss.on('connection', (ws) => {
      connections += 1;
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string; id?: string };
        if (msg.type === 'subscribe' && msg.id) {
          ws.send(
            JSON.stringify({
              v: '1.0',
              type: 'subscribe.ok',
              id: msg.id,
              ts: Date.now(),
              payload: { subscriptionId: 'sub-1', symbol: 'X', interval: '1m' },
            }),
          );
          if (connections >= 2) {
            ws.send(
              JSON.stringify({
                v: '1.0',
                type: 'bar',
                ts: Date.now(),
                payload: {
                  subscriptionId: 'sub-1',
                  bar: { t: Date.now(), o: 1, h: 2, l: 0.5, c: 1.5, v: 10, barSeq: '1' } satisfies Bar,
                },
              }),
            );
          } else {
            setTimeout(() => ws.close(), 30);
          }
        }
      });
    });

    const client = new TradViewWsClient({
      wsUrl: `ws://127.0.0.1:${port}`,
      reconnect: { initialDelayMs: 80, maxDelayMs: 200, maxAttempts: 5 },
      subscribeAckTimeoutMs: 3000,
    });

    await client.connect();
    const bars: Bar[] = [];
    await client.subscribe({ symbol: 'X', interval: '1m' }, { onBar: (b) => bars.push(b) });

    await new Promise((r) => setTimeout(r, 900));
    expect(connections).toBeGreaterThanOrEqual(2);
    expect(bars.length).toBeGreaterThan(0);
    await client.disconnect();
  }, 15_000);

  it('calls refreshToken when server pushes AUTH_FAILED', async () => {
    server = http.createServer();
    wss = new WebSocketServer({ server });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    port = (server!.address() as { port: number }).port;

    let refreshCalls = 0;
    let pushedAuthError = false;
    wss.on('connection', (ws) => {
      if (pushedAuthError) return;
      pushedAuthError = true;
      setTimeout(() => {
        ws.send(
          JSON.stringify({
            v: '1.0',
            type: 'error',
            ts: Date.now(),
            payload: { code: 'AUTH_FAILED', message: 'expired' },
          }),
        );
      }, 40);
    });

    const client = new TradViewWsClient({
      wsUrl: `ws://127.0.0.1:${port}`,
      auth: {
        refreshToken: async () => {
          refreshCalls += 1;
        },
      },
      reconnect: { initialDelayMs: 50, maxDelayMs: 100, maxAttempts: 3 },
    });

    try {
      await client.connect();
      await new Promise((r) => setTimeout(r, 350));
      expect(refreshCalls).toBe(1);
    } finally {
      await client.disconnect();
    }
  }, 15_000);
});