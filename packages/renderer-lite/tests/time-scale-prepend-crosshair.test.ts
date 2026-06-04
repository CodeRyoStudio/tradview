import { describe, expect, it, vi } from 'vitest';
import type { IChartApi, LogicalRange } from 'lightweight-charts';
import { BarStore } from '@coderyo/series';
import { TimeScaleBus } from '../src/time-scale-bus.js';
import {
  buildSliceTimes,
  countPrependSliceDelta,
  logicalIndexToBarTimeMs,
  logicalRangeForVisibleWindow,
} from '../src/time-scale-prepend.js';

function createMockChart(
  initial: LogicalRange,
  opts?: { logicalRange?: LogicalRange | null },
): {
  chart: IChartApi;
  getLogicalRange: () => LogicalRange;
} {
  let logicalRange: LogicalRange | null = opts?.logicalRange === undefined ? { ...initial } : opts.logicalRange;
  const logicalListeners = new Set<(range: LogicalRange | null) => void>();
  const timeScale = {
    subscribeVisibleLogicalRangeChange: (cb: (range: LogicalRange | null) => void) => {
      logicalListeners.add(cb);
      return () => logicalListeners.delete(cb);
    },
    setVisibleLogicalRange: (range: LogicalRange) => {
      logicalRange = range;
      for (const listener of logicalListeners) listener(range);
    },
    getVisibleLogicalRange: () => logicalRange,
    getVisibleRange: () => ({ from: 5, to: 9 }),
    options: () => ({ barSpacing: 6 }),
    applyOptions: vi.fn(),
    setVisibleRange: vi.fn(),
    scrollToPosition: vi.fn(),
  };
  const chart = { timeScale: () => timeScale } as IChartApi;
  return { chart, getLogicalRange: () => logicalRange };
}

