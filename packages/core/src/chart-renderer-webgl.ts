import type { Bar } from '@coderyo/data';
import { intervalMs, type Interval } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG, type IndicatorConfig } from '@coderyo/indicators';
import {
  computePrependSliceDeltaForViewport,
  type CrosshairPayload,
} from '@coderyo/renderer-lite';
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
  timeMsAtBarIndex,
  type WebGLPaneOrchestratorOptions,
} from '@coderyo/renderer-webgl';
import type { ChartPaneId } from '@coderyo/renderer-lite';
import type { ChartVisibleRange } from './ms-time-scale-bus.js';
import { MsTimeScaleBusRegistry } from './ms-time-scale-bus.js';
import type { LayerSyncInput } from './resolve-pane-sync-groups.js';
import type { PaneSyncGroupPatch } from './resolve-pane-sync-groups.js';

export interface WebGLChartRenderOptions extends Omit<WebGLPaneOrchestratorOptions, 'theme'> {
  chartId?: string;
  showGrid?: boolean;
  drawingsLayer?: boolean;
}

/**
 * WebGL render surface for {@link ChartController} (V2-R12).
 * LWC-only paths (Pine plots, multi-pane sync groups) are no-ops until port parity.
 */
export class WebGLChartRenderBackend {
  readonly busRegistry = new MsTimeScaleBusRegistry();
  private readonly orchestrator: WebGLPaneOrchestrator;
  private bars: Bar[] = [];
  private offBusTransform: (() => void) | null = null;
  /** One-shot clear from {@link subscribeCrosshair} (symbol reload / clearBars). */
  private crosshairEmitClear: (() => void) | null = null;
  private readonly crosshairListeners = new Set<(payload: CrosshairPayload | null) => void>();
  private programmaticCrosshair: CrosshairPayload | null = null;
  private logScaleEnabled = false;
  private syncingBusFromViewport = false;
  constructor(
    private readonly container: HTMLElement,
    options: WebGLChartRenderOptions = {},
  ) {
    const drawingsEnabled = options.drawingsLayer ?? false;
    this.orchestrator = new WebGLPaneOrchestrator({
      ...options,
      debug: options.debug ?? false,
      drawings: drawingsEnabled
        ? {
            enabled: true,
            chartId: options.chartId ?? 'default',
          }
        : undefined,
    });
    this.orchestrator.mount(container);
    this.offBusTransform = this.busRegistry.getOrCreateBus('main').subscribeTransform(() => {
      this.syncBusFromViewport();
    });
  }

  mount(): void {
    /* mounted in constructor */
  }

  setBars(bars: readonly Bar[], _gaps?: number[]): void {
    const hadBars = this.bars.length > 0;
    this.bars = bars as Bar[];
    this.orchestrator.setBars(this.bars);
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
    const vp = this.orchestrator.getViewport();
    if (vp) vp.setBarCount(0);
  }

  resize(): void {
    this.orchestrator.render();
  }

  resizeAllPanes(): void {
    this.orchestrator.render();
  }

  destroy(): void {
    this.offBusTransform?.();
    this.offBusTransform = null;
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

  setShowGrid(_show: boolean): void {
    this.orchestrator.render();
  }

  setBarSpacingPolicy(_opts: {
    autoBarSpacingOnInterval?: boolean;
    barSpacingByInterval?: Partial<Record<Interval, number>>;
  }): void {
    /* spacing applied via setBarSpace */
  }

  setSmoothPriceUpdate(_enabled: boolean, _durationMs: number): void {
    /* BarSmoothAnimator is LWC-only; flag stored on ChartFeatures for lite path */
  }

  setPinePlots(_plots: unknown): void {
    /* Pine script plots render on lite; WebGL uses main-chart MA/BOLL overlays @ GA */
  }

  setResizeFocusPanes(_panes: ChartPaneId[] | null): void {
    this.orchestrator.render();
  }

  setActiveSyncPane(_pane: ChartPaneId): void {
    /* single main bus */
  }

  setPaneSyncGroups(_patch: PaneSyncGroupPatch): void {
    /* compositor sync is LWC path */
  }

  preserveViewportOnNextSetBars(): void {
    /* viewport kept via WebGL orchestrator state */
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

  updateLastBar(bar: Bar, _opts?: { animate?: boolean }): boolean {
    if (this.bars.length === 0) {
      this.bars = [bar];
    } else {
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
    const fromIdx = barIndexForTimeMs(this.bars, range.fromMs);
    const toIdx = barIndexForTimeMs(this.bars, range.toMs);
    vp.setVisibleRange(fromIdx, Math.max(fromIdx + 1, toIdx));
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  scrollToTimestamp(tsMs: number, _animationMs?: number): void {
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return;
    const idx = barIndexForTimeMs(this.bars, tsMs);
    const span = vp.visibleSpan;
    vp.setVisibleRange(Math.max(0, idx - span * 0.1), idx + span * 0.05);
    this.syncBusFromViewport();
    this.orchestrator.render();
  }

  setLogScale(enabled: boolean): void {
    this.logScaleEnabled = enabled;
    this.orchestrator.setLogScale(enabled);
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
    const idx = barIndexForTimeMs(this.bars, tMs);
    return vp.plotXForBarIndex(idx, plotW) * (globalThis.devicePixelRatio ?? 1);
  }

  xToTime(x: number): number | null {
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return null;
    const w = this.container.clientWidth || 800;
    const plotW = vp.plotWidthPx(w);
    const dpr = globalThis.devicePixelRatio ?? 1;
    const idx = vp.barIndexAtPlotX(x / dpr, plotW);
    return timeMsAtBarIndex(this.bars, idx);
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
  }

  clearCrosshair(): void {
    this.programmaticCrosshair = null;
    this.crosshairEmitClear?.();
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
    this.notifyCrosshairListeners(null);
  }

  private pointerMove: ((e: PointerEvent) => void) | null = null;
  private pointerLeave: (() => void) | null = null;
  private crosshairActive = false;

  private attachPointerCrosshair(): void {
    const dpr = globalThis.devicePixelRatio ?? 1;
    const emitClear = (): void => {
      if (!this.crosshairActive) return;
      this.crosshairActive = false;
      this.programmaticCrosshair = null;
      this.notifyCrosshairListeners(null);
    };
    this.crosshairEmitClear = emitClear;
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
    };
    this.pointerLeave = () => emitClear();
    this.container.addEventListener('pointermove', this.pointerMove);
    this.container.addEventListener('pointerleave', this.pointerLeave);
  }

  private detachPointerCrosshair(): void {
    this.crosshairEmitClear = null;
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
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return null;
    const { from, to } = vp.visibleBarIndexRange();
    return priceRangeForBars(this.bars, from, to, this.priceScaleMode());
  }

  private priceScaleMode(): PriceScaleMode {
    return this.logScaleEnabled ? 'log' : 'linear';
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

  applyTimeScaleSyncFromLayers(_layers: LayerSyncInput[], _pageId?: string): void {
    /* layer compositor sync: lite only */
  }

  private syncBusFromViewport(): void {
    if (this.syncingBusFromViewport) return;
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return;
    this.syncingBusFromViewport = true;
    try {
      const fromMs = timeMsAtBarIndex(this.bars, vp.visibleFrom);
      const toMs = timeMsAtBarIndex(this.bars, vp.visibleTo);
      this.busRegistry.getOrCreateBus('main').setBarsTimeRange(fromMs, toMs);
    } finally {
      this.syncingBusFromViewport = false;
    }
  }
}