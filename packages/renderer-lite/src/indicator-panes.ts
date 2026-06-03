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
import type { Bar } from '@tradview/data';
import { kdj, macd, rsi, sma } from '@tradview/indicators';
import type { TimeScaleBus } from './time-scale-bus.js';

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

  constructor(
    private readonly root: HTMLElement,
    bus: TimeScaleBus,
    theme: 'dark' | 'light',
  ) {
    this.dark = theme === 'dark';
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.flex = '2';
    this.root.style.minHeight = '0';
    this.root.style.overflow = 'hidden';

    const macdWrap = this.createPaneWrap('MACD');
    const rsiWrap = this.createPaneWrap('RSI');
    const kdjWrap = this.createPaneWrap('KDJ');
    this.root.append(macdWrap.wrap, rsiWrap.wrap, kdjWrap.wrap);

    const layout = this.layoutForTheme(this.dark);
    this.macdChart = createChart(macdWrap.el, { layout, autoSize: true });
    this.rsiChart = createChart(rsiWrap.el, { layout, autoSize: true });
    this.kdjChart = createChart(kdjWrap.el, { layout, autoSize: true });

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

  setBars(bars: Bar[]): void {
    if (bars.length === 0) return;
    const m = macd(bars);
    this.macdLine.setData(lineData(bars, m.macd));
    this.macdSignal.setData(lineData(bars, m.signal));
    this.macdHist.setData(histData(bars, m.histogram));

    this.rsiLine.setData(lineData(bars, rsi(bars)));

    const k = kdj(bars);
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
    this.macdChart.applyOptions({ layout });
    this.rsiChart.applyOptions({ layout });
    this.kdjChart.applyOptions({ layout });
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

export function maOverlayLine(bars: Bar[], period = 20): LineData<UTCTimestamp>[] {
  return lineData(bars, sma(bars, period));
}

export function volMaOverlayLine(bars: Bar[], period = 5): LineData<UTCTimestamp>[] {
  const volBars = bars.map((b) => ({ ...b, c: b.v ?? 0 }));
  return lineData(bars, sma(volBars, period, 'close'));
}