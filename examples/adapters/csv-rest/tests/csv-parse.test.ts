import { describe, expect, it, vi } from 'vitest';
import { createCsvRestDataProvider } from '../src/csv-rest-provider.js';

describe('createCsvRestDataProvider', () => {
  it('parses CSV history response', async () => {
    const csv = 't,o,h,l,c,v\n1000,1,2,0.5,1.5,10\n2000,2,3,1,2,20\n';
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
      from: 0,
      to: 10_000,
    });
    expect(bars).toHaveLength(2);
    expect(bars[0]?.t).toBe(1000);
  });
});