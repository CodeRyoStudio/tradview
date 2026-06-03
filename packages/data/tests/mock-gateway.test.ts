import { describe, expect, it, afterEach } from 'vitest';
import { startMockGateway } from '../src/mock/gateway.js';

describe('mock gateway', () => {
  let gateway: Awaited<ReturnType<typeof startMockGateway>> | undefined;

  afterEach(async () => {
    await gateway?.close();
    gateway = undefined;
  });

  it('serves capabilities', async () => {
    gateway = await startMockGateway({ port: 0 });
    const res = await fetch(`${gateway.restBaseUrl}/api/v1/capabilities`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.historyModes).toContain('loadMore');
    expect(body.wsHistory).toBe(true);
  });

  it('supports loadMore history', async () => {
    gateway = await startMockGateway({ port: 0 });
    const endTime = Date.now();
    const url = new URL(`${gateway.restBaseUrl}/api/v1/bars`);
    url.searchParams.set('symbol', 'BINANCE:BTCUSDT');
    url.searchParams.set('interval', '1h');
    url.searchParams.set('endTime', String(endTime));
    url.searchParams.set('limit', '10');

    const res = await fetch(url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bars).toHaveLength(10);
    expect(body.bars[0].t).toBeLessThan(body.bars[9].t);
    expect(body.bars[9].c).toBeGreaterThan(50_000);
    expect(body.bars[9].c).toBeLessThan(200_000);
  });

  it('supports range history', async () => {
    gateway = await startMockGateway({ port: 0 });
    const to = Date.now();
    const from = to - 3_600_000 * 5;
    const url = new URL(`${gateway.restBaseUrl}/api/v1/bars`);
    url.searchParams.set('symbol', 'BINANCE:ETHUSDT');
    url.searchParams.set('interval', '1h');
    url.searchParams.set('from', String(from));
    url.searchParams.set('to', String(to));

    const res = await fetch(url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bars.length).toBeGreaterThan(0);
    for (const bar of body.bars) {
      expect(bar.t).toBeGreaterThanOrEqual(from);
      expect(bar.t).toBeLessThan(to);
    }
  });

  it('rejects invalid range', async () => {
    gateway = await startMockGateway({ port: 0 });
    const url = new URL(`${gateway.restBaseUrl}/api/v1/bars`);
    url.searchParams.set('symbol', 'X');
    url.searchParams.set('interval', '1h');
    url.searchParams.set('from', '200');
    url.searchParams.set('to', '100');

    const res = await fetch(url);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_RANGE');
  });
});