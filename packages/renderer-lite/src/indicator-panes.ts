import {
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '@coderyo/data';
import {
  type IndicatorConfig,
  DEFAULT_INDICATOR_CONFIG,
  hasVisibleIndicatorPanes,
  boll,
  kdj,
  macd,
  rsi,
  sma,
  ema,
} from '@coderyo/indicators';
import { gridOptions } from './chart-grid.js';
import { attachPaneResizer } from './pane-resize.js';
import type { TimeScaleBus } from './time-scale-bus.js';

export type IndicatorPaneId = 'macd' | 'rsi' | 'kdj';

export interface IndicatorPaneStackOptions {
  theme?: 'dark' | 'light';
  showGrid?: boolean;
  config?: IndicatorConfig;
  onConfigChange?: (config: IndicatorConfig) => void;
}

function barsForSource(bars: Bar[], source: IndicatorConfig['source']): Bar[] {
  if (source === 'close') return bars;
  return bars.map((b) => ({ ...b, c: (b.h + b.l + b.c) / 3 }));
}

function toUtcSeconds(tMs: number): UTCTimestamp {
  return Math.floor(tMs / 1000) as UTCTimestamp;
}

/** PR-21: detect in-place tail updates vs full recompute. */
export function detectIndicatorBarMutation(
  prevTimes: number[],
  bars: Bar[],
): 'full' | 'tail-append' | 'tail-update' {
  if (prevTimes.length === 0 || bars.length < prevTimes.length) return 'full';
  const prefixLen = Math.min(prevTimes.length, bars.length);
  for (let i = 0; i < prefixLen - 1; i++) {
    if (bars[i]!.t !== prevTimes[i]) return 'full';
  }
  if (bars.length === prevTimes.length) {
    return bars.length > 0 && bars[bars.length - 1]!.t === prevTimes[prevTimes.length - 1]
      ? 'tail-update'
      : 'full';
  }
  if (bars.length - prevTimes.length > 8) return 'full';
  for (let i = 0; i < prevTimes.length; i++) {
    if (bars[i]!.t !== prevTimes[i]) return 'full';
  }
  return 'tail-append';
}

function lineData(bars: Bar[], values: (number | null)[]): LineData<UTCTimestamp>[] {
  const out: LineData<UTCTimestamp>[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = values[i];
    if (v == null) continue;
    out.push({ time: toUtcSeconds(bars[i]!.t), value: v });
  }
  return out;
}

function histData(bars: Bar[], values: (number | null)[]): HistogramData<UTCTimestamp>[] {
  const out: HistogramData<UTCTimestamp>[] = [];
  for (let i = 0; i < bars.length; i++) {
    const v = values[i];
    if (v == null) continue;
    out.push({
      time: toUtcSeconds(bars[i]!.t),
      value: v,
      color: v >= 0 ? '#26a69a88' : '#ef535088',
    });
  }
  return out;
}

export class IndicatorPaneStack {
  private readonly macdChart: IChartApi;
  private readonly rsiChart: IChartApi;
  private readonly kdjChart: IChartApi;
  private readonly macdLine: ISeriesApi<'Line'>;
  private readonly macdSignal: ISeriesApi<'Line'>;
  private readonly macdHist: ISeriesApi<'Histogram'>;
  private readonly rsiLine: ISeriesApi<'Line'>;
  private readonly kdjK: ISeriesApi<'Line'>;
  private readonly kdjD: ISeriesApi<'Line'>;
  private readonly kdjJ: ISeriesApi<'Line'>;
  private dark = true;
  private showGrid = false;
  private config: IndicatorConfig = DEFAULT_INDICATOR_CONFIG;
  private readonly macdWrap: HTMLElement;
  private readonly rsiWrap: HTMLElement;
  private readonly kdjWrap: HTMLElement;
  private readonly detachResizers: Array<() => void> = [];
  private lastBarTimes: number[] = [];
  private onConfigChange?: (config: IndicatorConfig) => void;

  constructor(
    private readonly root: HTMLElement,
    bus: TimeScaleBus,
    opts: IndicatorPaneStackOptions | 'dark' | 'light' = 'dark',
  ) {
    const o = typeof opts === 'string' ? { theme: opts, showGrid: false } : opts;
    this.dark = o.theme !== 'light';
    this.showGrid = o.showGrid ?? false;
    this.config = o.config ?? DEFAULT_INDICATOR_CONFIG;
    this.onConfigChange = o.onConfigChange;
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.flex = '2';
    this.root.style.minHeight = '0';
    this.root.style.overflow = 'hidden';

    const macdPane = this.createPaneWrap('MACD', 'macd');
    const rsiPane = this.createPaneWrap('RSI', 'rsi');
    const kdjPane = this.createPaneWrap('KDJ', 'kdj');
    this.macdWrap = macdPane.wrap;
    this.rsiWrap = rsiPane.wrap;
    this.kdjWrap = kdjPane.wrap;
    this.root.append(macdPane.wrap, rsiPane.wrap, kdjPane.wrap);
    this.detachResizers.push(
      attachPaneResizer(macdPane.wrap, rsiPane.wrap, {
        storageKey: 'tradview:pane:macd-rsi',
        minTopPx: 72,
        minBottomPx: 72,
      }),
      attachPaneResizer(rsiPane.wrap, kdjPane.wrap, {
        storageKey: 'tradview:pane:rsi-kdj',
        minTopPx: 72,
        minBottomPx: 72,
      }),
    );
    this.applyPaneVisibility();

    const layout = this.layoutForTheme(this.dark);
    const grid = gridOptions(this.showGrid, this.dark);
    this.macdChart = createChart(macdPane.el, { layout, grid, autoSize: true });
    this.rsiChart = createChart(rsiPane.el, { layout, grid, autoSize: true });
    this.kdjChart = createChart(kdjPane.el, { layout, grid, autoSize: true });

    for (const c of [this.macdChart, this.rsiChart, this.kdjChart]) bus.register(c);

    this.macdLine = this.macdChart.addSeries(LineSeries, { color: '#2962ff', lineWidth: 1 });
    this.macdSignal = this.macdChart.addSeries(LineSeries, { color: '#ff9800', lineWidth: 1 });
    this.macdHist = this.macdChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });
    this.rsiLine = this.rsiChart.addSeries(LineSeries, { color: '#ab47bc', lineWidth: 1 });
    this.kdjK = this.kdjChart.addSeries(LineSeries, { color: '#42a5f5', lineWidth: 1 });
    this.kdjD = this.kdjChart.addSeries(LineSeries, { color: '#ffa726', lineWidth: 1 });
    this.kdjJ = this.kdjChart.addSeries(LineSeries, { color: '#ef5350', lineWidth: 1 });
  }

  setConfig(config: IndicatorConfig): void {
    this.config = config;
    this.lastBarTimes = [];
    this.applyPaneVisibility();
    if (!this.config.showMacd && !this.config.showRsi && !this.config.showKdj) {
      this.clearBars();
    }
  }

  private closePane(id: IndicatorPaneId): void {
    const patch: Partial<IndicatorConfig> =
      id === 'macd' ? { showMacd: false } : id === 'rsi' ? { showRsi: false } : { showKdj: false };
    this.config = { ...this.config, ...patch };
    this.applyPaneVisibility();
    this.onConfigChange?.(this.config);
  }

  private applyPaneVisibility(): void {
    this.macdWrap.style.display = this.config.showMacd ? '' : 'none';
    this.rsiWrap.style.display = this.config.showRsi ? '' : 'none';
    this.kdjWrap.style.display = this.config.showKdj ? '' : 'none';
    const anyVisible = this.config.showMacd || this.config.showRsi || this.config.showKdj;
    this.root.style.display = anyVisible ? 'flex' : 'none';
  }

  clearBars(): void {
    this.macdLine.setData([]);
    this.macdSignal.setData([]);
    this.macdHist.setData([]);
    this.rsiLine.setData([]);
    this.kdjK.setData([]);
    this.kdjD.setData([]);
    this.kdjJ.setData([]);
    this.lastBarTimes = [];
  }

  private warmupLookback(): number {
    const c = this.config;
    return (
      Math.max(
        c.macdSlow + c.macdSignal,
        c.rsiPeriod,
        c.kdjPeriod + c.kdjKSmooth + c.kdjDSmooth,
      ) + 5
    );
  }

  private detectBarMutation(bars: Bar[]): 'full' | 'tail-append' | 'tail-update' {
    return detectIndicatorBarMutation(this.lastBarTimes, bars);
  }

  private pushSeriesUpdates(
    series: ISeriesApi<'Line'>,
    bars: Bar[],
    values: (number | null)[],
    fromIndex: number,
  ): void {
    for (let i = fromIndex; i < bars.length; i++) {
      const v = values[i];
      if (v == null) continue;
      series.update({ time: toUtcSeconds(bars[i]!.t), value: v });
    }
  }

  private pushHistUpdates(
    series: ISeriesApi<'Histogram'>,
    bars: Bar[],
    values: (number | null)[],
    fromIndex: number,
  ): void {
    for (let i = fromIndex; i < bars.length; i++) {
      const v = values[i];
      if (v == null) continue;
      series.update({
        time: toUtcSeconds(bars[i]!.t),
        value: v,
        color: v >= 0 ? '#26a69a88' : '#ef535088',
      });
    }
  }

  setBars(bars: Bar[]): void {
    if (bars.length === 0) {
      this.clearBars();
      return;
    }

    const needMacd = this.config.showMacd;
    const needRsi = this.config.showRsi;
    const needKdj = this.config.showKdj;
    if (!hasVisibleIndicatorPanes(this.config)) {
      return;
    }

    const mutation = this.detectBarMutation(bars);
    this.lastBarTimes = bars.map((b) => b.t);
    const src = barsForSource(bars, this.config.source);
    const m = needMacd
      ? macd(src, this.config.macdFast, this.config.macdSlow, this.config.macdSignal)
      : null;
    const r = needRsi ? rsi(src, this.config.rsiPeriod) : null;
    const k = needKdj
      ? kdj(src, this.config.kdjPeriod, this.config.kdjKSmooth, this.config.kdjDSmooth)
      : null;

    if (mutation === 'full') {
      if (needMacd && m) {
        this.macdLine.setData(lineData(bars, m.macd));
        this.macdSignal.setData(lineData(bars, m.signal));
        this.macdHist.setData(histData(bars, m.histogram));
        this.macdChart.timeScale().fitContent();
      }
      if (needRsi && r) {
        this.rsiLine.setData(lineData(bars, r));
        this.rsiChart.timeScale().fitContent();
      }
      if (needKdj && k) {
        this.kdjK.setData(lineData(bars, k.k));
        this.kdjD.setData(lineData(bars, k.d));
        this.kdjJ.setData(lineData(bars, k.j));
        this.kdjChart.timeScale().fitContent();
      }
    } else {
      const from =
        mutation === 'tail-update' ? Math.max(0, bars.length - 1) : Math.max(0, bars.length - this.warmupLookback());
      if (needMacd && m) {
        this.pushSeriesUpdates(this.macdLine, bars, m.macd, from);
        this.pushSeriesUpdates(this.macdSignal, bars, m.signal, from);
        this.pushHistUpdates(this.macdHist, bars, m.histogram, from);
      }
      if (needRsi && r) {
        this.pushSeriesUpdates(this.rsiLine, bars, r, from);
      }
      if (needKdj && k) {
        this.pushSeriesUpdates(this.kdjK, bars, k.k, from);
        this.pushSeriesUpdates(this.kdjD, bars, k.d, from);
        this.pushSeriesUpdates(this.kdjJ, bars, k.j, from);
      }
    }

    this.resize();
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.dark = theme === 'dark';
    const layout = this.layoutForTheme(this.dark);
    const grid = gridOptions(this.showGrid, this.dark);
    this.macdChart.applyOptions({ layout, grid });
    this.rsiChart.applyOptions({ layout, grid });
    this.kdjChart.applyOptions({ layout, grid });
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    const grid = gridOptions(show, this.dark);
    this.macdChart.applyOptions({ grid });
    this.rsiChart.applyOptions({ grid });
    this.kdjChart.applyOptions({ grid });
  }

  fitContent(): void {
    this.macdChart.timeScale().fitContent();
    this.rsiChart.timeScale().fitContent();
    this.kdjChart.timeScale().fitContent();
  }

  scrollToRealtime(): void {
    this.macdChart.timeScale().scrollToRealTime();
    this.rsiChart.timeScale().scrollToRealTime();
    this.kdjChart.timeScale().scrollToRealTime();
  }

  resize(): void {
    for (const { chart, el } of [
      { chart: this.macdChart, el: this.macdChart.chartElement().parentElement },
      { chart: this.rsiChart, el: this.rsiChart.chartElement().parentElement },
      { chart: this.kdjChart, el: this.kdjChart.chartElement().parentElement },
    ]) {
      if (!el) continue;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) chart.resize(w, h);
    }
  }

  destroy(): void {
    for (const detach of this.detachResizers) detach();
    this.detachResizers.length = 0;
    this.macdChart.remove();
    this.rsiChart.remove();
    this.kdjChart.remove();
    this.root.replaceChildren();
  }

  private createPaneWrap(
    label: string,
    paneId: IndicatorPaneId,
  ): { wrap: HTMLElement; el: HTMLElement } {
    const wrap = document.createElement('div');
    wrap.className = `tv-indicator-pane tv-indicator-pane--${paneId}`;
    wrap.style.cssText =
      'flex:1;min-height:72px;width:100%;position:relative;border-top:1px solid #30363d;';
    const tag = document.createElement('span');
    tag.textContent = label;
    tag.style.cssText =
      'position:absolute;left:6px;top:4px;z-index:2;font-size:10px;color:#8b949e;pointer-events:none;';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.title = `關閉 ${label}`;
    closeBtn.setAttribute('aria-label', `Close ${label}`);
    closeBtn.style.cssText =
      'position:absolute;right:6px;top:4px;z-index:3;width:22px;height:22px;padding:0;border:1px solid #30363d;border-radius:4px;background:#21262d;color:#8b949e;cursor:pointer;font-size:14px;line-height:1;';
    closeBtn.onmouseenter = () => {
      closeBtn.style.color = '#e6edf3';
      closeBtn.style.borderColor = '#484f58';
    };
    closeBtn.onmouseleave = () => {
      closeBtn.style.color = '#8b949e';
      closeBtn.style.borderColor = '#30363d';
    };
    closeBtn.onclick = () => this.closePane(paneId);
    const el = document.createElement('div');
    el.style.cssText = 'width:100%;height:100%;';
    wrap.append(tag, closeBtn, el);
    return { wrap, el };
  }

  private layoutForTheme(dark: boolean) {
    return {
      background: { type: ColorType.Solid, color: dark ? '#0d1117' : '#ffffff' },
      textColor: dark ? '#e6edf3' : '#24292f',
    };
  }
}

