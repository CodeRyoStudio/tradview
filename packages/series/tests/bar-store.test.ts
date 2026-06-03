import { describe, expect, it } from 'vitest';
import { BarStore } from '../src/bar-store.js';

describe('BarStore', () => {
  it('merges bars by time key', async () => {
    const store = new BarStore('BINANCE:BTCUSDT', '1h');
    await store.mergeBars([
      { bar: { t: 1000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 } },
      { bar: { t: 2000, o: 2, h: 3, l: 1, c: 2, v: 20 } },
    ]);
    expect(store.sortedTimes).toEqual([1000, 2000]);
    expect(store.getBar(1000)?.c).toBe(1.5);
  });

  it('respects barSeq for rest vs ws merge', async () => {
    const store = new BarStore('X', '1m');
    await store.mergeBars([{ bar: { t: 1000, o: 1, h: 1, l: 1, c: 1, v: 1 }, source: 'rest' }]);
    await store.mergeRealtime({
      bar: { t: 1000, o: 1, h: 1, l: 1, c: 9, v: 1 },
      barSeq: '100',
      partial: true,
    });
    expect(store.getBar(1000)?.c).toBe(9);

    await store.mergeBars(
      [{ bar: { t: 1000, o: 1, h: 1, l: 1, c: 1, v: 1 }, barSeq: '50', source: 'rest' }],
      false,
    );
    expect(store.getBar(1000)?.c).toBe(9);
  });

  it('handles uint64 barSeq strings', async () => {
    const store = new BarStore('X', '1m');
    await store.mergeRealtime({
      bar: { t: 1000, o: 1, h: 2, l: 1, c: 2, v: 1 },
      barSeq: '18446744073709551615',
    });
    await store.mergeBars([
      {
        bar: { t: 1000, o: 1, h: 1, l: 1, c: 0, v: 1 },
        barSeq: '18446744073709551614',
        source: 'rest',
      },
    ]);
    expect(store.getBar(1000)?.c).toBe(2);
  });

  it('serializes concurrent mutations', async () => {
    const store = new BarStore('X', '1h');
    await Promise.all([
      store.mergeBars([{ bar: { t: 1000, o: 1, h: 1, l: 1, c: 1, v: 1 } }]),
      store.mergeBars([{ bar: { t: 2000, o: 2, h: 2, l: 2, c: 2, v: 2 } }]),
      store.mergeRealtime({ bar: { t: 3000, o: 3, h: 3, l: 3, c: 3, v: 3 } }),
    ]);
    expect(store.sortedTimes.length).toBe(3);
  });

  it('LRU cache keeps up to 5 symbol|interval keys', async () => {
    const store = new BarStore('A', '1m', { maxCacheKeys: 2 });
    await store.setSymbolInterval('B', '1m');
    await store.mergeBars([{ bar: { t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 } }]);
    await store.setSymbolInterval('C', '1m');
    await store.mergeBars([{ bar: { t: 2, o: 2, h: 2, l: 2, c: 2, v: 2 } }]);
    await store.setSymbolInterval('A', '1m');
    expect(store.sortedTimes.length).toBe(0);
  });
});