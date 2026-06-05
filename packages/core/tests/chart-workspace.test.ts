import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataProvider } from '@coderyo/data';

vi.mock('../src/create-chart.js', () => {
  const makeChart = () => ({
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    setSymbol: vi.fn().mockResolvedValue(undefined),
    setInterval: vi.fn().mockResolvedValue(undefined),
    setVisibleRange: vi.fn().mockReturnThis(),
    setCrosshair: vi.fn(),
    clearCrosshair: vi.fn(),
  });
  return { createChart: vi.fn(() => makeChart()) };
});

import { createChart } from '../src/create-chart.js';
import { ChartWorkspace } from '../src/chart-workspace.js';

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

describe('ChartWorkspace (V2-MC1)', () => {
  beforeEach(() => {
    vi.mocked(createChart).mockClear();
  });

  it('createChart and getChart', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    a.style.width = '200px';
    a.style.height = '160px';
    document.body.append(a);

    const c1 = ws.createChart('c1', a, {
      chartId: 'c1',
      symbol: 'BINANCE:BTCUSDT',
      interval: '1h',
    });
    expect(ws.getChart('c1')).toBe(c1);
    expect(ws.listChartSummaries()).toEqual([
      expect.objectContaining({
        chartId: 'c1',
        active: true,
        symbol: 'BINANCE:BTCUSDT',
        interval: '1h',
      }),
    ]);

    ws.destroy();
    a.remove();
  });

  it('setLinkChartsTimeScale toggles visibleRange on default link group', () => {
    const ws = new ChartWorkspace({
      dataProvider: stubProvider,
      defaultLinkGroupId: 'g1',
    });
    const a = document.createElement('div');
    a.style.width = '200px';
    a.style.height = '160px';
    document.body.append(a);
    ws.createChart('c1', a, { chartId: 'c1' });
    ws.setLinkChartsTimeScale(true);
    ws.setLinkChartsTimeScale(false);
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
    const c2 = vi.mocked(createChart).mock.results.at(-1)!.value as {
      setSymbol: ReturnType<typeof vi.fn>;
    };
    ws.setLinkGroup({
      id: 'g1',
      chartIds: ['c1', 'c2'],
      sync: { symbol: true },
    });

    await c1.setSymbol('BINANCE:BTCUSDT');
    ws.notifySymbolChange('c1', 'BINANCE:BTCUSDT');
    expect(c2.setSymbol).toHaveBeenCalledWith('BINANCE:BTCUSDT');

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('setLinkGroup fans out visibleRange when sync.visibleRange', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = vi.mocked(createChart).mock.results.at(-1)!.value as {
      setVisibleRange: ReturnType<typeof vi.fn>;
    };

    const range = { fromMs: 10, toMs: 20 };
    ws.setLinkGroup({
      id: 'g1',
      chartIds: ['c1', 'c2'],
      sync: { visibleRange: true },
    });
    ws.applyLinkEvent('c1', { type: 'visibleRange', range });
    expect(c2.setVisibleRange).toHaveBeenCalledWith(range);

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('linkChartsTimeScale seeds default link group with visibleRange sync', () => {
    const ws = new ChartWorkspace({
      dataProvider: stubProvider,
      defaultLinkGroupId: 'g1',
      linkChartsTimeScale: true,
    });
    const a = document.createElement('div');
    document.body.append(a);
    ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', a, { chartId: 'c2' });

    const c2 = vi.mocked(createChart).mock.results.at(-1)!.value as {
      setVisibleRange: ReturnType<typeof vi.fn>;
    };
    ws.applyLinkEvent('c1', { type: 'visibleRange', range: { fromMs: 1, toMs: 9 } });
    expect(c2.setVisibleRange).toHaveBeenCalledWith({ fromMs: 1, toMs: 9 });

    ws.destroy();
    a.remove();
  });
});