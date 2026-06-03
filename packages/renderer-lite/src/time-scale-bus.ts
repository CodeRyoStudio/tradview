import type { IChartApi, LogicalRange } from 'lightweight-charts';

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
      if (this.syncing || !range) return;
      this.syncFrom(chart, range);
    });
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