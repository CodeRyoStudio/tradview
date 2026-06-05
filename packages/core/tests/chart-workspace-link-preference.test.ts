/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ChartWorkspace } from '../src/chart-workspace.js';
import { LINK_CHARTS_SETTING_KEY } from '../src/link-charts-preference.js';
import { createChart } from '../src/create-chart.js';

vi.mock('../src/create-chart.js', () => ({
  createChart: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    setVisibleRange: vi.fn(),
    destroy: vi.fn(),
  })),
}));

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
} as never;

describe('ChartWorkspace linkCharts preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('enables visibleRange sync when tradview:settings:linkCharts is 1', () => {
    localStorage.setItem(LINK_CHARTS_SETTING_KEY, '1');
    const ws = new ChartWorkspace({
      dataProvider: stubProvider,
      defaultLinkGroupId: 'g1',
    });
    const a = document.createElement('div');
    document.body.append(a);
    ws.createChart('c1', a, { chartId: 'c1' });
    ws.createChart('c2', a, { chartId: 'c2' });

    const c2 = vi.mocked(createChart).mock.results.at(-1)!.value as {
      setVisibleRange: ReturnType<typeof vi.fn>;
    };
    ws.applyLinkEvent('c1', { type: 'visibleRange', range: { fromMs: 1, toMs: 9 } });
    expect(c2.setVisibleRange).toHaveBeenCalled();

    ws.destroy();
    a.remove();
  });
});