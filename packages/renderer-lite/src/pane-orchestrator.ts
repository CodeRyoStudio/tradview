import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type HistogramData,
  type WhitespaceData,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { intervalMs, type Bar, type Interval } from '@coderyo/data';
import { compensatePrependOnRegistry } from './time-scale-prepend.js';
import { lodDecimateBars } from '@coderyo/series';
import { gridOptions } from './chart-grid.js';
import {
  DEFAULT_INDICATOR_CONFIG,
  hasVisibleIndicatorPanes,
  type IndicatorConfig,
} from '@coderyo/indicators';

import {
  IndicatorPaneStack,
  bollOverlayLines,
  emaOverlayLine,
  maOverlayLine,
  volMaOverlayLine,
} from './indicator-panes.js';
import { attachPaneResizer } from './pane-resize.js';
import { type ChartVisibleRange } from './time-scale-bus.js';
import {
  type PaneSyncGroupPatch,
  type PaneSyncKey,
  TimeScaleBusRegistry,
} from './time-scale-bus-registry.js';
import { resolveBarSpacingForInterval } from './viewport-fit.js';

export type { ChartVisibleRange };
import { BarSmoothAnimator } from './bar-smooth-animator.js';

export type ScaleMode = 'linear' | 'log';

export interface CrosshairPayload {
  time: number;
  price: number | null;
  ohlcv: { o: number; h: number; l: number; c: number; v?: number } | null;
}

export interface PinePlotLine {
  title: string;
  color?: string;
  values: (number | null)[];
}

export type ChartPaneId = 'main' | 'volume' | 'indicator';

export function isLayeredPaneMount(opts: Pick<PaneOrchestratorOptions, 'volumeMount'>): boolean {
  return !!opts.volumeMount;
}

export function shouldResizeChartPane(
  focus: Set<ChartPaneId> | null,
  pane: ChartPaneId,
): boolean {
  if (!focus) return true;
  return focus.has(pane);
}