export function maOverlayLine(
  bars: Bar[],
  period = 20,
  source: IndicatorConfig['source'] = 'close',
): LineData<UTCTimestamp>[] {
  const src = barsForSource(bars, source);
  return lineData(bars, sma(src, period));
}

export function volMaOverlayLine(bars: Bar[], period = 5): LineData<UTCTimestamp>[] {
  const volBars = bars.map((b) => ({ ...b, c: b.v ?? 0 }));
  return lineData(bars, sma(volBars, period, 'close'));
}

export function emaOverlayLine(
  bars: Bar[],
  period: number,
  source: IndicatorConfig['source'] = 'close',
): LineData<UTCTimestamp>[] {
  const src = barsForSource(bars, source);
  return lineData(bars, ema(src, period));
}

export function bollOverlayLines(
  bars: Bar[],
  period: number,
  mult: number,
  source: IndicatorConfig['source'] = 'close',
): {
  upper: LineData<UTCTimestamp>[];
  middle: LineData<UTCTimestamp>[];
  lower: LineData<UTCTimestamp>[];
} {
  const src = barsForSource(bars, source);
  const bands = boll(src, period, mult);
  return {
    upper: lineData(bars, bands.upper),
    middle: lineData(bars, bands.middle),
    lower: lineData(bars, bands.lower),
  };
}