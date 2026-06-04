import type { IChartApi, LogicalRange, UTCTimestamp } from 'lightweight-charts';
import { logicalRangeForVisibleWindow } from './time-scale-prepend.js';

export interface ChartVisibleRange {
  fromMs: number;
  toMs: number;
}

export interface TransformState {
  visibleFromMs: number;
  visibleToMs: number;
  width: number;
  height: number;
}

type TransformListener = (state: TransformState) => void;

/** Sync visible logical range across multiple LWC panes (§10.4.1). */
export class TimeScaleBus {
  private charts: IChartApi[] = [];
  private listeners = new Set<TransformListener>();
  private syncing = false;
  visibleFromMs = 0;
  visibleToMs = 0;

  register(chart: IChartApi): void {
    if (this.charts.includes(chart)) return;
    this.charts.push(chart);
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!this.charts.includes(chart)) return;
      if (this.syncing || !range) return;
      const tr = chart.timeScale().getVisibleRange();
      if (tr && typeof tr.from === 'number' && typeof tr.to === 'number') {
        this.visibleFromMs = tr.from * 1000;
        this.visibleToMs = tr.to * 1000;
      }
      this.syncFrom(chart, range);
    });
  }

  unregister(chart: IChartApi): void {
    const i = this.charts.indexOf(chart);
    if (i >= 0) this.charts.splice(i, 1);
  }

  subscribeTransform(listener: TransformListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setBarsTimeRange(fromMs: number, toMs: number): void {
    this.visibleFromMs = fromMs;
    this.visibleToMs = toMs;
    this.emit();
  }

  getVisibleRange(): ChartVisibleRange | null {
    if (this.visibleToMs <= this.visibleFromMs) return null;
    return { fromMs: this.visibleFromMs, toMs: this.visibleToMs };
  }

  getBarSpacing(): number {
    const chart = this.charts[0];
    return chart ? chart.timeScale().options().barSpacing : 6;
  }

  setBarSpacing(spacing: number): void {
    if (!Number.isFinite(spacing) || spacing <= 0) return;
    this.syncing = true;
    for (const chart of this.charts) {
      chart.timeScale().applyOptions({ barSpacing: spacing });
    }
    this.syncing = false;
    this.emit();
  }

  setVisibleTimeRange(range: ChartVisibleRange): void {
    const from = Math.floor(range.fromMs / 1000) as UTCTimestamp;
    const to = Math.floor(range.toMs / 1000) as UTCTimestamp;
    if (to <= from) return;
    this.visibleFromMs = range.fromMs;
    this.visibleToMs = range.toMs;
    this.syncing = true;
    for (const chart of this.charts) {
      chart.timeScale().setVisibleRange({ from, to });
    }
    this.syncing = false;
    this.emit();
  }

  scrollToLogicalPosition(position: number, animated = false): void {
    this.syncing = true;
    for (const chart of this.charts) {
      chart.timeScale().scrollToPosition(position, animated);
    }
    this.syncing = false;
    this.emit();
  }

  /**
   * DESIGN §10.4.1: after historical prepend, shift every pane's logical range by Δ
   * so canonical `visibleFromMs` / `visibleToMs` (and crosshair time mapping) stay fixed.
   */
  compensatePrependLogicalRange(
    delta: number,
    referenceChart?: IChartApi,
    sliceTimes?: readonly number[],
  ): void {
    const d = Math.max(0, Math.floor(delta));
    if (d === 0 || this.charts.length === 0) return;
    const ref =
      referenceChart && this.charts.includes(referenceChart)
        ? referenceChart
        : this.charts[0]!;
    const ts = ref.timeScale();
    let current: LogicalRange | null =
      typeof ts.getVisibleLogicalRange === 'function'
        ? ts.getVisibleLogicalRange()
        : null;
    if (
      !current &&
      sliceTimes?.length &&
      this.visibleToMs > this.visibleFromMs
    ) {
      current = logicalRangeForVisibleWindow(
        sliceTimes,
        this.visibleFromMs,
        this.visibleToMs,
      );
    }
    if (!current) return;
    const next = {
      from: (current.from as number) + d,
      to: (current.to as number) + d,
    } as LogicalRange;
    this.syncing = true;
    for (const chart of this.charts) {
      chart.timeScale().setVisibleLogicalRange(next);
    }
    this.syncing = false;
    this.emit();
  }

  private syncFrom(source: IChartApi, range: LogicalRange) {
    this.syncing = true;
    for (const chart of this.charts) {
      if (chart !== source) {
        chart.timeScale().setVisibleLogicalRange(range);
      }
    }
    this.syncing = false;
    this.emit();
  }

  private emit(): void {
    const state: TransformState = {
      visibleFromMs: this.visibleFromMs,
      visibleToMs: this.visibleToMs,
      width: 0,
      height: 0,
    };
    for (const l of this.listeners) l(state);
  }
}