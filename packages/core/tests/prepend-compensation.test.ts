import { describe, expect, it } from 'vitest';
import { BarStore } from '@coderyo/series';
import { parseInterval } from '@coderyo/data';
import {
  TimeScaleBus,
  buildSliceTimes,
  compensatePrependOnBus,
  computePrependSliceDeltaForViewport,
  deriveRenderRange,
  logicalIndexToBarTimeMs,
} from '@coderyo/renderer-lite';

describe('prepend compensation chain (BarStore → delta → bus)', () => {
  const visibleFromMs = 5_000;
  const visibleToMs = 9_000;
  const intervalMs = 3_600_000;

  it('mergeBars(prepend) → delta → compensate keeps crosshair bar time', async () => {
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
    const before = [...store.sortedTimes];
    const crosshairLogical = 2;
    const { renderFromMs, renderToMs } = deriveRenderRange(
      visibleFromMs,
      visibleToMs,
      before,
      intervalMs,
    );
    const beforeSlice = buildSliceTimes(before, renderFromMs, renderToMs);
    const crosshairMs = logicalIndexToBarTimeMs(beforeSlice, crosshairLogical);
    expect(crosshairMs).toBe(7_000);

    await store.mergeBars(
      [
        { bar: { t: 3_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
        { bar: { t: 4_000, o: 1, h: 1, l: 1, c: 1, v: 1 } },
      ],
      true,
    );
    const after = [...store.sortedTimes];

    const delta = computePrependSliceDeltaForViewport({
      sortedTimesBefore: before,
      sortedTimesAfter: after,
      visibleFromMs,
      visibleToMs,
      intervalMs,
    });
    expect(delta).toBe(2);

    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: visibleFromMs, toMs: visibleToMs });
    let logicalRange = { from: crosshairLogical, to: crosshairLogical + 10 };
    const chart = {
      timeScale: () => ({
        getVisibleLogicalRange: () => logicalRange,
        setVisibleLogicalRange: (r: { from: number; to: number }) => {
          logicalRange = r;
        },
        getVisibleRange: () => ({
          from: visibleFromMs / 1000,
          to: visibleToMs / 1000,
        }),
        options: () => ({ barSpacing: 6 }),
        applyOptions: () => {},
        setVisibleRange: () => {},
        scrollToPosition: () => {},
        subscribeVisibleLogicalRangeChange: () => () => {},
      }),
    };
    bus.register(chart as never);

    compensatePrependOnBus(bus, {
      sortedTimesBefore: before,
      sortedTimesAfter: after,
      intervalMs,
      referenceChart: chart as never,
    });

    expect(logicalRange.from).toBe(crosshairLogical + delta);
    const afterRender = deriveRenderRange(visibleFromMs, visibleToMs, after, intervalMs);
    const afterSlice = buildSliceTimes(after, afterRender.renderFromMs, afterRender.renderToMs);
    expect(logicalIndexToBarTimeMs(afterSlice, logicalRange.from)).toBe(crosshairMs);
    expect(bus.visibleFromMs).toBe(visibleFromMs);
    expect(bus.visibleToMs).toBe(visibleToMs);
  });

  it('uses store interval for PaneOrchestrator-shaped compensation', () => {
    const store = new BarStore('X', parseInterval('1h'));
    expect(store.interval).toBe('1h');
  });
});