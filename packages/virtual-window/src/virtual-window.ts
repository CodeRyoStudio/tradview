import { intervalMs, type Interval } from '@tradview/data';
import type { BarStore } from '@tradview/series';
import type { TimeRange } from '@tradview/series';

export type FetchPolicy = 'lazy-left-only' | 'fill-visible-holes';

export interface VisibleRange {
  fromMs: number;
  toMs: number;
}

export interface HistoryRequest {
  mode: 'loadMore' | 'range';
  symbol: string;
  interval: Interval;
  endTime?: number;
  fromMs?: number;
  toMs?: number;
  limit: number;
}

export interface VirtualWindowOptions {
  fetchPolicy?: FetchPolicy;
  pageSize?: number;
  fetchThresholdBars?: number;
  warmupBarCount?: number;
}

export class VirtualWindow {
  visibleFromMs = 0;
  visibleToMs = 0;
  readonly fetchPolicy: FetchPolicy;
  readonly pageSize: number;
  readonly fetchThresholdBars: number;
  readonly warmupBarCount: number;

  constructor(
    private readonly store: BarStore,
    opts: VirtualWindowOptions = {},
  ) {
    this.fetchPolicy = opts.fetchPolicy ?? 'lazy-left-only';
    this.pageSize = opts.pageSize ?? 500;
    this.fetchThresholdBars = opts.fetchThresholdBars ?? 20;
    this.warmupBarCount = opts.warmupBarCount ?? 200;
  }

  setVisibleRange(range: VisibleRange): void {
    this.visibleFromMs = range.fromMs;
    this.visibleToMs = range.toMs;
  }

  getRenderRange(): { renderFromMs: number; renderToMs: number } {
    const times = this.store.sortedTimes;
    if (this.visibleToMs <= this.visibleFromMs && times.length > 0) {
      const fromMs = times[0]!;
      const toMs = times[times.length - 1]!;
      const bufferMs = intervalMs(this.store.interval) * 20;
      return { renderFromMs: fromMs - bufferMs, renderToMs: toMs + bufferMs };
    }

    const span = this.visibleToMs - this.visibleFromMs;
    const bufferMs = Math.max(span * 0.1, intervalMs(this.store.interval) * 50);
    return {
      renderFromMs: this.visibleFromMs - bufferMs,
      renderToMs: this.visibleToMs + bufferMs,
    };
  }

  getBarsForRender(): ReturnType<BarStore['getBarsInRange']> {
    const { renderFromMs, renderToMs } = this.getRenderRange();
    return this.store.getBarsInRange(renderFromMs, renderToMs);
  }

  /** Gaps inside render range not covered by loadedRanges. */
  findHoles(renderFromMs: number, renderToMs: number): TimeRange[] {
    const loaded = this.store.loadedRanges;
    if (loaded.length === 0) return [{ fromMs: renderFromMs, toMs: renderToMs }];

    const holes: TimeRange[] = [];
    let cursor = renderFromMs;

    for (const r of loaded) {
      if (r.toMs < renderFromMs) continue;
      if (r.fromMs > renderToMs) break;
      if (r.fromMs > cursor) {
        holes.push({ fromMs: cursor, toMs: Math.min(r.fromMs, renderToMs) });
      }
      cursor = Math.max(cursor, r.toMs);
    }
    if (cursor < renderToMs) {
      holes.push({ fromMs: cursor, toMs: renderToMs });
    }
    return holes;
  }

  needsHistoryLeft(renderFromMs: number): boolean {
    const loaded = this.store.loadedRanges;
    if (loaded.length === 0) return true;
    const minLoaded = Math.min(...loaded.map((r) => r.fromMs));
    const threshold = intervalMs(this.store.interval) * this.fetchThresholdBars;
    return renderFromMs < minLoaded - threshold;
  }

  needsHistoryRight(renderToMs: number): boolean {
    const loaded = this.store.loadedRanges;
    if (loaded.length === 0) return true;
    const maxLoaded = Math.max(...loaded.map((r) => r.toMs));
    const threshold = intervalMs(this.store.interval) * this.fetchThresholdBars;
    return renderToMs > maxLoaded + threshold;
  }

  planFetches(): HistoryRequest[] {
    const { renderFromMs, renderToMs } = this.getRenderRange();
    const reqs: HistoryRequest[] = [];

    if (this.needsHistoryLeft(renderFromMs)) {
      const loaded = this.store.loadedRanges;
      const minLoaded =
        loaded.length > 0 ? Math.min(...loaded.map((r) => r.fromMs)) : renderToMs;
      reqs.push({
        mode: 'loadMore',
        symbol: this.store.symbol,
        interval: this.store.interval,
        endTime: minLoaded - intervalMs(this.store.interval),
        limit: this.pageSize,
      });
    }

    if (this.fetchPolicy === 'fill-visible-holes') {
      for (const hole of this.findHoles(renderFromMs, renderToMs)) {
        reqs.push({
          mode: 'range',
          symbol: this.store.symbol,
          interval: this.store.interval,
          fromMs: hole.fromMs,
          toMs: hole.toMs,
          limit: this.pageSize,
        });
      }
      if (this.needsHistoryRight(renderToMs)) {
        const maxLoaded = Math.max(...this.store.loadedRanges.map((r) => r.toMs), 0);
        reqs.push({
          mode: 'range',
          symbol: this.store.symbol,
          interval: this.store.interval,
          fromMs: maxLoaded + intervalMs(this.store.interval),
          toMs: renderToMs,
          limit: this.pageSize,
        });
      }
    }

    return reqs;
  }

  async ensureWarmupBars(): Promise<boolean> {
    const times = this.store.sortedTimes;
    const idx = times.findIndex((t) => t >= this.visibleFromMs);
    const haveBefore = idx <= 0 ? 0 : idx;
    return haveBefore >= this.warmupBarCount;
  }
}