import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Bar } from '@tradview/data';
import { lodDecimateBars } from '@tradview/series';
import { gridOptions } from './chart-grid.js';
import type { IndicatorConfig } from '@tradview/indicators';

import { IndicatorPaneStack, maOverlayLine, volMaOverlayLine } from './indicator-panes.js';
import { attachPaneResizer } from './pane-resize.js';
import { TimeScaleBus } from './time-scale-bus.js';

export type ScaleMode = 'linear' | 'log';

export interface CrosshairPayload {
  time: number;
  price: number | null;
  ohlcv: { o: number; h: number; l: number; c: number; v?: number } | null;
}

export interface PaneOrchestratorOptions {
  container: HTMLElement;
  indicatorRoot?: HTMLElement;
  theme?: 'dark' | 'light';
  scaleMode?: ScaleMode;
  maxRenderPoints?: number;
  /** Show chart grid lines (default false). */
  showGrid?: boolean;
  /** null = no MA overlays and no MACD/RSI/KDJ panes. */
  indicatorConfig?: IndicatorConfig | null;
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
  private readonly mainSeries: ISeriesApi<'Candlestick'>;
  private readonly volumeSeries: ISeriesApi<'Histogram'>;
  private readonly maSeries: ISeriesApi<'Line'>;
  private readonly volMaSeries: ISeriesApi<'Line'>;
  private readonly indicatorRoot?: HTMLElement;
  private indicators: IndicatorPaneStack | null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private dark = true;
  private showGrid = false;
  private readonly maxRenderPoints: number;
  private barByTime = new Map<number, Bar>();
  private didInitialFit = false;
  private indicatorConfig: IndicatorConfig | null = null;

  constructor(opts: PaneOrchestratorOptions) {
    this.maxRenderPoints = opts.maxRenderPoints ?? 4000;
    this.dark = opts.theme !== 'light';
    this.showGrid = opts.showGrid ?? false;
    const layout = this.layoutForTheme(this.dark);
    const grid = gridOptions(this.showGrid, this.dark);

    const mainEl = document.createElement('div');
    mainEl.style.cssText = 'flex:7;min-height:120px;width:100%;position:relative;';
    const volEl = document.createElement('div');
    volEl.style.cssText = 'flex:2;min-height:64px;width:100%;position:relative;';

    opts.container.style.cssText =
      'display:flex;flex-direction:column;height:100%;width:100%;min-height:240px;overflow:hidden;';
    opts.container.append(mainEl, volEl);
    attachPaneResizer(mainEl, volEl, { storageKey: 'tradview:pane:main-volume' });

    this.mainChart = createChart(mainEl, { layout, grid, autoSize: true });
    this.volumeChart = createChart(volEl, {
      layout,
      grid,
      autoSize: true,
      rightPriceScale: { scaleMargins: { top: 0.8, bottom: 0 } },
    });

    if (opts.scaleMode === 'log') {
      this.mainChart.priceScale('right').applyOptions({ mode: 1 });
    }

    this.mainSeries = this.mainChart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    this.maSeries = this.mainChart.addSeries(LineSeries, {
      color: '#f0b429',
      lineWidth: 1,
      title: 'MA20',
    });
    this.volumeSeries = this.volumeChart.addSeries(HistogramSeries, {
      color: '#26a69a55',
      priceFormat: { type: 'volume' },
    });
    this.volMaSeries = this.volumeChart.addSeries(LineSeries, {
      color: '#58a6ff',
      lineWidth: 1,
      title: 'VolMA5',
    });

    this.bus.register(this.mainChart);
    this.bus.register(this.volumeChart);

    this.indicatorRoot = opts.indicatorRoot;
    this.indicatorConfig = opts.indicatorConfig ?? null;
    this.indicators = this.createIndicatorStack();

    this.initOverlay(mainEl);
  }

  setTheme(theme: 'dark' | 'light'): void {
    this.dark = theme === 'dark';
    const layout = this.layoutForTheme(this.dark);
    const grid = gridOptions(this.showGrid, this.dark);
    this.mainChart.applyOptions({ layout, grid });
    this.volumeChart.applyOptions({ layout, grid });
    this.indicators?.setTheme(theme);
  }

  setIndicatorConfig(config: IndicatorConfig | null): void {
    this.indicatorConfig = config;
    if (!config) {
      this.indicators = null;
      this.maSeries.setData([]);
      this.volMaSeries.setData([]);
      return;
    }
    if (!this.indicators) this.indicators = this.createIndicatorStack();
    const bars = [...this.barByTime.values()].sort((a, b) => a.t - b.t);
    this.indicators?.setConfig(config);
    if (bars.length > 0) {
      this.maSeries.setData(maOverlayLine(bars, config.maPeriod, config.source));
      this.volMaSeries.setData(volMaOverlayLine(bars, config.volMaPeriod));
      this.indicators?.setBars(bars);
    }
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    const grid = gridOptions(show, this.dark);
    this.mainChart.applyOptions({ grid });
    this.volumeChart.applyOptions({ grid });
    this.indicators?.setShowGrid(show);
  }

