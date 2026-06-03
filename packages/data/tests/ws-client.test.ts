import { describe, expect, it, vi, afterEach } from 'vitest';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { TradViewWsClient } from '../src/client/ws-client.js';
import { DataError } from '../src/errors.js';

describe('TradViewWsClient', () => {
  let server: http.Server | undefined;
  let wss: WebSocketServer | undefined;
  let port = 0;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      wss?.close(() => {
        server?.close(() => resolve());
      });
    });
    server = undefined;
    wss = undefined;
    vi.useRealTimers();
  });

  it('times out subscribe when server does not ack', async () => {
    vi.useFakeTimers();

    server = http.createServer();
    wss = new WebSocketServer({ server });
    wss.on('connection', (ws) => {
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { type: string };
        if (msg.type === 'subscribe') {
          // intentionally no subscribe.ok
        }
      });
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        port = (server!.address() as { port: number }).port;
        resolve();
      });
    });

    const client = new TradViewWsClient({
      wsUrl: `ws://127.0.0.1:${port}`,
      subscribeAckTimeoutMs: 1000,
      subscribeMaxRetries: 0,
    });

    await client.connect();

    const subscribePromise = client.subscribe(
      { symbol: 'X', interval: '1m' },
      { onError: () => {} },
    );

    const expectation = expect(subscribePromise).rejects.toBeInstanceOf(DataError);
    await vi.advanceTimersByTimeAsync(1500);
    await expectation;

    const err = await subscribePromise.catch((e) => e);
    expect((err as DataError).code).toBe('SUBSCRIBE_TIMEOUT');

    await client.disconnect();
  });
});