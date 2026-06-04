import { describe, expect, it, vi, afterEach } from 'vitest';
import { createCsvRestDataProvider } from '../src/csv-rest-provider.js';

const csv = 't,o,h,l,c,v\n1000,1,2,0.5,1.5,10\n2000,2,3,1,2,20\n3000,3,4,2,3,30\n';

describe('createCsvRestDataProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses CSV history response (range mode)', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => csv,
    })) as typeof fetch;

    const provider = createCsvRestDataProvider({ restBaseUrl: 'https://example.test/api' });
    const { bars } = await provider.getHistory({
      mode: 'range',
      symbol: 'TEST',
      interval: '1h',
      from: 1500,
      to: 2500,
    });
    expect(bars).toHaveLength(1);
    expect(bars[0]?.t).toBe(2000);
  });

  it('loadMore mode returns tail window', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => csv,
    })) as typeof fetch;

    const provider = createCsvRestDataProvider({ restBaseUrl: 'https://example.test/api' });
    const { bars } = await provider.getHistory({
      mode: 'loadMore',
      symbol: 'TEST',
      interval: '1h',
      endTime: 5000,
      limit: 2,
    });
    expect(bars).toHaveLength(2);
    expect(bars.map((b) => b.t)).toEqual([2000, 3000]);
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '',
    })) as typeof fetch;

    const provider = createCsvRestDataProvider({ restBaseUrl: 'https://example.test/api' });
    await expect(
      provider.getHistory({
        mode: 'range',
        symbol: 'TEST',
        interval: '1h',
        from: 0,
        to: 10_000,
      }),
    ).rejects.toThrow(/404/);
  });

  it('getCapabilities exposes history-only modes', async () => {
    const provider = createCsvRestDataProvider({ restBaseUrl: 'https://example.test/api' });
    const caps = await provider.getCapabilities!();
    expect(caps.historyModes).toContain('range');
    expect(caps.historyModes).toContain('loadMore');
    expect(caps.realtimeModes).toEqual([]);
  });
});