export interface PaneOrchestratorOptions {
  /** Main candlestick mount (required). */
  container: HTMLElement;
  /**
   * P2: separate volume layer host; when set, no flex column in container.
   * Mount order: create empty `chartMain` + `chartVolume` nodes first, pass to compositor widgets,
   * then `createChart(chartMain, { volumeMount: chartVolume })` so LWC mounts after layer frames apply.
   */
  volumeMount?: HTMLElement;
  indicatorRoot?: HTMLElement;
  theme?: 'dark' | 'light';
  scaleMode?: ScaleMode;
  maxRenderPoints?: number;
  /** Show chart grid lines (default false). */
  showGrid?: boolean;
  /** null = no MA overlays and no MACD/RSI/KDJ panes. */
  indicatorConfig?: IndicatorConfig | null;
  /** Pine-lite plot lines on main chart (when pineEnabled). */
  pinePlots?: PinePlotLine[] | null;
  /** Animate last candle + price line toward new OHLC (~150ms). */
  smoothPriceUpdate?: boolean;
  smoothPriceDurationMs?: number;
  onIndicatorConfigChange?: (config: IndicatorConfig) => void;
  /** When true (default), set bar spacing on interval reload — does not change visible bar count. */
  autoBarSpacingOnInterval?: boolean;
  barSpacingByInterval?: Partial<Record<Interval, number>>;
  /**
   * When false, do not listen for `tradview:pane-resize` (ChartController owns that path).
   * @default true for standalone orchestrator use; ChartController passes false.
   */
  listenPaneResizeEvents?: boolean;
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
  readonly busRegistry = new TimeScaleBusRegistry();
  /** Active sync group bus (last-focused pane); used by ChartController viewport APIs. */
  get bus() {
    return this.busRegistry.activeBus;
  }
  private readonly layeredPanes: boolean;
  private readonly mainEl: HTMLElement;
  private readonly volWrap: HTMLElement;
  private detachMainVolResizer: () => void = () => {};
  private resizeFocusPanes: Set<ChartPaneId> | null = null;
  private readonly listenPaneResizeEvents: boolean;
  private readonly mainChart: IChartApi;
  private readonly volumeChart: IChartApi;
  private readonly mainSeries: ISeriesApi<'Candlestick'>;
  private readonly volumeSeries: ISeriesApi<'Histogram'>;
  private readonly maSeries: ISeriesApi<'Line'>;
  private readonly emaSeries: ISeriesApi<'Line'>;
  private readonly bollUpper: ISeriesApi<'Line'>;
  private readonly bollMiddle: ISeriesApi<'Line'>;
  private readonly bollLower: ISeriesApi<'Line'>;
  private readonly volMaSeries: ISeriesApi<'Line'>;
  private readonly indicatorRoot?: HTMLElement;
  private indicators: IndicatorPaneStack | null;
  private pinePlotSeries: ISeriesApi<'Line'>[] = [];
  private pinePlots: PinePlotLine[] | null = null;
  private overlayCanvas: HTMLCanvasElement | null = null;
  private dark = true;
  private showGrid = false;
  private readonly maxRenderPoints: number;
  private barByTime = new Map<number, Bar>();
  private barTimesOrdered: number[] = [];
  private didInitialFit = false;
  private skipNextInitialFit = false;
  /** setBars ran before the pane had layout size; refit on first real resize. */
  private pendingViewportFit = false;
  private pendingViewportBars: Bar[] | null = null;
  private indicatorConfig: IndicatorConfig | null = null;
  private onIndicatorConfigChange?: (config: IndicatorConfig) => void;
  private currentInterval: Interval = '1h';
  private autoBarSpacingOnInterval = true;
  private barSpacingByInterval?: Partial<Record<Interval, number>>;
  private priceLine: IPriceLine | null = null;
  private barAnimator: BarSmoothAnimator | null = null;
  private smoothPriceDurationMs = 150;

