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
  kdj,
  macd,
  rsi,
  sma,
} from '@coderyo/indicators';
import { gridOptions } from './chart-grid.js';
import type { TimeScaleBus } from './time-scale-bus.js';

export interface IndicatorPaneStackOptions {
  theme?: 'dark' | 'light';
  showGrid?: boolean;
  config?: IndicatorConfig;
}

function barsForSource(bars: Bar[], source: IndicatorConfig['source']): Bar[] {
  if (source === 'close') return bars;
  return bars.map((b) => ({ ...b, c: (b.h + b.l + b.c) / 3 }));
}

function toUtcSeconds(tMs: number): UTCTimestamp {
  return Math.floor(tMs / 1000) as UTCTimestamp;
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

  constructor(
    private readonly root: HTMLElement,
    bus: TimeScaleBus,
    opts: IndicatorPaneStackOptions | 'dark' | 'light' = 'dark',
  ) {
    const o = typeof opts === 'string' ? { theme: opts, showGrid: false } : opts;
    this.dark = o.theme !== 'light';
    this.showGrid = o.showGrid ?? false;
    this.config = o.config ?? DEFAULT_INDICATOR_CONFIG;
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.flex = '2';
    this.root.style.minHeight = '0';
    this.root.style.overflow = 'hidden';

    const macdPane = this.createPaneWrap('MACD');
    const rsiPane = this.createPaneWrap('RSI');
    const kdjPane = this.createPaneWrap('KDJ');
    this.macdWrap = macdPane.wrap;
    this.rsiWrap = rsiPane.wrap;
    this.kdjWrap = kdjPane.wrap;
    this.root.append(macdPane.wrap, rsiPane.wrap, kdjPane.wrap);
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
    this.applyPaneVisibility();
  }

  private applyPaneVisibility(): void {
    this.macdWrap.style.display = this.config.showMacd ? '' : 'none';
    this.rsiWrap.style.display = this.config.showRsi ? '' : 'none';
    this.kdjWrap.style.display = this.config.showKdj ? '' : 'none';
  }

  clearBars(): void {
    this.macdLine.setData([]);
    this.macdSignal.setData([]);
    this.macdHist.setData([]);
    this.rsiLine.setData([]);
    this.kdjK.setData([]);
    this.kdjD.setData([]);
    this.kdjJ.setData([]);
  }

  setBars(bars: Bar[]): void {
    if (bars.length === 0) return;
    const src = barsForSource(bars, this.config.source);
    const m = macd(src, this.config.macdFast, this.config.macdSlow, this.config.macdSignal);
    this.macdLine.setData(lineData(bars, m.macd));
    this.macdSignal.setData(lineData(bars, m.signal));
    this.macdHist.setData(histData(bars, m.histogram));

    this.rsiLine.setData(lineData(bars, rsi(src, this.config.rsiPeriod)));

    const k = kdj(src, this.config.kdjPeriod, this.config.kdjKSmooth, this.config.kdjDSmooth);
    this.kdjK.setData(lineData(bars, k.k));
    this.kdjD.setData(lineData(bars, k.d));
    this.kdjJ.setData(lineData(bars, k.j));

    this.macdChart.timeScale().fitContent();
    this.rsiChart.timeScale().fitContent();
    this.kdjChart.timeScale().fitContent();
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
    this.macdChart.remove();
    this.rsiChart.remove();
    this.kdjChart.remove();
    this.root.replaceChildren();
  }

  private createPaneWrap(label: string): { wrap: HTMLElement; el: HTMLElement } {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'flex:1;min-height:72px;width:100%;position:relative;border-top:1px solid #30363d;';
    const tag = document.createElement('span');
    tag.textContent = label;
    tag.style.cssText =
      'position:absolute;left:6px;top:4px;z-index:2;font-size:10px;color:#8b949e;pointer-events:none;';
    const el = document.createElement('div');
    el.style.cssText = 'width:100%;height:100%;';
    wrap.append(tag, el);
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