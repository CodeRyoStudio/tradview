import { describe, expect, it } from 'vitest';
import { ChartViewport } from './chart-viewport.js';
import { ViewportSyncBus } from './viewport-sync-bus.js';

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