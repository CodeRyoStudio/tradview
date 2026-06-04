import { describe, expect, it, afterEach } from 'vitest';
import http from 'node:http';
import { attachMockWebSocket } from '../src/mock/ws-server.js';
import { TradViewWsClient } from '../src/client/ws-client.js';
import { WS_SUBPROTOCOL_PROTOBUF } from '../src/protocol/ws-protobuf-codec.js';

describe('TradViewWsClient protobuf (PR-02b-2)', () => {
  let server: http.Server | undefined;
  let port = 0;

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((err) => (err ? reject(err) : resolve()));
    });
    server = undefined;
  }, 15_000);

  it('subscribes over tradview-protobuf subprotocol', async () => {
    server = http.createServer();
    attachMockWebSocket(server);

    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        port = (server!.address() as { port: number }).port;
        resolve();
      });
    });

    const client = new TradViewWsClient({
      wsUrl: `ws://127.0.0.1:${port}`,
      encoding: 'protobuf',
      subscribeAckTimeoutMs: 5000,
    });

    await client.connect();
    expect(client.wsEncoding).toBe('protobuf');

    const bars: unknown[] = [];
    const sub = await client.subscribe(
      { symbol: 'BINANCE:BTCUSDT', interval: '1m' },
      {
        onBar: (bar) => bars.push(bar),
      },
    );

    expect(sub.id).toMatch(/^sub-/);
    await new Promise((r) => setTimeout(r, 1200));
    expect(bars.length).toBeGreaterThan(0);

    await client.disconnect();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('negotiates tradview-protobuf on the socket', async () => {
    server = http.createServer();
    const wss = attachMockWebSocket(server);
    let negotiated = '';

    wss.on('connection', (ws) => {
      negotiated = ws.protocol;
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => {
        port = (server!.address() as { port: number }).port;
        resolve();
      });
    });

    const client = new TradViewWsClient({
      wsUrl: `ws://127.0.0.1:${port}`,
      encoding: 'protobuf',
    });
    await client.connect();
    expect(negotiated).toBe(WS_SUBPROTOCOL_PROTOBUF);
    await client.disconnect();
  });
});