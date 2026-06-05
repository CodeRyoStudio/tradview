import type { Bar } from '@coderyo/data';
import { describe, expect, it } from 'vitest';
import { barIndexForTimeMs } from './chart-coordinates.js';
import { ChartViewport } from './chart-viewport.js';
import { buildLogicalBarLayout, timeMsAtLogicalIndex } from './logical-bar-layout.js';
import { ViewportSyncBus } from './viewport-sync-bus.js';

function bar(t: number): Bar {
  return { t, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };
}

describe('ViewportSyncBus', () => {
  it('propagates pan/zoom from master to followers', () => {
    const master = new ChartViewport({ barSpacing: 8, rightPaddingPx: 0 });
    master.setBarCount(200);
    master.setVisibleRange(40, 120);

    const follower = new ChartViewport({ barSpacing: 4, rightPaddingPx: 0 });
    follower.setBarCount(50);

    const bus = new ViewportSyncBus(master);
    bus.register(follower);

    master.pan(10);
    master.zoomBarSpacing(2, 100, 400);
    bus.propagate();

    expect(follower.barSpacing).toBe(master.barSpacing);
    expect(follower.visibleFrom).toBeCloseTo(master.visibleFrom, 8);
    expect(follower.visibleTo).toBeCloseTo(master.visibleTo, 8);
    expect(follower.barCount).toBe(200);
  });

  it('follower setBarCount + propagate matches master after setBars (V2-R5)', () => {
    const master = new ChartViewport({ barSpacing: 9, rightPaddingPx: 0 });
    master.setBarCount(120);
    master.fitLatest(500);

    const follower = new ChartViewport({ barSpacing: 4, rightPaddingPx: 0 });
    const bus = new ViewportSyncBus(master);
    bus.register(follower);

    follower.setBarCount(120);
    bus.propagate();

    expect(follower.visibleFrom).toBeCloseTo(master.visibleFrom, 8);
    expect(follower.visibleTo).toBeCloseTo(master.visibleTo, 8);
    expect(follower.barSpacing).toBe(master.barSpacing);
    expect(follower.barCount).toBe(120);
  });

  it('propagates master logical range to follower by time when gaps layout active', () => {
    const masterBars = [bar(1000), bar(2000), bar(10_000)];
    const layout = buildLogicalBarLayout(masterBars, [10_000]);
    expect(layout.logicalCount).toBe(masterBars.length + 1);

    const master = new ChartViewport({ barSpacing: 8, rightPaddingPx: 0 });
    master.setBarCount(layout.logicalCount);
    master.setVisibleRange(1, 3);

    const followerBars = [...masterBars];
    const follower = new ChartViewport({ barSpacing: 8, rightPaddingPx: 0 });
    const bus = new ViewportSyncBus(master);
    bus.setMasterSeriesContext(masterBars, layout);
    bus.register(follower, followerBars);
    bus.propagate();

    const fromMs = timeMsAtLogicalIndex(masterBars, layout, master.visibleFrom);
    const toMs = timeMsAtLogicalIndex(masterBars, layout, master.visibleTo);
    const fromIdx = barIndexForTimeMs(followerBars, fromMs);
    const toIdx = barIndexForTimeMs(followerBars, toMs);

    expect(follower.barSpacing).toBe(master.barSpacing);
    expect(follower.barCount).toBe(followerBars.length);
    expect(follower.visibleFrom).toBeCloseTo(fromIdx, 6);
    expect(follower.visibleTo).toBeCloseTo(Math.max(fromIdx + 1, toIdx), 6);
  });

  it('unregister stops updates', () => {
    const master = new ChartViewport({ rightPaddingPx: 0 });
    master.setBarCount(100);
    master.setVisibleRange(10, 30);

    const follower = new ChartViewport({ rightPaddingPx: 0 });
    const bus = new ViewportSyncBus(master);
    const off = bus.register(follower);
    bus.propagate();
    off();

    master.pan(20);
    bus.propagate();
    expect(follower.visibleFrom).toBeCloseTo(10, 8);
  });
});