import { describe, expect, it } from 'vitest';
import { BarStore } from '@tradview/series';
import { VirtualWindow } from '../src/virtual-window.js';

describe('VirtualWindow', () => {
  it('lazy-left-only only plans left loadMore', async () => {
    const store = new BarStore('X', '1h');
    await store.mergeBars([
      { bar: { t: 3_600_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
      { bar: { t: 7_200_000, o: 2, h: 2, l: 2, c: 2, v: 2 } },
    ]);
    const vw = new VirtualWindow(store, { fetchPolicy: 'lazy-left-only' });
    vw.setVisibleRange({ fromMs: 3_600_000, toMs: 7_200_000 });
    const reqs = vw.planFetches();
    expect(reqs.some((r) => r.mode === 'loadMore')).toBe(true);
    expect(reqs.filter((r) => r.mode === 'range')).toHaveLength(0);
  });

  it('fill-visible-holes plans range for interior holes', async () => {
    const store = new BarStore('X', '1h');
    await store.mergeBars([
      { bar: { t: 0, o: 1, h: 1, l: 1, c: 1, v: 1 } },
      { bar: { t: 10_800_000, o: 2, h: 2, l: 2, c: 2, v: 2 } },
    ]);
    const vw = new VirtualWindow(store, { fetchPolicy: 'fill-visible-holes' });
    vw.setVisibleRange({ fromMs: 0, toMs: 10_800_000 });
    const holes = vw.findHoles(0, 10_800_000);
    expect(holes.length).toBeGreaterThan(0);
    const reqs = vw.planFetches();
    expect(reqs.some((r) => r.mode === 'range')).toBe(true);
  });
});