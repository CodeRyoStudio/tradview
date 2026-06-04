import type { ChartViewport } from './chart-viewport.js';

/**
 * Propagates master viewport pan/zoom to follower panes (indicator stacks).
 */
export class ViewportSyncBus {
  private readonly followers = new Set<ChartViewport>();

  constructor(readonly master: ChartViewport) {}

  register(viewport: ChartViewport): () => void {
    this.followers.add(viewport);
    viewport.syncFrom(this.master);
    return () => {
      this.followers.delete(viewport);
    };
  }

  /** Push current master range to all registered followers. */
  propagate(): void {
    for (const vp of this.followers) {
      vp.syncFrom(this.master);
    }
  }
}