  constructor(opts: PaneOrchestratorOptions) {
    this.maxRenderPoints = opts.maxRenderPoints ?? 4000;
    this.listenPaneResizeEvents = opts.listenPaneResizeEvents !== false;
    this.dark = opts.theme !== 'light';
    this.showGrid = opts.showGrid ?? false;
    const layout = this.layoutForTheme(this.dark);
    const grid = gridOptions(this.showGrid, this.dark);

    this.layeredPanes = !!opts.volumeMount;
    const volEl = document.createElement('div');
    volEl.style.cssText = 'width:100%;height:100%;min-height:0;position:relative;';

    if (this.layeredPanes) {
      this.mainEl = opts.container;
      this.mainEl.style.cssText =
        'width:100%;height:100%;min-height:80px;position:relative;overflow:hidden;';
      this.volWrap = opts.volumeMount!;
      this.volWrap.dataset.paneId = 'volume';
      this.volWrap.className = 'tv-volume-pane tv-volume-pane--layered';
      this.volWrap.replaceChildren();
      this.volWrap.style.cssText =
        'width:100%;height:100%;min-height:48px;position:relative;overflow:hidden;box-sizing:border-box;';
      const volTag = document.createElement('span');
      volTag.textContent = 'Volume';
      volTag.style.cssText =
        'position:absolute;left:6px;top:4px;z-index:2;font-size:10px;color:#8b949e;pointer-events:none;';
      const volClose = document.createElement('button');
      volClose.type = 'button';
      volClose.textContent = '×';
      volClose.title = '關閉成交量';
      volClose.setAttribute('aria-label', 'Close volume');
      volClose.style.cssText =
        'position:absolute;right:6px;top:4px;z-index:3;width:22px;height:22px;padding:0;border:1px solid #30363d;border-radius:4px;background:#21262d;color:#8b949e;cursor:pointer;font-size:14px;line-height:1;';
      volClose.onclick = () => this.closeVolumePane();
      this.volWrap.append(volTag, volClose, volEl);
    } else {
      this.mainEl = document.createElement('div');
      this.mainEl.style.cssText = 'flex:7;min-height:120px;width:100%;position:relative;';
      volEl.style.cssText = 'flex:1;min-height:0;width:100%;height:100%;position:relative;';

      this.volWrap = document.createElement('div');
      this.volWrap.dataset.paneId = 'volume';
      this.volWrap.className = 'tv-volume-pane';
      this.volWrap.style.cssText =
        'flex:2;min-height:48px;width:100%;position:relative;display:flex;flex-direction:column;border-top:1px solid #30363d;';
      const volTag = document.createElement('span');
      volTag.textContent = 'Volume';
      volTag.style.cssText =
        'position:absolute;left:6px;top:4px;z-index:2;font-size:10px;color:#8b949e;pointer-events:none;';
      const volClose = document.createElement('button');
      volClose.type = 'button';
      volClose.textContent = '×';
      volClose.title = '關閉成交量';
      volClose.setAttribute('aria-label', 'Close volume');
      volClose.style.cssText =
        'position:absolute;right:6px;top:4px;z-index:3;width:22px;height:22px;padding:0;border:1px solid #30363d;border-radius:4px;background:#21262d;color:#8b949e;cursor:pointer;font-size:14px;line-height:1;';
      volClose.onclick = () => this.closeVolumePane();
      this.volWrap.append(volTag, volClose, volEl);

      opts.container.style.cssText =
        'display:flex;flex-direction:column;height:100%;width:100%;min-height:200px;overflow:hidden;';
      opts.container.append(this.mainEl, this.volWrap);
      this.rebuildMainVolumeResizer();
    }

    this.mainChart = createChart(this.mainEl, { layout, grid, autoSize: true });
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
      title: 'MA',
    });
    this.emaSeries = this.mainChart.addSeries(LineSeries, {
      color: '#7ee787',
      lineWidth: 1,
      title: 'EMA',
      visible: false,
    });
    this.bollUpper = this.mainChart.addSeries(LineSeries, {
      color: '#8b949e',
      lineWidth: 1,
      title: 'BOLL↑',
      visible: false,
    });
    this.bollMiddle = this.mainChart.addSeries(LineSeries, {
      color: '#8b949e88',
      lineWidth: 1,
      lineStyle: 2,
      title: 'BOLL',
      visible: false,
    });
    this.bollLower = this.mainChart.addSeries(LineSeries, {
      color: '#8b949e',
      lineWidth: 1,
      title: 'BOLL↓',
      visible: false,
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

    this.busRegistry.getBusForPane('main').register(this.mainChart);
    this.busRegistry.getBusForPane('volume').register(this.volumeChart);

    this.indicatorRoot = opts.indicatorRoot;
    this.indicatorConfig = opts.indicatorConfig ?? null;
    this.onIndicatorConfigChange = opts.onIndicatorConfigChange;
    this.autoBarSpacingOnInterval = opts.autoBarSpacingOnInterval ?? true;
    this.barSpacingByInterval = opts.barSpacingByInterval;
    this.pinePlots = opts.pinePlots ?? null;
    this.indicators = this.createIndicatorStack();

    this.initOverlay(this.mainEl);
    this.setSmoothPriceUpdate(opts.smoothPriceUpdate ?? false, opts.smoothPriceDurationMs);
    this.applyVolumeVisibility();
    if (opts.listenPaneResizeEvents !== false) {
      window.addEventListener('tradview:pane-resize', this.onPaneResize);
    }
  }

  private readonly onPaneResize = () => {
    this.resize();
  };

  setSmoothPriceUpdate(enabled: boolean, durationMs = 150): void {
    this.smoothPriceDurationMs = durationMs;
    if (enabled) {
      if (!this.barAnimator) {
        this.barAnimator = new BarSmoothAnimator(durationMs, (bar) => this.applyLastBarToSeries(bar));
      } else {
        this.barAnimator.setDuration(durationMs);
      }
      return;
    }
    this.barAnimator?.cancel();
    this.barAnimator = null;
    if (this.priceLine) {
      this.mainSeries.removePriceLine(this.priceLine);
      this.priceLine = null;
    }
  }

  /** Update the last candle (and price line); optional smooth interpolation. */
  updateLastBar(target: Bar, opts?: { smooth?: boolean; durationMs?: number }): void {
    const prev = this.barByTime.get(target.t);
    const smooth = opts?.smooth ?? !!this.barAnimator;
    const duration = opts?.durationMs ?? this.smoothPriceDurationMs;
    if (smooth && this.barAnimator) {
      this.barAnimator.setDuration(duration);
      this.barAnimator.animateTo(target, prev ?? target);
      return;
    }
    this.barAnimator?.cancel();
    this.applyLastBarToSeries(target);
  }

  private applyLastBarToSeries(bar: Bar): void {
    this.barByTime.set(bar.t, bar);
    this.mainSeries.update(barToCandle(bar));
    if (this.isVolumeVisible()) {
      this.volumeSeries.update(barToVolume(bar));
    }
    this.ensurePriceLine(bar.c);
    if (this.indicatorConfig) {
      const bars = [...this.barByTime.values()].sort((a, b) => a.t - b.t);
      this.applyMainOverlays(bars);
      if (hasVisibleIndicatorPanes(this.indicatorConfig)) {
        this.indicators?.setBars(bars);
      }
    }
  }

  private ensurePriceLine(price: number): void {
    if (!this.priceLine) {
      this.priceLine = this.mainSeries.createPriceLine({
        price,
        color: '#58a6ff',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '',
      });
    } else {
      this.priceLine.applyOptions({ price });
    }
  }

  setIntervalContext(interval: Interval): void {
    this.currentInterval = interval;
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
      this.teardownIndicatorStack();
      this.maSeries.setData([]);
      this.emaSeries.setData([]);
      this.bollUpper.setData([]);
      this.bollMiddle.setData([]);
      this.bollLower.setData([]);
      this.volMaSeries.setData([]);
      this.volumeSeries.setData([]);
      this.emaSeries.applyOptions({ visible: false });
      this.bollUpper.applyOptions({ visible: false });
      this.bollMiddle.applyOptions({ visible: false });
      this.bollLower.applyOptions({ visible: false });
      this.applyVolumeVisibility();
      return;
    }
    if (!this.indicators) this.indicators = this.createIndicatorStack();
    const bars = [...this.barByTime.values()].sort((a, b) => a.t - b.t);
    this.indicators?.setConfig(config);
    if (bars.length > 0) {
      this.applyMainOverlays(bars);
      if (hasVisibleIndicatorPanes(config)) {
        this.indicators?.setBars(bars);
      }
    }
    this.applyVolumeVisibility();
  }

  private isVolumeVisible(): boolean {
    return this.indicatorConfig?.showVolume ?? true;
  }

  private closeVolumePane(): void {
    if (!this.indicatorConfig) {
      this.indicatorConfig = { ...DEFAULT_INDICATOR_CONFIG, showVolume: false };
    } else {
      this.indicatorConfig = { ...this.indicatorConfig, showVolume: false };
    }
    this.applyVolumeVisibility();
    this.onIndicatorConfigChange?.(this.indicatorConfig);
  }

  private applyVolumeVisibility(): void {
    const show = this.isVolumeVisible();
    this.volWrap.style.display = show ? '' : 'none';
    this.rebuildMainVolumeResizer();
    if (!show) {
      this.volumeSeries.setData([]);
      this.volMaSeries.setData([]);
    }
    this.syncChartSize();
  }

  /** Assign per-pane sync group ids (`''` / omit = independent). Re-registers LWC charts on group change. */
  setPaneSyncGroups(patch: PaneSyncGroupPatch): void {
    const apply = (pane: PaneSyncKey, groupId: string | null | undefined) => {
      const prevKey = this.busRegistry.setPaneSyncGroup(pane, groupId);
      const nextKey = this.busRegistry.getBusKeyForPane(pane);
      if (pane === 'main') {
        this.busRegistry.moveChart(this.mainChart, prevKey, nextKey);
      } else if (pane === 'volume') {
        this.busRegistry.moveChart(this.volumeChart, prevKey, nextKey);
      } else if (this.indicators) {
        for (const chart of this.indicators.getCharts()) {
          this.busRegistry.moveChart(chart, prevKey, nextKey);
        }
      }
    };
    if (patch.main !== undefined) apply('main', patch.main);
    if (patch.volume !== undefined) apply('volume', patch.volume);
    if (patch.indicator !== undefined) apply('indicator', patch.indicator);
  }

  setActiveSyncPane(pane: ChartPaneId): void {
    const key: PaneSyncKey =
      pane === 'volume' ? 'volume' : pane === 'indicator' ? 'indicator' : 'main';
    this.busRegistry.setActivePane(key);
  }

  /** P2: when set, only these panes get LWC resize (panes in the same sync group still share TimeScaleBus). */
  setResizeFocusPanes(panes: ChartPaneId[] | null): void {
    this.resizeFocusPanes = panes?.length ? new Set(panes) : null;
    this.resize();
  }

  /** Current resize focus (null = all panes). @internal — not part of public package API. */
  getResizeFocusPanes(): ChartPaneId[] | null {
    return this.resizeFocusPanes ? [...this.resizeFocusPanes] : null;
  }

  private shouldResizePane(pane: ChartPaneId): boolean {
    return shouldResizeChartPane(this.resizeFocusPanes, pane);
  }

  private rebuildMainVolumeResizer(): void {
    if (this.layeredPanes) return;
    this.detachMainVolResizer();
    const parent = this.mainEl.parentElement;
    parent
      ?.querySelectorAll(':scope > [data-pane-resizer]')
      .forEach((el) => el.remove());

    if (!this.isVolumeVisible()) {
      this.mainEl.style.flex = '1';
      return;
    }
    this.mainEl.style.flex = '';
    this.volWrap.style.flex = '';
    this.detachMainVolResizer = attachPaneResizer(this.mainEl, this.volWrap, {
      storageKey: 'tradview:pane:main-volume',
      minTopPx: 120,
      minBottomPx: 48,
    });
  }

  setPinePlots(plots: PinePlotLine[] | null): void {
    this.pinePlots = plots;
    const bars = [...this.barByTime.values()].sort((a, b) => a.t - b.t);
    this.syncPinePlotSeries(bars);
  }

  private teardownIndicatorStack(): void {
    this.indicators?.destroy();
    this.indicators = null;
  }

  private applyMainOverlays(bars: Bar[]): void {
    const cfg = this.indicatorConfig;
    if (!cfg) return;
    if (cfg.showMa) {
      this.maSeries.applyOptions({ visible: true, title: `MA${cfg.maPeriod}` });
      this.maSeries.setData(maOverlayLine(bars, cfg.maPeriod, cfg.source));
    } else {
      this.maSeries.applyOptions({ visible: false });
      this.maSeries.setData([]);
    }
    if (cfg.showVolMa) {
      this.volMaSeries.applyOptions({ visible: true });
      this.volMaSeries.setData(volMaOverlayLine(bars, cfg.volMaPeriod));
    } else {
      this.volMaSeries.applyOptions({ visible: false });
      this.volMaSeries.setData([]);
    }

    if (cfg.showEma) {
      this.emaSeries.applyOptions({ visible: true, title: `EMA${cfg.emaPeriod}` });
      this.emaSeries.setData(emaOverlayLine(bars, cfg.emaPeriod, cfg.source));
    } else {
      this.emaSeries.applyOptions({ visible: false });
      this.emaSeries.setData([]);
    }

    if (cfg.showBoll) {
      const bands = bollOverlayLines(bars, cfg.bollPeriod, cfg.bollMult, cfg.source);
      this.bollUpper.applyOptions({ visible: true });
      this.bollMiddle.applyOptions({ visible: true });
      this.bollLower.applyOptions({ visible: true });
      this.bollUpper.setData(bands.upper);
      this.bollMiddle.setData(bands.middle);
      this.bollLower.setData(bands.lower);
    } else {
      this.bollUpper.applyOptions({ visible: false });
      this.bollMiddle.applyOptions({ visible: false });
      this.bollLower.applyOptions({ visible: false });
      this.bollUpper.setData([]);
      this.bollMiddle.setData([]);
      this.bollLower.setData([]);
    }
    this.syncPinePlotSeries(bars);
  }

  private syncPinePlotSeries(bars: Bar[]): void {
    for (const s of this.pinePlotSeries) this.mainChart.removeSeries(s);
    this.pinePlotSeries = [];
    if (!this.pinePlots?.length || bars.length === 0) return;

    const palette = ['#58a6ff', '#d2a8ff', '#ff7b72', '#ffa657'];
    for (let i = 0; i < this.pinePlots.length; i++) {
      const plot = this.pinePlots[i]!;
      const series = this.mainChart.addSeries(LineSeries, {
        color: plot.color ?? palette[i % palette.length]!,
        lineWidth: 1,
        title: plot.title,
      });
      const out: { time: UTCTimestamp; value: number }[] = [];
      for (let j = 0; j < bars.length; j++) {
        const v = plot.values[j];
        if (v == null) continue;
        out.push({ time: toUtcSeconds(bars[j]!.t), value: v });
      }
      series.setData(out);
      this.pinePlotSeries.push(series);
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
    this.barTimesOrdered = renderBars.map((b) => b.t);

    const gapSet = new Set(gaps ?? []);
    const seenTimes = new Set<number>();
    type CandlePoint = CandlestickData | WhitespaceData<UTCTimestamp>;
    const candles: CandlePoint[] = [];
    const vols: HistogramData<UTCTimestamp>[] = [];

    for (let i = 0; i < renderBars.length; i++) {
      const b = renderBars[i]!;
      const time = toUtcSeconds(b.t);
      if (seenTimes.has(time)) continue;
      seenTimes.add(time);
      if (gapSet.has(b.t)) {
        candles.push({ time });
      }
      candles.push(barToCandle(b));
      vols.push(barToVolume(b));
    }

    this.mainSeries.setData(candles);
    if (this.isVolumeVisible()) {
      this.volumeSeries.setData(vols);
    } else {
      this.volumeSeries.setData([]);
    }
    if (this.indicatorConfig) {
      this.applyMainOverlays(renderBars);
      if (hasVisibleIndicatorPanes(this.indicatorConfig)) {
        this.indicators?.setBars(renderBars);
      }
    } else {
      this.maSeries.setData([]);
      this.emaSeries.setData([]);
      this.bollUpper.setData([]);
      this.bollMiddle.setData([]);
      this.bollLower.setData([]);
      this.volMaSeries.setData([]);
      this.syncPinePlotSeries(renderBars);
    }

    if (renderBars.length > 0) {
      this.syncChartSize();
      this.tryInitialViewportFit(renderBars);
      this.skipNextInitialFit = false;
    }
  }

  private mainPaneHasSize(): boolean {
    const el = this.mainChart.chartElement().parentElement;
    return (el?.clientWidth ?? 0) > 0 && (el?.clientHeight ?? 0) > 0;
  }

  private tryInitialViewportFit(renderBars: Bar[]): void {
    if (this.didInitialFit || this.skipNextInitialFit) return;
    if (!this.mainPaneHasSize()) {
      this.pendingViewportFit = true;
      this.pendingViewportBars = renderBars;
      return;
    }
    this.applyViewAfterDataReload(renderBars);
    this.didInitialFit = true;
    this.pendingViewportFit = false;
    this.pendingViewportBars = null;
  }

  private flushPendingViewportFit(): void {
    if (!this.pendingViewportFit || this.skipNextInitialFit || this.didInitialFit) return;
    const bars =
      this.pendingViewportBars ??
      [...this.barByTime.values()].sort((a, b) => a.t - b.t);
    if (bars.length === 0 || !this.mainPaneHasSize()) return;
    this.applyViewAfterDataReload(bars);
    this.didInitialFit = true;
    this.pendingViewportFit = false;
    this.pendingViewportBars = null;
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
    return new IndicatorPaneStack(this.indicatorRoot, this.busRegistry.getBusForPane('indicator'), {
      theme: this.dark ? 'dark' : 'light',
      showGrid: this.showGrid,
      config: this.indicatorConfig,
      onConfigChange: (config) => {
        this.indicatorConfig = config;
        this.onIndicatorConfigChange?.(config);
      },
    });
  }

  /** After symbol/interval reload: bar spacing for interval + show integrator-loaded span. */
  applyIntervalBarSpacing(interval?: Interval): void {
    if (!this.autoBarSpacingOnInterval) return;
    const iv = interval ?? this.currentInterval;
    const spacing = resolveBarSpacingForInterval(iv, this.barSpacingByInterval);
    this.busRegistry.forEachBus((_, bus) => bus.setBarSpacing(spacing));
  }

  setBarSpacingPolicy(opts: {
    autoBarSpacingOnInterval?: boolean;
    barSpacingByInterval?: Partial<Record<Interval, number>>;
  }): void {
    if (opts.autoBarSpacingOnInterval !== undefined) {
      this.autoBarSpacingOnInterval = opts.autoBarSpacingOnInterval;
    }
    if (opts.barSpacingByInterval !== undefined) {
      this.barSpacingByInterval = opts.barSpacingByInterval;
    }
  }

  /** Sync time scale to loaded bars (integrator history); adjust bar spacing only, not bar count. */
  private applyViewAfterDataReload(renderBars: Bar[]): void {
    if (this.autoBarSpacingOnInterval) {
      this.applyIntervalBarSpacing();
    } else {
      this.mainChart.timeScale().fitContent();
      if (this.isVolumeVisible()) this.volumeChart.timeScale().fitContent();
      this.indicators?.fitContent();
    }

    if (renderBars.length > 0) {
      const fromMs = renderBars[0]!.t;
      const toMs = renderBars[renderBars.length - 1]!.t + intervalMs(this.currentInterval);
      this.bus.setVisibleTimeRange({ fromMs, toMs });
    }
    this.scrollToRealtime();
  }

  resetViewState(): void {
    this.didInitialFit = false;
    this.skipNextInitialFit = false;
    this.pendingViewportFit = false;
    this.pendingViewportBars = null;
    this.busRegistry.forEachBus((_, bus) => {
      bus.visibleFromMs = 0;
      bus.visibleToMs = 0;
    });
  }

  /** Skip the next automatic fitContent after setBars (used by reloadHistory). */
  preserveViewportOnNextSetBars(): void {
    this.skipNextInitialFit = true;
    this.didInitialFit = true;
  }

  /**
   * DESIGN §10.4.1: after `mergeBars(..., prepend)` shift logical ranges on every sync bus
   * so canonical ms viewport and crosshair `t` stay stable.
   */
  compensatePrependForBuses(
    sortedTimesBefore: readonly number[],
    sortedTimesAfter: readonly number[],
    interval: Interval,
  ): void {
    compensatePrependOnRegistry({
      registry: this.busRegistry,
      sortedTimesBefore,
      sortedTimesAfter,
      intervalMs: intervalMs(interval),
      referenceChart: this.mainChart,
    });
  }

  getVisibleRange(): ChartVisibleRange | null {
    return this.bus.getVisibleRange();
  }

  getBarSpace(): number {
    return this.bus.getBarSpacing();
  }

  setBarSpace(px: number): void {
    this.bus.setBarSpacing(px);
  }

  setVisibleRange(range: ChartVisibleRange): void {
    this.bus.setVisibleTimeRange(range);
    this.didInitialFit = true;
  }

  scrollToTimestamp(tsMs: number, animationMs?: number): void {
    const time = toUtcSeconds(tsMs);
    const idx = this.mainChart.timeScale().timeToIndex(time, true);
    if (idx == null) {
      const nearest = this.findNearestBar(tsMs);
      if (nearest == null) return;
      const i = this.barTimesOrdered.indexOf(nearest.t);
      if (i < 0) return;
      this.busRegistry.getBusForPane('main').scrollToLogicalPosition(i, (animationMs ?? 0) > 0);
      return;
    }
    this.busRegistry.getBusForPane('main').scrollToLogicalPosition(idx as number, (animationMs ?? 0) > 0);
  }

  /** Clear series while symbol/interval data reloads (avoids overlapping candles). */
  clearBars(): void {
    this.barAnimator?.cancel();
    this.barByTime = new Map();
    this.barTimesOrdered = [];
    this.mainSeries.setData([]);
    this.maSeries.setData([]);
    this.volumeSeries.setData([]);
    this.volMaSeries.setData([]);
    this.indicators?.clearBars();
  }

  fitContent(): void {
    this.mainChart.timeScale().fitContent();
    if (this.isVolumeVisible()) this.volumeChart.timeScale().fitContent();
    this.indicators?.fitContent();
    this.didInitialFit = true;
  }

  scrollToRealtime(): void {
    this.mainChart.timeScale().scrollToRealTime();
    if (this.isVolumeVisible()) this.volumeChart.timeScale().scrollToRealTime();
    this.indicators?.scrollToRealtime();
  }

  setLogScale(enabled: boolean): void {
    this.mainChart.priceScale('right').applyOptions({ mode: enabled ? 1 : 0 });
  }

  resize(): void {
    this.syncChartSize();
    this.syncOverlaySize();
    if (this.shouldResizePane('indicator')) this.indicators?.resize();
    this.flushPendingViewportFit();
  }

  /**
   * Resize every LWC pane once for viewport fit; does **not** change {@link resizeFocusPanes}.
   * @internal Used by ChartController data refresh paths.
   */
  resizeAllPanes(): void {
    this.syncChartSize({ allPanes: true });
    this.syncOverlaySize();
    this.indicators?.resize();
    this.flushPendingViewportFit();
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
    if (this.listenPaneResizeEvents) {
      window.removeEventListener('tradview:pane-resize', this.onPaneResize);
    }
    this.detachMainVolResizer();
    this.barAnimator?.cancel();
    if (this.priceLine) {
      this.mainSeries.removePriceLine(this.priceLine);
      this.priceLine = null;
    }
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
    this.busRegistry.forEachBus((_, bus) => {
      bus.subscribeTransform(() => {
        this.syncOverlaySize();
      });
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

  private syncChartSize(opts?: { allPanes?: boolean }): void {
    const all = opts?.allPanes === true;
    const mainEl = this.mainChart.chartElement().parentElement;
    const volEl = this.volumeChart.chartElement().parentElement;
    if (mainEl && (all || this.shouldResizePane('main'))) {
      const w = mainEl.clientWidth;
      const h = mainEl.clientHeight;
      if (w > 0 && h > 0) this.mainChart.resize(w, h);
    }
    if (this.isVolumeVisible() && volEl && (all || this.shouldResizePane('volume'))) {
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