import { describe, expect, it, vi } from 'vitest';
import type { IChartApi, LogicalRange } from 'lightweight-charts';
import { TimeScaleBus } from '../src/time-scale-bus.js';

function createMockChart(visibleSec: { from: number; to: number }): {
  chart: IChartApi;
  getLogicalRange: () => LogicalRange;
  setLogicalRange: (range: LogicalRange) => void;
} {
  let logicalRange: LogicalRange = { from: 0, to: 100 };
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
    getVisibleRange: () => visibleSec,
    options: () => ({ barSpacing: 6 }),
    applyOptions: vi.fn(),
    setVisibleRange: vi.fn(),
    scrollToPosition: vi.fn(),
  };
  const chart = { timeScale: () => timeScale } as IChartApi;
  return {
    chart,
    getLogicalRange: () => logicalRange,
    setLogicalRange: (range) => timeScale.setVisibleLogicalRange(range),
  };
}

describe('TimeScaleBus viewport helpers', () => {
  it('returns null visible range when unset', () => {
    const bus = new TimeScaleBus();
    expect(bus.getVisibleRange()).toBeNull();
  });

  it('getBarSpacing defaults when no chart registered', () => {
    const bus = new TimeScaleBus();
    expect(bus.getBarSpacing()).toBe(6);
  });

  it('setVisibleTimeRange updates tracked ms range', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 1_000, toMs: 2_000 });
    expect(bus.getVisibleRange()).toEqual({ fromMs: 1_000, toMs: 2_000 });
  });

  it('subscribeTransform notifies on visible range changes', () => {
    const bus = new TimeScaleBus();
    const listener = vi.fn();
    bus.subscribeTransform(listener);
    bus.setVisibleTimeRange({ fromMs: 5_000, toMs: 9_000 });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ visibleFromMs: 5_000, visibleToMs: 9_000 }),
    );
  });

  it('syncs logical range across registered panes without ms drift (100 iterations)', () => {
    const bus = new TimeScaleBus();
    const a = createMockChart({ from: 1_000, to: 2_000 });
    const b = createMockChart({ from: 1_000, to: 2_000 });
    const c = createMockChart({ from: 1_000, to: 2_000 });
    bus.register(a.chart);
    bus.register(b.chart);
    bus.register(c.chart);
    const transformListener = vi.fn();
    bus.subscribeTransform(transformListener);

    const range: LogicalRange = { from: 10, to: 90 };
    for (let i = 0; i < 100; i++) {
      a.setLogicalRange({ from: range.from + i * 0.01, to: range.to });
    }

    const finalFrom = a.getLogicalRange().from;
    const finalTo = a.getLogicalRange().to;
    expect(b.getLogicalRange()).toEqual({ from: finalFrom, to: finalTo });
    expect(c.getLogicalRange()).toEqual({ from: finalFrom, to: finalTo });
    expect(bus.visibleFromMs).toBe(1_000_000);
    expect(bus.visibleToMs).toBe(2_000_000);
    expect(transformListener.mock.calls.length).toBeGreaterThan(0);
    expect(transformListener).toHaveBeenCalledWith(
      expect.objectContaining({ visibleFromMs: 1_000_000, visibleToMs: 2_000_000 }),
    );
  });
});