describe('prepend slice delta (DESIGN §10.4.1)', () => {
  const visibleFromMs = 5_000;
  const visibleToMs = 9_000;
  const renderFromMs = visibleFromMs;

  it('counts new bars in slice after mergeBars(prepend)', async () => {
    const store = new BarStore('X', '1h');
    await store.mergeBars(
      [
        { bar: { t: 5_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
        { bar: { t: 6_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
        { bar: { t: 7_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
        { bar: { t: 8_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
      ],
      false,
    );
    const beforeSlice = buildSliceTimes(store.sortedTimes, renderFromMs, visibleToMs);

    await store.mergeBars(
      [
        { bar: { t: 3_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
        { bar: { t: 4_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
      ],
      true,
    );
    const afterRenderFromMs = 3_000;
    const afterSlice = buildSliceTimes(store.sortedTimes, afterRenderFromMs, visibleToMs);
    expect(countPrependSliceDelta(beforeSlice, afterSlice)).toBe(2);
  });

  it('keeps crosshair bar time after logicalRange offset matches prepend delta', () => {
    const visibleFromMs = 5_000;
    const visibleToMs = 9_000;
    const renderFromMs = visibleFromMs;
    const beforeSorted = [5_000, 6_000, 7_000, 8_000];
    const crosshairLogical = 2;
    const crosshairTimeMs = logicalIndexToBarTimeMs(beforeSorted, crosshairLogical);
    expect(crosshairTimeMs).toBe(7_000);

    const afterSorted = [3_000, 4_000, 5_000, 6_000, 7_000, 8_000];
    const beforeSlice = buildSliceTimes(beforeSorted, renderFromMs, visibleToMs);
    const afterSlice = buildSliceTimes(afterSorted, 3_000, visibleToMs);
    const delta = countPrependSliceDelta(beforeSlice, afterSlice);
    expect(delta).toBe(2);

    const uncompensated = logicalIndexToBarTimeMs(afterSlice, crosshairLogical);
    expect(uncompensated).toBe(5_000);

    const compensated = logicalIndexToBarTimeMs(afterSlice, crosshairLogical + delta);
    expect(compensated).toBe(crosshairTimeMs);
  });
});

describe('prepend edge cases', () => {
  it.each([
    { label: 'delta 0', before: [5_000, 6_000], after: [5_000, 6_000], expected: 0 },
    { label: 'empty before', before: [] as number[], after: [3_000, 5_000], expected: 2 },
    { label: 'no new bars', before: [5_000, 6_000], after: [5_000, 6_000, 7_000], expected: 1 },
  ])('$label → countPrependSliceDelta', ({ before, after, expected }) => {
    const sliceBefore = buildSliceTimes(before, 3_000, 9_000);
    const sliceAfter = buildSliceTimes(after, 3_000, 9_000);
    expect(countPrependSliceDelta(sliceBefore, sliceAfter)).toBe(expected);
  });

  it('compensate with delta 0 does not mutate logical range', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 1_000, toMs: 5_000 });
    const pane = createMockChart({ from: 4, to: 40 });
    bus.register(pane.chart);
    bus.compensatePrependLogicalRange(0, pane.chart);
    expect(pane.getLogicalRange()).toEqual({ from: 4, to: 40 });
  });

  it('compensate no-ops when charts array empty', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 1_000, toMs: 5_000 });
    expect(() => bus.compensatePrependLogicalRange(5)).not.toThrow();
  });
});

describe('TimeScaleBus.compensatePrependLogicalRange', () => {
  it('shifts logical range on all panes without changing canonical ms window', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 5_000_000, toMs: 9_000_000 });

    const initial: LogicalRange = { from: 10, to: 90 };
    const main = createMockChart(initial);
    const volume = createMockChart({ from: 10, to: 90 });
    const indicator = createMockChart({ from: 10, to: 90 });
    bus.register(main.chart);
    bus.register(volume.chart);
    bus.register(indicator.chart);

    const beforeMs = { from: bus.visibleFromMs, to: bus.visibleToMs };
    bus.compensatePrependLogicalRange(25, main.chart);

    expect(main.getLogicalRange()).toEqual({ from: 35, to: 115 });
    expect(volume.getLogicalRange()).toEqual({ from: 35, to: 115 });
    expect(indicator.getLogicalRange()).toEqual({ from: 35, to: 115 });
    expect(bus.visibleFromMs).toBe(beforeMs.from);
    expect(bus.visibleToMs).toBe(beforeMs.to);
  });

  it('falls back to ms→slice when getVisibleLogicalRange is null', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 5_000, toMs: 9_000 });
    const sliceTimes = [3_000, 4_000, 5_000, 6_000, 7_000, 8_000];
    const pane = createMockChart({ from: 0, to: 0 }, { logicalRange: null });
    bus.register(pane.chart);
    const base = logicalRangeForVisibleWindow(sliceTimes, 5_000, 9_000);
    expect(base).toEqual({ from: 2, to: 5 });

    bus.compensatePrependLogicalRange(2, pane.chart, sliceTimes);
    expect(pane.getLogicalRange()).toEqual({ from: 4, to: 7 });
    expect(bus.visibleFromMs).toBe(5_000);
    expect(bus.visibleToMs).toBe(9_000);
  });

  it('rejects referenceChart not registered on bus', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 1_000, toMs: 5_000 });
    const registered = createMockChart({ from: 1, to: 10 });
    const outsider = createMockChart({ from: 99, to: 99 });
    bus.register(registered.chart);
    bus.compensatePrependLogicalRange(3, outsider.chart);
    expect(registered.getLogicalRange()).toEqual({ from: 4, to: 13 });
  });

  it('subscribeTransform still reports stable ms after prepend compensation', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 1_000, toMs: 5_000 });
    const pane = createMockChart({ from: 0, to: 50 });
    bus.register(pane.chart);
    const listener = vi.fn();
    bus.subscribeTransform(listener);

    bus.compensatePrependLogicalRange(1_000);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ visibleFromMs: 1_000, visibleToMs: 5_000 }),
    );
  });
});