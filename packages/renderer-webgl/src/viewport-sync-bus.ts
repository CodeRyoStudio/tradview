import type { Bar } from '@coderyo/data';
import type { ChartViewport } from './chart-viewport.js';
import { barIndexForTimeMs } from './chart-coordinates.js';
import {
  type LogicalBarLayout,
  timeMsAtLogicalIndex,
} from './logical-bar-layout.js';

/**
 * Propagates master viewport pan/zoom to follower panes (indicator stacks).
 */
export class ViewportSyncBus {
  private readonly followers = new Set<ChartViewport>();
  private readonly followerBars = new WeakMap<ChartViewport, readonly Bar[]>();
  private masterBars: readonly Bar[] = [];
  private masterLayout: LogicalBarLayout | null = null;

  constructor(readonly master: ChartViewport) {}

  setMasterSeriesContext(bars: readonly Bar[], layout: LogicalBarLayout | null): void {
    this.masterBars = bars;
    this.masterLayout = layout;
  }

  register(viewport: ChartViewport, bars?: readonly Bar[]): () => void {
    this.followers.add(viewport);
    if (bars) this.followerBars.set(viewport, bars);
    this.syncFollower(viewport);
    return () => {
      this.followers.delete(viewport);
      this.followerBars.delete(viewport);
    };
  }

  /** Push current master range to all registered followers. */
  propagate(): void {
    for (const vp of this.followers) {
      this.syncFollower(vp);
    }
  }

  private syncFollower(follower: ChartViewport): void {
    const followerBars = this.followerBars.get(follower);
    if (
      !followerBars ||
      followerBars.length === 0 ||
      !this.masterLayout ||
      this.masterLayout.logicalCount === this.masterBars.length
    ) {
      follower.syncFrom(this.master);
      return;
    }
    const fromMs = timeMsAtLogicalIndex(
      this.masterBars,
      this.masterLayout,
      this.master.visibleFrom,
    );
    const toMs = timeMsAtLogicalIndex(this.masterBars, this.masterLayout, this.master.visibleTo);
    const fromIdx = barIndexForTimeMs(followerBars, fromMs);
    const toIdx = barIndexForTimeMs(followerBars, toMs);
    follower.barSpacing = this.master.barSpacing;
    follower.setBarCount(followerBars.length);
    follower.setVisibleRange(fromIdx, Math.max(fromIdx + 1, toIdx));
  }
}