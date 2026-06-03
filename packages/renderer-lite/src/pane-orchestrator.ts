import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '@tradview/data';
import { lodDecimateBars } from '@tradview/series';
import { attachPaneResizer } from './pane-resize.js';
import { TimeScaleBus } from './time-scale-bus.js';

export type ScaleMode = 'linear' | 'log';

export interface PaneOrchestratorOptions {
  container: HTMLElement;
  theme?: 'dark' | 'light';
  scaleMode?: ScaleMode;
  maxRenderPoints?: number;
}

function toUtcSeconds(tMs: number): UTCTimestamp {
  return Math.floor(tMs / 1000) as UTCTimestamp;
}

function barToCandle(b: Bar): CandlestickData {
  return { time: toUtcSeconds(b.t), open: b.o, high: b.h, low: b.l, close: b.c };
}

function barToVolume(b: Bar): HistogramData<UTCTimestamp> {
  return { time: toUtcSeconds(b.t), value: b.v ?? 0 };
}

export class PaneOrchestrator {
  readonly bus = new TimeScaleBus();
  private readonly mainChart: IChartApi;
  private readonly volumeChart: IChartApi;
  private readonly mainSeries;
  private readonly volumeSeries;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private dark = true;
  private readonly maxRenderPoints: number;

  constructor(opts: PaneOrchestratorOptions) {
    this.maxRenderPoints = opts.maxRenderPoints ?? 4000;
    this.dark = opts.theme !== 'light';
    const layout = this.layoutForTheme(this.dark);

    const mainEl = document.createElement('div');
    mainEl.style.cssText = 'flex:7;min-height:120px;width:100%;position:relative;';
    const volEl = document.createElement('div');
    volEl.style.cssText = 'flex:2;min-height:64px;width:100%;position:relative;';

    opts.container.style.cssText =
      'display:flex;flex-direction:column;height:100%;width:100%;min-height:240px;overflow:hidden;';
    opts.container.append(mainEl, volEl);
    attachPaneResizer(mainEl, volEl, { storageKey: 'tradview:pane:main-volume' });

    this.mainChart = createChart(mainEl, { layout, autoSize: true });
    this.volumeChart = createChart(volEl, {
      layout,
      autoSize: true,
      rightPriceScale: { scaleMargins: { top: 0.8, bottom: 0 } },
    });

    if (opts.scaleMode === 'log') {
      this.mainChart.priceScale('right').applyOptions({ mode: 1 }); // Logarithmic
    }

    this.mainSeries = this.mainChart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    this.volumeSeries = this.volumeChart.addSeries(HistogramSeries, {
      color: '#26a69a55',
      priceFormat: { type: 'volume' },
    });

    this.bus.register(this.mainChart);
    this.bus.register(this.volumeChart);

    this.initOverlay(mainEl);
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.dark = theme === 'dark';
    const layout = this.layoutForTheme(this.dark);
    this.mainChart.applyOptions({ layout });
    this.volumeChart.applyOptions({ layout });
  }

  setBars(bars: Bar[], gaps?: number[]): void {
    const renderBars = lodDecimateBars(bars, this.maxRenderPoints);
    const candles: CandlestickData[] = [];
    const vols: HistogramData<UTCTimestamp>[] = [];
    const gapSet = new Set(gaps ?? []);

    for (let i = 0; i < renderBars.length; i++) {
      const b = renderBars[i]!;
      if (i > 0 && gapSet.has(b.t)) {
        // whitespace: skip connecting — LWC uses sparse times
      }
      candles.push(barToCandle(b));
      vols.push(barToVolume(b));
    }

    this.mainSeries.setData(candles);
    this.volumeSeries.setData(vols);

    if (renderBars.length > 0) {
      this.bus.setBarsTimeRange(renderBars[0]!.t, renderBars[renderBars.length - 1]!.t);
      this.syncChartSize();
      this.mainChart.timeScale().fitContent();
      this.volumeChart.timeScale().fitContent();
    }
  }

  fitContent(): void {
    this.mainChart.timeScale().fitContent();
    this.volumeChart.timeScale().fitContent();
  }

  scrollToRealtime(): void {
    this.mainChart.timeScale().scrollToRealTime();
    this.volumeChart.timeScale().scrollToRealTime();
  }

  setLogScale(enabled: boolean): void {
    this.mainChart.priceScale('right').applyOptions({ mode: enabled ? 1 : 0 });
  }

  resize(): void {
    this.syncChartSize();
    this.syncOverlaySize();
  }

  private syncChartSize(): void {
    const mainEl = this.mainChart.chartElement().parentElement;
    const volEl = this.volumeChart.chartElement().parentElement;
    if (mainEl) {
      const w = mainEl.clientWidth;
      const h = mainEl.clientHeight;
      if (w > 0 && h > 0) this.mainChart.resize(w, h);
    }
    if (volEl) {
      const w = volEl.clientWidth;
      const h = volEl.clientHeight;
      if (w > 0 && h > 0) this.volumeChart.resize(w, h);
    }
  }

  getOverlayCanvas(): HTMLCanvasElement | null {
    return this.overlayCanvas;
  }

  timeToX(tMs: number): number | null {
    const coord = this.mainChart.timeScale().timeToCoordinate(toUtcSeconds(tMs));
    if (coord == null) return null;
    return coord * devicePixelRatio;
  }

  priceToY(price: number): number | null {
    const coord = this.mainSeries.priceToCoordinate(price);
    if (coord == null) return null;
    return coord * devicePixelRatio;
  }

  xToTime(x: number): number | null {
    const t = this.mainChart.timeScale().coordinateToTime(x / devicePixelRatio);
    if (t == null) return null;
    return Number(t) * 1000;
  }

  yToPrice(y: number): number | null {
    const p = this.mainSeries.coordinateToPrice(y / devicePixelRatio);
    return p ?? null;
  }

  destroy(): void {
    this.mainChart.remove();
    this.volumeChart.remove();
    this.overlayCanvas?.remove();
  }

  private initOverlay(parent: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    parent.style.position = 'relative';
    parent.appendChild(canvas);
    this.overlayCanvas = canvas;
    this.bus.subscribeTransform(() => this.syncOverlaySize());
  }

  private syncOverlaySize() {
    if (!this.overlayCanvas?.parentElement) return;
    const rect = this.overlayCanvas.parentElement.getBoundingClientRect();
    this.overlayCanvas.width = rect.width * devicePixelRatio;
    this.overlayCanvas.height = rect.height * devicePixelRatio;
  }

  private layoutForTheme(dark: boolean) {
    return {
      background: { type: ColorType.Solid, color: dark ? '#0d1117' : '#ffffff' },
      textColor: dark ? '#e6edf3' : '#24292f',
    };
  }
}