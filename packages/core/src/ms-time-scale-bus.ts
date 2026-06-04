import type { ChartVisibleRange } from '@coderyo/renderer-lite';

export type { ChartVisibleRange };

type TransformListener = (state: {
  visibleFromMs: number;
  visibleToMs: number;
  width: number;
  height: number;
}) => void;

/** Ms-based time-scale bus for WebGL (no LWC). */
export class MsTimeScaleBus {
  visibleFromMs = 0;
  visibleToMs = 0;
  private barSpacing = 8;
  private listeners = new Set<TransformListener>();

  subscribeTransform(listener: TransformListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) {
      l({
        visibleFromMs: this.visibleFromMs,
        visibleToMs: this.visibleToMs,
        width: 0,
        height: 0,
      });
    }
  }

  getVisibleRange(): ChartVisibleRange | null {
    if (this.visibleToMs <= this.visibleFromMs) return null;
    return { fromMs: this.visibleFromMs, toMs: this.visibleToMs };
  }

  getBarSpacing(): number {
    return this.barSpacing;
  }

  setBarSpacing(spacing: number): void {
    if (!Number.isFinite(spacing) || spacing <= 0) return;
    this.barSpacing = spacing;
    this.emit();
  }

  setVisibleTimeRange(range: ChartVisibleRange): void {
    if (range.toMs <= range.fromMs) return;
    this.visibleFromMs = range.fromMs;
    this.visibleToMs = range.toMs;
    this.emit();
  }

  setBarsTimeRange(fromMs: number, toMs: number): void {
    this.visibleFromMs = fromMs;
    this.visibleToMs = toMs;
    this.emit();
  }
}

/** Single-bus registry shim for WebGL charts (V2-R12). */
export class MsTimeScaleBusRegistry {
  private readonly bus = new MsTimeScaleBus();
  private activeKey = 'main';

  forEachBus(fn: (key: string, bus: MsTimeScaleBus) => void): void {
    fn(this.activeKey, this.bus);
  }

  getActiveBusKey(): string {
    return this.activeKey;
  }

  getOrCreateBus(_key: string): MsTimeScaleBus {
    return this.bus;
  }
}