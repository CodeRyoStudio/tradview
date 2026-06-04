import type { Bar } from '@coderyo/data';
import type { Interval } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG, type IndicatorConfig } from '@coderyo/indicators';
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
    this.busRegistry.getOrCreateBus('main').subscribeTransform(() => {
      this.syncBusFromViewport();
    });
  }

  mount(): void {
    /* mounted in constructor */
  }

  setBars(bars: readonly Bar[], _gaps?: number[]): void {
    this.bars = bars as Bar[];
    this.orchestrator.setBars(this.bars);
    this.syncBusFromViewport();
  }

  clearBars(): void {
    this.bars = [];
    this.orchestrator.setBars([]);
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
    /* smooth animator is LWC-only */
  }

  setPinePlots(_plots: unknown): void {
    /* Pine overlay not on WebGL @ R12 */
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
    _sortedTimesBefore: readonly number[],
    _sortedTimesAfter: readonly number[],
    _interval: Interval,
  ): void {
    /* prepend compensation is LWC path */
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

  setLogScale(_enabled: boolean): void {
    /* log scale not on WebGL @ R12 */
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
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return null;
    const { from, to } = vp.visibleBarIndexRange();
    let min = Infinity;
    let max = -Infinity;
    for (let i = from; i <= to; i++) {
      const b = this.bars[i];
      if (!b) continue;
      min = Math.min(min, b.l);
      max = Math.max(max, b.h);
    }
    if (!Number.isFinite(min)) return null;
    const span = max - min || 1;
    const t = (price - min) / span;
    return metrics.mainPaneHeight * (1 - t);
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
    const vp = this.orchestrator.getViewport();
    if (!metrics || !vp || this.bars.length === 0) return null;
    const { from, to } = vp.visibleBarIndexRange();
    let min = Infinity;
    let max = -Infinity;
    for (let i = from; i <= to; i++) {
      const b = this.bars[i];
      if (!b) continue;
      min = Math.min(min, b.l);
      max = Math.max(max, b.h);
    }
    if (!Number.isFinite(min)) return null;
    const span = max - min || 1;
    const t = (metrics.mainPaneHeight - y) / metrics.mainPaneHeight;
    return min + t * span;
  }

  subscribeCrosshair(handler: (payload: unknown) => void): () => void {
    const dpr = globalThis.devicePixelRatio ?? 1;
    const onMove = (e: PointerEvent) => {
      if (this.bars.length === 0) return;
      const rect = this.container.getBoundingClientRect();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      const time = this.xToTime(x);
      if (time == null) {
        handler(null);
        return;
      }
      const price = this.yToPrice(y);
      const bar = this.bars.find((b) => b.t === time) ?? this.nearestBar(time);
      handler({
        time,
        price,
        ohlcv: bar
          ? { o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }
          : null,
      });
    };
    const onLeave = () => handler(null);
    this.container.addEventListener('pointermove', onMove);
    this.container.addEventListener('pointerleave', onLeave);
    return () => {
      this.container.removeEventListener('pointermove', onMove);
      this.container.removeEventListener('pointerleave', onLeave);
    };
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
    const vp = this.orchestrator.getViewport();
    if (!vp || this.bars.length === 0) return;
    const fromMs = timeMsAtBarIndex(this.bars, vp.visibleFrom);
    const toMs = timeMsAtBarIndex(this.bars, vp.visibleTo);
    this.busRegistry.getOrCreateBus('main').setBarsTimeRange(fromMs, toMs);
  }
}