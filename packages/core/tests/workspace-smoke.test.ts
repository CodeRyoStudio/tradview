import { describe, expect, it, vi } from 'vitest';
import type { DataProvider } from '@coderyo/data';

vi.mock('../src/create-chart.js', () => {
  const makeChart = () => ({
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setSymbol: vi.fn().mockResolvedValue(undefined),
    setInterval: vi.fn().mockResolvedValue(undefined),
    setVisibleRange: vi.fn().mockReturnThis(),
    scrollToTimestamp: vi.fn().mockReturnThis(),
  });
  return { createChart: vi.fn(() => makeChart()) };
});

import { ChartWorkspace } from '../src/chart-workspace.js';

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

describe('ChartWorkspace smoke (V2-MC4)', () => {
  it('link group syncs interval and visible range flags', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    const c2 = ws.createChart('c2', b, { chartId: 'c2' });
    ws.setLinkGroup({
      id: 'g',
      chartIds: ['c1', 'c2'],
      sync: { interval: true, visibleRange: true, crosshair: true },
      generation: 0,
    });

    ws.applyLinkEvent('c1', { type: 'interval', interval: '4h' });
    expect(c2.setInterval).toHaveBeenCalledWith('4h');

    const range = { fromMs: 1, toMs: 2 };
    ws.applyLinkEvent('c1', { type: 'visibleRange', range });
    expect(c2.setVisibleRange).toHaveBeenCalledWith(range);

    ws.applyLinkEvent('c1', { type: 'crosshair', timeMs: 9_000, price: 100 });
    expect(c2.scrollToTimestamp).toHaveBeenCalledWith(9_000);

    void c1;
    ws.destroy();
    a.remove();
    b.remove();
  });
});