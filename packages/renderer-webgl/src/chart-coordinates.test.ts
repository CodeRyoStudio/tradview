import type { Bar } from '@coderyo/data';
import { describe, expect, it } from 'vitest';
import {
  barIndexForTimeMs,
  createChartCoordinateMapper,
  timeMsAtBarIndex,
} from './chart-coordinates.js';
import { ChartViewport } from './chart-viewport.js';

function makeBars(count: number, stepMs = 3_600_000): Bar[] {
  const t0 = Date.UTC(2024, 0, 1);
  return Array.from({ length: count }, (_, i) => ({
    t: t0 + i * stepMs,
    o: 100 + i,
    h: 101 + i,
    l: 99 + i,
    c: 100.5 + i,
    v: 10,
  }));
}

describe('barIndexForTimeMs', () => {
  it('interpolates between bar timestamps', () => {
    const bars = makeBars(5);
    const mid = bars[2]!.t + (bars[3]!.t - bars[2]!.t) / 2;
    expect(barIndexForTimeMs(bars, mid)).toBeCloseTo(2.5, 5);
  });
});

describe('createChartCoordinateMapper', () => {
  it('round-trips time through x in the plot band', () => {
    const bars = makeBars(100);
    const vp = new ChartViewport({ barSpacing: 8, rightPaddingPx: 56 });
    vp.setBarCount(bars.length);
    vp.fitLatest(vp.plotWidthPx(800));

    const mapper = createChartCoordinateMapper(vp, bars, {
      canvasWidth: 800,
      canvasHeight: 400,
      mainPaneHeight: 300,
      cssWidth: 800,
    });

    const t = bars[50]!.t;
    const x = mapper.timeToX(t);
    expect(x).not.toBeNull();
    const back = mapper.xToTime(x!);
    expect(back).not.toBeNull();
    expect(back!).toBeCloseTo(t, -2);
  });

  it('maps price within main pane height', () => {
    const bars = makeBars(20);
    const vp = new ChartViewport({ rightPaddingPx: 0 });
    vp.setBarCount(bars.length);
    vp.setVisibleRange(0, 20);

    const mapper = createChartCoordinateMapper(vp, bars, {
      canvasWidth: 600,
      canvasHeight: 400,
      mainPaneHeight: 280,
      cssWidth: 600,
    });

    const y = mapper.priceToY(105);
    expect(y).not.toBeNull();
    expect(y!).toBeGreaterThan(0);
    expect(y!).toBeLessThan(280);
    const price = mapper.yToPrice(y!);
    expect(price).toBeCloseTo(105, 0);
  });
});

describe('timeMsAtBarIndex', () => {
  it('returns edge bar times', () => {
    const bars = makeBars(3);
    expect(timeMsAtBarIndex(bars, 0)).toBe(bars[0]!.t);
    expect(timeMsAtBarIndex(bars, 2)).toBe(bars[2]!.t);
  });
});