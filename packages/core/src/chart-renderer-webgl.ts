import type { Bar } from '@coderyo/data';
import { intervalMs, type Interval } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG, type IndicatorConfig } from '@coderyo/indicators';
import {
  BarSmoothAnimator,
  computePrependSliceDeltaForViewport,
  type CrosshairPayload,
  type PinePlotLine,
} from '@coderyo/renderer-lite';
import { WebGLCrosshairOverlay } from './webgl-crosshair-overlay.js';
import { resolvePaneSyncGroupsFromLayers } from './resolve-pane-sync-groups.js';
import {
  priceRangeForBars,
  priceToY as mapPriceToY,
  yToPrice as mapYToPrice,
  type PriceRange,
  type PriceScaleMode,
} from '@coderyo/renderer-webgl';
import {
  WebGLPaneOrchestrator,
  barIndexForTimeMs,
  symbolFormatFromInfo,
  timeMsAtBarIndex,
  timeMsAtLogicalIndex,
  type PriceScaleOptions,
  type TimeScaleOptions,
  type WebGLPaneOrchestratorOptions,
} from '@coderyo/renderer-webgl';
import type { ChartPaneId } from '@coderyo/renderer-lite';
import type { ChartVisibleRange } from './ms-time-scale-bus.js';
import { MsTimeScaleBusRegistry } from './ms-time-scale-bus.js';
import type { LayerSyncInput } from './resolve-pane-sync-groups.js';
import type { PaneSyncGroupPatch } from './resolve-pane-sync-groups.js';

export interface WebGLChartRenderOptions extends Omit<WebGLPaneOrchestratorOptions, 'theme'> {
  /** P2: separate volume pane mount (layer compositor). */
  volumeMount?: HTMLElement;
  chartId?: string;
  showGrid?: boolean;
  drawingsLayer?: boolean;
  /** Fired after pan/zoom so workspace can fan out {@link ChartVisibleRange}. */
  onVisibleRangeChange?: (range: ChartVisibleRange) => void;
}

/**
 * WebGL render surface for {@link ChartController} (V2-R12 / Appendix A).
 */
export class WebGLChartRenderBackend {
  readonly busRegistry = new MsTimeScaleBusRegistry();
  private readonly orchestrator: WebGLPaneOrchestrator;
  private bars: Bar[] = [];
  private offBusTransform: (() => void) | null = null;

  private readonly crosshairListeners = new Set<(payload: CrosshairPayload | null) => void>();
  private programmaticCrosshair: CrosshairPayload | null = null;
  private logScaleEnabled = false;
  private showGrid = false;
  private syncingBusFromViewport = false;
  private smoothPriceUpdate = false;
  private smoothPriceDurationMs = 150;
  private barAnimator: BarSmoothAnimator | null = null;
  private readonly crosshairOverlay: WebGLCrosshairOverlay;
  private readonly onVisibleRangeChange?: (range: ChartVisibleRange) => void;
  constructor(
    private readonly container: HTMLElement,
    options: WebGLChartRenderOptions = {},
  ) {
    const drawingsEnabled = options.drawingsLayer ?? false;
    this.onVisibleRangeChange = options.onVisibleRangeChange;
    this.orchestrator = new WebGLPaneOrchestrator({
      ...options,
      debug: options.debug ?? false,
      onViewportChange: () => this.syncBusFromViewport(),
      drawings: drawingsEnabled
        ? {
            enabled: true,
            chartId: options.chartId ?? 'default',
          }
        : undefined,
    });
    this.showGrid = options.showGrid ?? false;
    this.orchestrator.mount(container);
    this.orchestrator.setShowGrid(this.showGrid);
    this.crosshairOverlay = new WebGLCrosshairOverlay(container);
    this.offBusTransform = this.busRegistry.getOrCreateBus('main').subscribeTransform(() => {
      this.syncBusFromViewport();
    });
  }

  mount(): void {
    /* mounted in constructor */
  }

  setBars(bars: readonly Bar[], gaps?: number[]): void {
    const hadBars = this.bars.length > 0;
    this.bars = bars as Bar[];
    this.orchestrator.setBars(this.bars, gaps);
    this.syncBusFromViewport();
    if (hadBars && this.bars.length === 0) {
      this.onBarsBecameEmpty();
    }
  }

