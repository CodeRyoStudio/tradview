import { describe, expect, it, vi } from 'vitest';
import type { DataProvider } from '@coderyo/data';

vi.mock('../src/create-chart.js', () => {
  const chart = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setSymbol: vi.fn().mockResolvedValue(undefined),
    setInterval: vi.fn().mockResolvedValue(undefined),
    setVisibleRange: vi.fn().mockReturnThis(),
  };
  return { createChart: vi.fn(() => chart) };
});

import { ChartWorkspace } from '../src/chart-workspace.js';

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

describe('ChartWorkspace (V2-MC1)', () => {
  it('createChart and getChart', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    a.style.width = '200px';
    a.style.height = '160px';
    document.body.append(a);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    expect(ws.getChart('c1')).toBe(c1);
    expect(ws.listChartSummaries()).toEqual([
      expect.objectContaining({ chartId: 'c1', active: true }),
    ]);

    ws.destroy();
    a.remove();
  });

  it('setLinkGroup fans out symbol when sync.symbol', async () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    a.style.width = '200px';
    a.style.height = '160px';
    const b = document.createElement('div');
    b.style.width = '200px';
    b.style.height = '160px';
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    ws.setLinkGroup({
      id: 'g1',
      chartIds: ['c1', 'c2'],
      sync: { symbol: true },
      generation: 0,
    });

    await c1.setSymbol('BINANCE:BTCUSDT');
    ws.notifySymbolChange('c1', 'BINANCE:BTCUSDT');

    ws.destroy();
    a.remove();
    b.remove();
  });
});