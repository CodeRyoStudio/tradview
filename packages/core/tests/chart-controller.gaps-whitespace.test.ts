import { describe, expect, it, vi } from 'vitest';
import type { Bar, DataProvider } from '@coderyo/data';
import { computeGapStartTimes } from '@coderyo/series';
import { ChartController } from '../src/chart-controller.js';
import { WebGLChartRenderBackend } from '../src/chart-renderer-webgl.js';
import { hasWebGL2 } from '@coderyo/renderer-webgl';

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

/** Irregular spacing triggers computeGapStartTimes for 1h interval. */
const barsWithCalendarGap: Bar[] = [
  {
    t: Date.UTC(2024, 0, 1, 0),
    o: 100,
    h: 101,
    l: 99,
    c: 100.5,
    v: 10,
  },
  {
    t: Date.UTC(2024, 0, 1, 1),
    o: 101,
    h: 102,
    l: 100,
    c: 101.5,
    v: 11,
  },
  {
    t: Date.UTC(2024, 0, 3, 0),
    o: 102,
    h: 103,
    l: 101,
    c: 102.5,
    v: 12,
  },
];

describe.skipIf(!hasWebGL2())('ChartController gaps.whitespace → setBars(bars, gaps)', () => {
  it('passes computed gap times to WebGL orchestrator when whitespace enabled', async () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const setBarsSpy = vi.spyOn(WebGLChartRenderBackend.prototype, 'setBars');

    stubProvider.getHistory = vi.fn(async () => ({
      bars: barsWithCalendarGap,
      hasMore: false,
    }));

    const controller = new ChartController(el, {
      dataProvider: stubProvider,
      symbol: 'TEST',
      interval: '1h',
      features: {
        renderer: 'webgl',
        indicators: null,
        gaps: { whitespace: true, fillVisibleHoles: false },
      },
    });

    await controller.setSymbol('BINANCE:BTCUSDT');

    expect(setBarsSpy).toHaveBeenCalled();
    const [, gaps] = setBarsSpy.mock.calls[setBarsSpy.mock.calls.length - 1]!;
    const expected = computeGapStartTimes(
      barsWithCalendarGap.map((b) => b.t),
      '1h',
    );
    expect(gaps).toEqual(expected);
    expect(gaps?.length).toBeGreaterThan(0);

    setBarsSpy.mockRestore();
    controller.destroy();
    el.remove();
  });
});