  clearBars(): void {
    const hadBars = this.bars.length > 0;
    this.bars = [];
    this.orchestrator.setBars([]);
    if (hadBars) {
      this.onBarsBecameEmpty();
    }
  }

  resetViewState(): void {
    this.orchestrator.resetViewState();
  }

  resize(): void {
    this.orchestrator.render();
  }

  resizeAllPanes(): void {
    this.orchestrator.render();
  }

  destroy(): void {
    this.detachPointerCrosshair();
    this.offBusTransform?.();
    this.offBusTransform = null;
    this.barAnimator?.cancel();
    this.barAnimator = null;
    this.crosshairOverlay.destroy();
    this.orchestrator.destroy();
  }

  setIndicatorConfig(config: IndicatorConfig | null): void {
    this.orchestrator.setIndicatorConfig(config ?? DEFAULT_INDICATOR_CONFIG);
  }

  setDrawingTool(tool: import('@coderyo/drawings').DrawingTool): void {
    this.orchestrator.setDrawingTool(tool);
  }

  setIntervalContext(_interval: Interval): void {
    /* WebGL uses bar index viewport */
  }

  setTheme(_theme: 'dark' | 'light'): void {
    this.orchestrator.render();
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.orchestrator.setShowGrid(show);
  }

  setBarSpacingPolicy(_opts: {
    autoBarSpacingOnInterval?: boolean;
    barSpacingByInterval?: Partial<Record<Interval, number>>;
  }): void {
    /* spacing applied via setBarSpace */
  }

  setSmoothPriceUpdate(enabled: boolean, durationMs: number): void {
    this.smoothPriceUpdate = enabled;
    this.smoothPriceDurationMs = durationMs;
    if (!enabled) {
      this.barAnimator?.cancel();
      this.barAnimator = null;
      return;
    }
    if (!this.barAnimator) {
      this.barAnimator = new BarSmoothAnimator(durationMs, (frame) => {
        if (this.bars.length === 0) return;
        this.bars[this.bars.length - 1] = frame;
        this.orchestrator.setBars(this.bars);
      });
    } else {
      this.barAnimator.setDuration(durationMs);
    }
  }

  setPinePlots(plots: PinePlotLine[] | null): void {
    this.orchestrator.setPineOverlayLines(plots);
  }

  setResizeFocusPanes(_panes: ChartPaneId[] | null): void {
    this.orchestrator.render();
  }

  setActiveSyncPane(_pane: ChartPaneId): void {
    /* single main bus */
  }

  setPaneSyncGroups(patch: PaneSyncGroupPatch): void {
    this.orchestrator.setPaneSyncGroups(patch);
  }

  preserveViewportOnNextSetBars(): void {
    this.orchestrator.preserveViewportOnNextSetBars();
  }

