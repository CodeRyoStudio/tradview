import { describe, expect, it } from 'vitest';
import { ChartViewport, clampBarSpacing, DEFAULT_RIGHT_PADDING_PX } from './chart-viewport.js';

describe('ChartViewport', () => {
  it('fits latest bars into plot width', () => {
    const vp = new ChartViewport({ barSpacing: 10, rightPaddingPx: 0 });
    vp.setBarCount(100);
    vp.fitLatest(500);
    expect(vp.visibleSpan).toBeCloseTo(50, 1);
    expect(vp.visibleTo).toBeCloseTo(100, 5);
    expect(vp.visibleFrom).toBeCloseTo(50, 1);
  });

  it('plotWidthPx subtracts right padding', () => {
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    expect(vp.plotWidthPx(800)).toBe(744);
    expect(vp.rightPaddingPx).toBe(DEFAULT_RIGHT_PADDING_PX);
  });

  it('fitLatest uses plot width not total width', () => {
    const vp = new ChartViewport({ barSpacing: 10, rightPaddingPx: 56 });
    vp.setBarCount(100);
    vp.fitLatest(vp.plotWidthPx(560));
    expect(vp.visibleSpan).toBeCloseTo(50.4, 0);
  });

  it('maps bar index to plot x', () => {
    const vp = new ChartViewport({ rightPaddingPx: 0 });
    vp.setBarCount(10);
    vp.setVisibleRange(0, 10);
    expect(vp.plotXForBarIndex(0, 100)).toBeCloseTo(0, 5);
    expect(vp.plotXForBarIndex(5, 100)).toBeCloseTo(50, 5);
    expect(vp.plotXForBarIndex(10, 100)).toBeCloseTo(100, 5);
  });

  it('barIndexAtPlotX inverts plotXForBarIndex', () => {
    const vp = new ChartViewport({ rightPaddingPx: 0 });
    vp.setBarCount(20);
    vp.setVisibleRange(2, 12);
    const plotW = 400;
    const idx = vp.barIndexAtPlotX(200, plotW);
    expect(vp.plotXForBarIndex(idx, plotW)).toBeCloseTo(200, 4);
  });

  it('plotXFromCanvasX clamps to plot band', () => {
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    expect(vp.plotXFromCanvasX(100, 800)).toBe(100);
    expect(vp.plotXFromCanvasX(800, 800)).toBe(744);
    expect(vp.plotXFromCanvasX(-10, 800)).toBe(0);
  });

  it('isPlotCanvasX excludes price gutter', () => {
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    expect(vp.isPlotCanvasX(700, 800)).toBe(true);
    expect(vp.isPlotCanvasX(750, 800)).toBe(false);
  });

  it('pans visible range', () => {
    const vp = new ChartViewport({ rightPaddingPx: 0 });
    vp.setBarCount(50);
    vp.setVisibleRange(10, 20);
    vp.pan(5);
    expect(vp.visibleFrom).toBeCloseTo(15, 5);
    expect(vp.visibleTo).toBeCloseTo(25, 5);
  });

  it('zoomBarSpacing increases bar spacing', () => {
    const vp = new ChartViewport({ barSpacing: 8, rightPaddingPx: 0 });
    vp.setBarCount(200);
    vp.setVisibleRange(50, 150);
    vp.zoomBarSpacing(2, 200, 400);
    expect(vp.barSpacing).toBeGreaterThan(8);
  });

  it('zoomBarSpacing no-op at max spacing', () => {
    const vp = new ChartViewport({ barSpacing: 48, rightPaddingPx: 0 });
    vp.setVisibleRange(0, 10);
    const from = vp.visibleFrom;
    const to = vp.visibleTo;
    vp.zoomBarSpacing(10, 50, 400);
    expect(vp.visibleFrom).toBe(from);
    expect(vp.visibleTo).toBe(to);
    expect(vp.barSpacing).toBe(48);
  });

  it('setVisibleRange no-op when to <= from', () => {
    const vp = new ChartViewport({ rightPaddingPx: 0 });
    vp.setVisibleRange(5, 10);
    vp.setVisibleRange(10, 5);
    expect(vp.visibleFrom).toBe(5);
    expect(vp.visibleTo).toBe(10);
  });

  it('setBarCount(0) clears visible range', () => {
    const vp = new ChartViewport();
    vp.setBarCount(10);
    vp.setBarCount(0);
    expect(vp.visibleSpan).toBe(0);
    expect(vp.barCount).toBe(0);
  });

  it('visibleBarIndexRange clamps to data', () => {
    const vp = new ChartViewport();
    vp.setBarCount(5);
    vp.setVisibleRange(-2, 8);
    expect(vp.visibleBarIndexRange()).toEqual({ from: 0, to: 4 });
  });

  it('clampBarSpacing respects bounds', () => {
    expect(clampBarSpacing(1)).toBe(2);
    expect(clampBarSpacing(100)).toBe(48);
    expect(clampBarSpacing(8)).toBe(8);
  });
});