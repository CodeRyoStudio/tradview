import { compareBarSeq, intervalMs, type Bar, type Interval } from '@tradview/data';
import { rangesFromSortedTimes, type TimeRange } from './loaded-ranges.js';

export type SourcePriority = 'rest' | 'ws';

export interface MergeBarInput {
  bar: Bar;
  partial?: boolean;
  barSeq?: string;
  source?: SourcePriority;
}

export interface BarStoreState {
  symbol: string;
  interval: Interval;
  generation: number;
  barsByTime: Map<number, Bar>;
  sortedTimes: number[];
  loadedRanges: TimeRange[];
  lastBarRef: { t: number; partial: boolean; barSeq?: string };
}

export interface BarStoreOptions {
  maxCacheKeys?: number;
}

interface CacheEntry {
  state: BarStoreState;
  lastAccess: number;
}

export class BarStore {
  private state: BarStoreState;
  private mutationQueue: Promise<void> = Promise.resolve();
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxCacheKeys: number;

  constructor(
    symbol: string,
    interval: Interval,
    opts: BarStoreOptions = {},
  ) {
    this.maxCacheKeys = opts.maxCacheKeys ?? 5;
    this.state = this.createEmptyState(symbol, interval);
    this.touchCache(symbol, interval);
  }

  get generation(): number {
    return this.state.generation;
  }

  get symbol(): string {
    return this.state.symbol;
  }

  get interval(): Interval {
    return this.state.interval;
  }

  get sortedTimes(): readonly number[] {
    return this.state.sortedTimes;
  }

  get loadedRanges(): readonly TimeRange[] {
    return this.state.loadedRanges;
  }

  getBar(t: number): Bar | undefined {
    return this.state.barsByTime.get(t);
  }

  getBarsInRange(fromMs: number, toMs: number): Bar[] {
    return this.state.sortedTimes
      .filter((t) => t >= fromMs && t <= toMs)
      .map((t) => this.state.barsByTime.get(t)!);
  }

  enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(fn, fn);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async setSymbolInterval(symbol: string, interval: Interval): Promise<void> {
    return this.enqueue(() => {
      const key = cacheKey(symbol, interval);
      const cached = this.cache.get(key);
      if (cached) {
        this.state = cached.state;
        this.state.generation += 1;
        cached.lastAccess = Date.now();
        return;
      }
      this.persistCurrentToCache();
      this.state = this.createEmptyState(symbol, interval);
      this.state.generation += 1;
      this.touchCache(symbol, interval);
    });
  }

  async mergeBars(inputs: MergeBarInput[], prepend = false): Promise<void> {
    return this.enqueue(() => {
      for (const input of inputs) {
        this.mergeOne(input);
      }
      if (prepend) {
        this.rebuildSortedTimes();
      }
      this.rebuildLoadedRanges();
    });
  }

  async mergeRealtime(input: MergeBarInput): Promise<void> {
    return this.enqueue(() => {
      this.mergeOne({ ...input, source: 'ws' });
      this.rebuildLoadedRanges();
      this.state.lastBarRef = {
        t: input.bar.t,
        partial: input.partial ?? false,
        barSeq: input.barSeq,
      };
    });
  }

  async trimMemory(opts: {
    visibleFromMs: number;
    visibleToMs: number;
    warmupBarCount: number;
    maxBarsInMemory?: number;
  }): Promise<void> {
    return this.enqueue(() => {
      const max = opts.maxBarsInMemory ?? 200_000;
      if (this.state.sortedTimes.length <= max) return;

      const warmupIdx = Math.max(
        0,
        this.state.sortedTimes.findIndex((t) => t >= opts.visibleFromMs) - opts.warmupBarCount,
      );
      const visibleEndIdx = this.state.sortedTimes.findIndex((t) => t > opts.visibleToMs);
      const endIdx =
        visibleEndIdx === -1 ? this.state.sortedTimes.length - 1 : visibleEndIdx;

      const keepFrom = this.state.sortedTimes[warmupIdx]!;
      const keepTo = this.state.sortedTimes[endIdx]!;

      for (const t of [...this.state.sortedTimes]) {
        if (t < keepFrom || t > keepTo) {
          this.state.barsByTime.delete(t);
        }
      }
      this.rebuildSortedTimes();
      this.rebuildLoadedRanges();
    });
  }

  private mergeOne(input: MergeBarInput): void {
    const { bar, partial, barSeq, source = 'ws' } = input;
    const existing = this.state.barsByTime.get(bar.t);

    if (existing) {
      if (barSeq && existing) {
        const existingSeq = this.state.lastBarRef.barSeq;
        if (existingSeq && compareBarSeq(barSeq, existingSeq) <= 0 && source === 'rest') {
          return;
        }
      } else if (source === 'rest' && this.state.lastBarRef.t === bar.t) {
        return;
      }
      this.state.barsByTime.set(bar.t, { ...bar });
    } else if (!partial) {
      this.state.barsByTime.set(bar.t, { ...bar });
      this.state.sortedTimes.push(bar.t);
      this.state.sortedTimes.sort((a, b) => a - b);
    } else {
      this.state.barsByTime.set(bar.t, { ...bar });
      if (!this.state.sortedTimes.includes(bar.t)) {
        this.state.sortedTimes.push(bar.t);
        this.state.sortedTimes.sort((a, b) => a - b);
      }
    }
  }

  private rebuildSortedTimes(): void {
    this.state.sortedTimes = [...this.state.barsByTime.keys()].sort((a, b) => a - b);
  }

  private rebuildLoadedRanges(): void {
    this.state.loadedRanges = rangesFromSortedTimes(
      this.state.sortedTimes,
      intervalMs(this.state.interval),
    );
  }

  private createEmptyState(symbol: string, interval: Interval): BarStoreState {
    return {
      symbol,
      interval,
      generation: 0,
      barsByTime: new Map(),
      sortedTimes: [],
      loadedRanges: [],
      lastBarRef: { t: 0, partial: false },
    };
  }

  private cacheKey(): string {
    return cacheKey(this.state.symbol, this.state.interval);
  }

  private touchCache(symbol: string, interval: Interval): void {
    const key = cacheKey(symbol, interval);
    this.cache.set(key, { state: this.state, lastAccess: Date.now() });
    this.evictCacheIfNeeded();
  }

  private persistCurrentToCache(): void {
    const key = this.cacheKey();
    this.cache.set(key, { state: this.state, lastAccess: Date.now() });
    this.evictCacheIfNeeded();
  }

  private evictCacheIfNeeded(): void {
    if (this.cache.size <= this.maxCacheKeys) return;
    const entries = [...this.cache.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    const evict = entries[0]![0];
    if (evict !== this.cacheKey()) {
      this.cache.delete(evict);
    }
  }
}

function cacheKey(symbol: string, interval: Interval): string {
  return `${symbol}|${interval}`;
}