  compensatePrependForBuses(
    sortedTimesBefore: readonly number[],
    sortedTimesAfter: readonly number[],
    interval: Interval,
  ): void {
    const range = this.busRegistry.getOrCreateBus('main').getVisibleRange();
    const vp = this.orchestrator.getViewport();
    if (!range || !vp || this.bars.length === 0) return;

    const delta = computePrependSliceDeltaForViewport({
      sortedTimesBefore,
      sortedTimesAfter,
      visibleFromMs: range.fromMs,
      visibleToMs: range.toMs,
      intervalMs: intervalMs(interval),
    });
    if (delta <= 0) return;

    vp.setVisibleRange(vp.visibleFrom + delta, vp.visibleTo + delta);
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  updateLastBar(
    bar: Bar,
    opts?: { animate?: boolean; smooth?: boolean; durationMs?: number },
  ): boolean {
    const smooth = opts?.smooth ?? opts?.animate ?? this.smoothPriceUpdate;
    if (this.bars.length === 0) {
      this.bars = [bar];
    } else if (smooth && this.barAnimator) {
      const prev = this.bars[this.bars.length - 1];
      this.barAnimator.setDuration(opts?.durationMs ?? this.smoothPriceDurationMs);
      this.barAnimator.animateTo(bar, prev);
      return true;
    } else {
      this.barAnimator?.cancel();
      this.bars[this.bars.length - 1] = bar;
    }
    this.orchestrator.setBars(this.bars);
    return true;
  }

  fitContent(): void {
    const vp = this.orchestrator.getViewport();
    if (!vp) return;
    const w = this.container.clientWidth || 800;
    vp.fitLatest(vp.plotWidthPx(w));
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  scrollToRealtime(): void {
    this.fitContent();
  }

  getVisibleRange(): ChartVisibleRange | null {
    return this.busRegistry.getOrCreateBus('main').getVisibleRange();
  }

  getBarSpace(): number {
    const vp = this.orchestrator.getViewport();
    return vp?.barSpacing ?? 8;
  }

  setBarSpace(px: number): void {
    const vp = this.orchestrator.getViewport();
    if (!vp) return;
    vp.barSpacing = px;
    this.busRegistry.getOrCreateBus('main').setBarSpacing(px);
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  setVisibleRange(range: ChartVisibleRange): void {
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return;
    const layout = this.getMainLogicalLayout();
    const fromBar = barIndexForTimeMs(this.bars, range.fromMs);
    const toBar = barIndexForTimeMs(this.bars, range.toMs);
    const fromIdx = layout ? layout.logicalIndexForBarIndex(fromBar) : fromBar;
    const toIdx = layout ? layout.logicalIndexForBarIndex(toBar) : toBar;
    vp.setVisibleRange(fromIdx, Math.max(fromIdx + 1, toIdx));
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  scrollToTimestamp(tsMs: number, _animationMs?: number): void {
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return;
    const layout = this.getMainLogicalLayout();
    const barIdx = barIndexForTimeMs(this.bars, tsMs);
    const idx = layout ? layout.logicalIndexForBarIndex(barIdx) : barIdx;
    const span = vp.visibleSpan;
    vp.setVisibleRange(Math.max(0, idx - span * 0.1), idx + span * 0.05);
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  setLogScale(enabled: boolean): void {
    this.logScaleEnabled = enabled;
    this.orchestrator.setLogScale(enabled);
  }

  setTimezone(timeZone: string): void {
    this.orchestrator.setTimezone(timeZone);
  }

  applyPriceScaleOptions(opts: Partial<PriceScaleOptions>): void {
    this.orchestrator.applyPriceScaleOptions(opts);
  }

  applyTimeScaleOptions(opts: Partial<TimeScaleOptions>): void {
    this.orchestrator.applyTimeScaleOptions(opts);
  }

  setSymbolPriceFormat(info: { priceScale?: number; minMove?: number } | null): void {
    this.orchestrator.setSymbolPriceFormat(symbolFormatFromInfo(info ?? undefined));
  }

  getScaleOverlayCanvas(): HTMLCanvasElement | null {
    return this.orchestrator.getScaleOverlayCanvas?.() ?? null;
  }

  getOverlayCanvas(): HTMLCanvasElement | null {
    return (
      this.orchestrator.getDrawingOverlayCanvas() ??
      this.container.querySelector('canvas')
    );
  }

  setOverlayPointerEvents(_mode: 'none' | 'auto'): void {
    /* drawing layer manages pointer events */
  }

  priceToY(price: number): number | null {
    const metrics = this.orchestrator.getMainPaneLayoutMetrics();
    if (!metrics) return null;
    const range = this.visiblePriceRange();
    if (!range) return null;
    return mapPriceToY(price, range, 0, metrics.mainPaneHeight, this.priceScaleMode());
  }

  timeToX(tMs: number): number | null {
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return null;
    const w = this.container.clientWidth || 800;
    const plotW = vp.plotWidthPx(w);
    const layout = this.getMainLogicalLayout();
    const barIdx = barIndexForTimeMs(this.bars, tMs);
    const idx = layout ? layout.logicalIndexForBarIndex(barIdx) : barIdx;
    return vp.plotXForBarIndex(idx, plotW) * (globalThis.devicePixelRatio ?? 1);
  }

  xToTime(x: number): number | null {
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return null;
    const w = this.container.clientWidth || 800;
    const plotW = vp.plotWidthPx(w);
    const dpr = globalThis.devicePixelRatio ?? 1;
    const idx = vp.barIndexAtPlotX(x / dpr, plotW);
    const layout = this.getMainLogicalLayout();
    return layout
      ? timeMsAtLogicalIndex(this.bars, layout, idx)
      : timeMsAtBarIndex(this.bars, idx);
  }

  yToPrice(y: number): number | null {
    const metrics = this.orchestrator.getMainPaneLayoutMetrics();
    if (!metrics) return null;
    const range = this.visiblePriceRange();
    if (!range) return null;
    return mapYToPrice(y, range, 0, metrics.mainPaneHeight, this.priceScaleMode());
  }

  /** Programmatic crosshair (workspace link sync; DESIGN §4.6). */
  setCrosshair(opts: { timeMs: number; price?: number | null }): void {
    const bar = this.bars.find((b) => b.t === opts.timeMs) ?? this.nearestBar(opts.timeMs);
    const price =
      opts.price ??
      (bar ? bar.c : null) ??
      this.yToPrice(this.orchestrator.getMainPaneLayoutMetrics()?.mainPaneHeight ?? 0);
    this.programmaticCrosshair = {
      time: opts.timeMs,
      price,
      ohlcv: bar
        ? { o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }
        : null,
    };
    this.notifyCrosshairListeners(this.programmaticCrosshair);
    this.updateCrosshairVisual(this.programmaticCrosshair);
  }

  clearCrosshair(): void {
    this.programmaticCrosshair = null;
    this.crosshairActive = false;
    this.crosshairOverlay.hide();
    this.orchestrator.setCrosshairReadout?.(null, null);
    this.notifyCrosshairListeners(null);
  }

  subscribeCrosshair(handler: (payload: unknown) => void): () => void {
    const listener = handler as (payload: CrosshairPayload | null) => void;
    this.crosshairListeners.add(listener);
    if (this.crosshairListeners.size === 1) {
      this.attachPointerCrosshair();
    }
    return () => {
      this.crosshairListeners.delete(listener);
      if (this.crosshairListeners.size === 0) {
        this.detachPointerCrosshair();
      }
    };
  }

  /** Emit crosshair clear when bar series transitions to empty (reload), not on every move. */
  private onBarsBecameEmpty(): void {
    this.programmaticCrosshair = null;
    this.crosshairActive = false;
    this.crosshairOverlay.hide();
    this.orchestrator.setCrosshairReadout?.(null, null);
    this.notifyCrosshairListeners(null);
  }

  private pointerMove: ((e: PointerEvent) => void) | null = null;
  private pointerLeave: (() => void) | null = null;
  private crosshairActive = false;

  private attachPointerCrosshair(): void {
    const dpr = globalThis.devicePixelRatio ?? 1;
    const emitClear = (): void => {
      if (!this.crosshairActive && !this.programmaticCrosshair) return;
      this.crosshairActive = false;
      this.programmaticCrosshair = null;
      this.crosshairOverlay.hide();
      this.orchestrator.setCrosshairReadout?.(null, null);
      this.notifyCrosshairListeners(null);
    };
    this.pointerMove = (e: PointerEvent) => {
      if (this.bars.length === 0) return;
      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      const time = this.xToTime(x);
      if (time == null) {
        emitClear();
        return;
      }
      const price = this.yToPrice(y);
      const bar = this.bars.find((b) => b.t === time) ?? this.nearestBar(time);
      this.crosshairActive = true;
      this.programmaticCrosshair = {
        time,
        price,
        ohlcv: bar
          ? { o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }
          : null,
      };
      this.notifyCrosshairListeners(this.programmaticCrosshair);
      this.updateCrosshairVisual(this.programmaticCrosshair);
    };
    this.pointerLeave = () => emitClear();
    this.container.addEventListener('pointermove', this.pointerMove);
    this.container.addEventListener('pointerleave', this.pointerLeave);
  }

  private detachPointerCrosshair(): void {
    if (this.pointerMove) this.container.removeEventListener('pointermove', this.pointerMove);
    if (this.pointerLeave) this.container.removeEventListener('pointerleave', this.pointerLeave);
    this.pointerMove = null;
    this.pointerLeave = null;
    this.crosshairActive = false;
  }

  private notifyCrosshairListeners(payload: CrosshairPayload | null): void {
    for (const listener of this.crosshairListeners) {
      listener(payload);
    }
  }

  private visiblePriceRange(): PriceRange | null {
    const effective = this.orchestrator.getEffectiveMainPriceRange?.();
    if (effective) return effective;
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return null;
    const { from, to } = vp.visibleBarIndexRange();
    return priceRangeForBars(this.bars, from, to, this.priceScaleMode());
  }

  private priceScaleMode(): PriceScaleMode {
    return this.logScaleEnabled ? 'log' : 'linear';
  }

  /** Device layout metrics → CSS main-pane height (overlay + scale tags use CSS). */
  private mainPaneHeightCss(metrics: {
    canvasWidth: number;
    cssWidth: number;
    mainPaneHeight: number;
  }): number {
    const dpr = metrics.canvasWidth / Math.max(1, metrics.cssWidth);
    return metrics.mainPaneHeight / dpr;
  }

  private updateCrosshairVisual(payload: CrosshairPayload | null): void {
    if (!payload?.time) {
      this.crosshairOverlay.hide();
      this.orchestrator.setCrosshairReadout?.(null, null);
      return;
    }
    const metrics = this.orchestrator.getMainPaneLayoutMetrics();
    const vp = this.orchestrator.getViewport();
    if (!metrics || !vp || this.bars.length === 0) return;
    const w = metrics.cssWidth || this.container.clientWidth || 800;
    const mainPaneCss = this.mainPaneHeightCss(metrics);
    const idx = barIndexForTimeMs(this.bars, payload.time);
    const xCss = vp.canvasXForBarIndex(idx, w);
    let yCss = mainPaneCss / 2;
    if (payload.price != null && Number.isFinite(payload.price)) {
      const range = this.visiblePriceRange();
      if (range) {
        yCss = mapPriceToY(payload.price, range, 0, mainPaneCss, this.priceScaleMode());
      }
    }
    this.crosshairOverlay.show(xCss, yCss, mainPaneCss, w);
    this.orchestrator.setCrosshairReadout?.(payload.price ?? null, payload.time);
  }

  private nearestBar(tMs: number): Bar | undefined {
    let best: Bar | undefined;
    let bestDt = Infinity;
    for (const b of this.bars) {
      const dt = Math.abs(b.t - tMs);
      if (dt < bestDt) {
        bestDt = dt;
        best = b;
      }
    }
    return best;
  }

  applyTimeScaleSyncFromLayers(layers: LayerSyncInput[], pageId?: string): void {
    this.setPaneSyncGroups(resolvePaneSyncGroupsFromLayers(layers, pageId));
  }

  private getMainLogicalLayout(): import('@coderyo/renderer-webgl').LogicalBarLayout | null {
    const orch = this.orchestrator as WebGLPaneOrchestrator;
    if (typeof orch.getMainPane !== 'function') return null;
    return orch.getMainPane()?.getLogicalBarLayout() ?? null;
  }

  private syncBusFromViewport(): void {
    if (this.syncingBusFromViewport) return;
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return;
    const layout = this.getMainLogicalLayout();
    this.syncingBusFromViewport = true;
    try {
      const fromMs = layout
        ? timeMsAtLogicalIndex(this.bars, layout, vp.visibleFrom)
        : timeMsAtBarIndex(this.bars, vp.visibleFrom);
      const toMs = layout
        ? timeMsAtLogicalIndex(this.bars, layout, vp.visibleTo)
        : timeMsAtBarIndex(this.bars, vp.visibleTo);
      this.busRegistry.getOrCreateBus('main').setBarsTimeRange(fromMs, toMs);
      if (toMs > fromMs) {
        this.onVisibleRangeChange?.({ fromMs, toMs });
      }
    } finally {
      this.syncingBusFromViewport = false;
    }
  }
}