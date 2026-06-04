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
    scrollToTimestamp: vi.fn().mockReturnThis(),
    clearCrosshair: vi.fn().mockReturnThis(),
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

type MockChart = {
  on: ReturnType<typeof vi.fn>;
  setInterval: ReturnType<typeof vi.fn>;
  setVisibleRange: ReturnType<typeof vi.fn>;
  scrollToTimestamp: ReturnType<typeof vi.fn>;
  clearCrosshair: ReturnType<typeof vi.fn>;
};

function chartAt(index: number): MockChart {
  return vi.mocked(createChart).mock.results[index]!.value as MockChart;
}

function getCrosshairHandler(chart: { on: ReturnType<typeof vi.fn> }) {
  const call = chart.on.mock.calls.find((c) => c[0] === 'crosshairChange');
  return call?.[1] as ((p?: unknown) => void) | undefined;
}

describe('ChartWorkspace smoke (V2-MC4)', () => {
  beforeEach(() => {
    vi.mocked(createChart).mockClear();
  });

  it('link group syncs interval and visible range flags', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = chartAt(1);
    ws.setLinkGroup({
      id: 'g',
      chartIds: ['c1', 'c2'],
      sync: { interval: true, visibleRange: true, crosshair: true },
    });

    ws.applyLinkEvent('c1', { type: 'interval', interval: '4h' });
    expect(c2.setInterval).toHaveBeenCalledWith('4h');

    const range = { fromMs: 1, toMs: 2 };
    ws.applyLinkEvent('c1', { type: 'visibleRange', range });
    expect(c2.setVisibleRange).toHaveBeenCalledWith(range);

    ws.applyLinkEvent('c1', { type: 'crosshair', timeMs: 9_000, price: 100 });
    expect(c2.scrollToTimestamp).toHaveBeenCalledWith(9_000);

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('crosshairChange wiring invokes scrollToTimestamp on peer', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = chartAt(1);
    ws.setLinkGroup({
      id: 'g',
      chartIds: ['c1', 'c2'],
      sync: { crosshair: true },
    });

    const handler = getCrosshairHandler(c1);
    handler?.({ time: 42_000, price: 50 });
    expect(c2.scrollToTimestamp).toHaveBeenCalledWith(42_000);

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('crosshairChange null clears peer when sync.crosshair', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = chartAt(1);
    ws.setLinkGroup({ id: 'g', chartIds: ['c1', 'c2'], sync: { crosshair: true } });

    getCrosshairHandler(c1)?.(null);
    expect(c2.clearCrosshair).toHaveBeenCalled();

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('throttles duplicate crosshair timeMs when sync.crosshair (lastLinkedCrosshairMs)', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = chartAt(1);
    ws.setLinkGroup({ id: 'g', chartIds: ['c1', 'c2'], sync: { crosshair: true } });

    const handler = getCrosshairHandler(c1);
    handler?.({ time: 42_000, price: 1 });
    handler?.({ time: 42_000, price: 2 });
    expect(c2.scrollToTimestamp).toHaveBeenCalledTimes(1);
    expect(c2.scrollToTimestamp).toHaveBeenCalledWith(42_000);

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('re-fans crosshair when sync.crosshair re-enabled at same bar time', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = chartAt(1);
    const handler = getCrosshairHandler(c1);

    ws.setLinkGroup({ id: 'g', chartIds: ['c1', 'c2'], sync: { crosshair: false } });
    handler?.({ time: 42_000, price: 1 });
    expect(c2.scrollToTimestamp).not.toHaveBeenCalled();

    ws.setLinkGroup({ id: 'g', chartIds: ['c1', 'c2'], sync: { crosshair: true } });
    handler?.({ time: 42_000, price: 1 });
    expect(c2.scrollToTimestamp).toHaveBeenCalledTimes(1);
    expect(c2.scrollToTimestamp).toHaveBeenCalledWith(42_000);

    ws.destroy();
    a.remove();
    b.remove();
  });

  it('does not fan-out crosshair when sync.crosshair is false', () => {
    const ws = new ChartWorkspace({ dataProvider: stubProvider });
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);

    const c1 = ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', b, { chartId: 'c2' });
    const c2 = chartAt(1);
    ws.setLinkGroup({ id: 'g', chartIds: ['c1', 'c2'], sync: { crosshair: false } });

    getCrosshairHandler(c1)?.({ time: 1, price: 1 });
    expect(c2.scrollToTimestamp).not.toHaveBeenCalled();

    ws.destroy();
    a.remove();
    b.remove();
  });
});