  setBars(bars: Bar[], gaps?: number[]): void {
    const renderBars = lodDecimateBars(bars, this.maxRenderPoints);
    this.barByTime = new Map(renderBars.map((b) => [b.t, b]));

    const candles: CandlestickData[] = [];
    const vols: HistogramData<UTCTimestamp>[] = [];
    const gapSet = new Set(gaps ?? []);
    const seenTimes = new Set<number>();

    for (let i = 0; i < renderBars.length; i++) {
      const b = renderBars[i]!;
      const time = toUtcSeconds(b.t);
      if (seenTimes.has(time)) continue;
      seenTimes.add(time);
      if (i > 0 && gapSet.has(b.t)) {
        // whitespace: skip connecting — LWC uses sparse times
      }
      candles.push(barToCandle(b));
      vols.push(barToVolume(b));
    }

    this.mainSeries.setData(candles);
    this.volumeSeries.setData(vols);
    if (this.indicatorConfig) {
      this.maSeries.setData(
        maOverlayLine(renderBars, this.indicatorConfig.maPeriod, this.indicatorConfig.source),
      );
      this.volMaSeries.setData(volMaOverlayLine(renderBars, this.indicatorConfig.volMaPeriod));
      this.indicators?.setBars(renderBars);
    } else {
      this.maSeries.setData([]);
      this.volMaSeries.setData([]);
    }

    if (renderBars.length > 0) {
      this.syncChartSize();
      if (!this.didInitialFit) {
        this.mainChart.timeScale().fitContent();
        this.volumeChart.timeScale().fitContent();
        this.indicators?.fitContent();
        this.didInitialFit = true;
      }
    }
  }

  subscribeCrosshair(listener: (payload: CrosshairPayload | null) => void): () => void {
    const handler = (param: MouseEventParams<Time>) => {
      if (param.time == null || !param.point) {
        listener(null);
        return;
      }
      const tMs = typeof param.time === 'number' ? param.time * 1000 : null;
      if (tMs == null) {
        listener(null);
        return;
      }
      const price = this.mainSeries.coordinateToPrice(param.point.y) ?? null;
      const bar = this.barByTime.get(tMs) ?? this.findNearestBar(tMs);
      listener({
        time: tMs,
        price,
        ohlcv: bar
          ? { o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }
          : null,
      });
    };
    this.mainChart.subscribeCrosshairMove(handler);
    return () => this.mainChart.unsubscribeCrosshairMove(handler);
  }

  private findNearestBar(tMs: number): Bar | null {
    let best: Bar | null = null;
    let bestDt = Infinity;
    for (const b of this.barByTime.values()) {
      const dt = Math.abs(b.t - tMs);
      if (dt < bestDt) {
        bestDt = dt;
        best = b;
      }
    }
    return bestDt < 120_000 ? best : null;
  }

  private createIndicatorStack(): IndicatorPaneStack | null {
    if (!this.indicatorRoot || !this.indicatorConfig) return null;
    return new IndicatorPaneStack(this.indicatorRoot, this.bus, {
      theme: this.dark ? 'dark' : 'light',
      showGrid: this.showGrid,
      config: this.indicatorConfig,
    });
  }

  resetViewState(): void {
    this.didInitialFit = false;
    this.bus.visibleFromMs = 0;
    this.bus.visibleToMs = 0;
  }

  /** Clear series while symbol/interval data reloads (avoids overlapping candles). */
  clearBars(): void {
    this.barByTime = new Map();
    this.mainSeries.setData([]);
    this.maSeries.setData([]);
    this.volumeSeries.setData([]);
    this.volMaSeries.setData([]);
    this.indicators?.clearBars();
  }

  fitContent(): void {
    this.mainChart.timeScale().fitContent();
    this.volumeChart.timeScale().fitContent();
    this.indicators?.fitContent();
    this.didInitialFit = true;
  }

  scrollToRealtime(): void {
    this.mainChart.timeScale().scrollToRealTime();
    this.volumeChart.timeScale().scrollToRealTime();
    this.indicators?.scrollToRealtime();
  }

  setLogScale(enabled: boolean): void {
    this.mainChart.priceScale('right').applyOptions({ mode: enabled ? 1 : 0 });
  }

  resize(): void {
    this.syncChartSize();
    this.syncOverlaySize();
    this.indicators?.resize();
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
    this.indicators?.destroy();
    this.overlayCanvas?.remove();
  }

  private initOverlay(parent: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    parent.style.position = 'relative';
    parent.appendChild(canvas);
    this.overlayCanvas = canvas;
    this.syncOverlaySize();
    this.bus.subscribeTransform(() => {
      this.syncOverlaySize();
    });
  }

  /** Let drawing overlay receive clicks; cursor mode keeps pan/zoom on LWC. */
  setOverlayPointerEvents(mode: 'auto' | 'none'): void {
    if (this.overlayCanvas) this.overlayCanvas.style.pointerEvents = mode;
  }

  private syncOverlaySize() {
    if (!this.overlayCanvas?.parentElement) return;
    const parent = this.overlayCanvas.parentElement;
    if (parent.lastElementChild !== this.overlayCanvas) {
      parent.appendChild(this.overlayCanvas);
    }
    const rect = parent.getBoundingClientRect();
    this.overlayCanvas.width = rect.width * devicePixelRatio;
    this.overlayCanvas.height = rect.height * devicePixelRatio;
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

  private layoutForTheme(dark: boolean) {
    return {
      background: { type: ColorType.Solid, color: dark ? '#0d1117' : '#ffffff' },
      textColor: dark ? '#e6edf3' : '#24292f',
    };
  }
}