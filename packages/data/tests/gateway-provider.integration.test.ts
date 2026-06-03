import { describe, expect, it, afterEach } from 'vitest';
import { startMockGateway } from '../src/mock/gateway.js';
import { createGatewayDataProvider } from '../src/client/gateway-provider.js';
import type { Bar } from '../src/types.js';

describe('GatewayDataProvider (PR-03)', () => {
  let gateway: Awaited<ReturnType<typeof startMockGateway>> | undefined;

  afterEach(async () => {
    await gateway?.close();
    gateway = undefined;
  });

  it('fetches capabilities and history via REST', async () => {
    gateway = await startMockGateway({ port: 0 });
    const provider = createGatewayDataProvider({
      restBaseUrl: gateway.restBaseUrl,
      wsUrl: gateway.wsUrl,
    });

    const caps = await provider.getCapabilities!();
    expect(caps.historyModes).toContain('loadMore');

    const endTime = Date.now();
    const { bars } = await provider.getHistory({
      mode: 'loadMore',
      symbol: 'BINANCE:BTCUSDT',
      interval: '1h',
      endTime,
      limit: 5,
    });
    expect(bars).toHaveLength(5);
  });

  it('subscribes over WS and receives bar updates', async () => {
    gateway = await startMockGateway({ port: 0 });
    const provider = createGatewayDataProvider({
      restBaseUrl: gateway.restBaseUrl,
      wsUrl: gateway.wsUrl,
    });

    await provider.connect!();

    const received: Bar[] = [];
    const sub = await provider.subscribe(
      { symbol: 'BINANCE:BTCUSDT', interval: '1m', channels: ['bar'] },
      {
        onBar: (bar) => received.push(bar),
        onConnectionChange: () => {},
      },
    );

    expect(sub.id).toMatch(/^sub-/);

    await new Promise((r) => setTimeout(r, 2500));
    expect(received.length).toBeGreaterThan(0);

    await provider.unsubscribe(sub.id);
    await provider.disconnect!();
  });

  it('requestWsHistory uses WS when capabilities allow', async () => {
    gateway = await startMockGateway({ port: 0 });
    const provider = createGatewayDataProvider({
      restBaseUrl: gateway.restBaseUrl,
      wsUrl: gateway.wsUrl,
    });

    const bars = await provider.requestWsHistory!({
      symbol: 'BINANCE:BTCUSDT',
      interval: '1h',
      from: Date.now() - 3_600_000 * 10,
      to: Date.now(),
    });

    expect(bars.length).toBeGreaterThan(0);
    await provider.disconnect!();
  });
});