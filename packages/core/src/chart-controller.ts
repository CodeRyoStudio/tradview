import type { DrawingRecord, DrawingStyleMeta } from '@coderyo/drawings';
import type { IndicatorConfig } from '@coderyo/indicators';

import type {
  Bar,
  DataProvider,
  HistoryQuery,
  Interval,
  RealtimeStreamMode,
  SubscribeParams,
  SymbolResolver,
} from '@coderyo/data';
import { floorBarOpenTime, intervalMs } from '@coderyo/data';
import type { HistoryRequest } from '@coderyo/virtual-window';
import { parseInterval } from '@coderyo/data';
import { BarStore } from '@coderyo/series';
import { VirtualWindow, type FetchPolicy } from '@coderyo/virtual-window';
import { DrawingManager } from '@coderyo/drawings';
import { compilePineLite, runPineLite, type PineIrProgram } from '@coderyo/pine-lite';
import { PaneOrchestrator, type ChartVisibleRange } from '@coderyo/renderer-lite';

export type { ChartVisibleRange };
import {
  mergeChartFeatures,
  PENDING_SYMBOL,
  resolveChartFeatures,
  type ChartFeatures,
  type ResolvedChartFeatures,
} from './chart-features.js';

export interface ChartOptions {
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
  interval?: Interval;
  /** Omit for empty chart until setSymbol(). */
  symbol?: string;
  chartId?: string;
  /** Host element below main chart for MACD/RSI/KDJ panes (from ui-shell layout). */
  indicatorHost?: HTMLElement;
  dataProvider: DataProvider;
  /** Integrator feature flags (minimal defaults). */
  features?: ChartFeatures;
  /** @deprecated Use features.fetchPolicy */
  fetchPolicy?: FetchPolicy;
  scaleMode?: 'linear' | 'log';
  /** Grid lines on chart panes (default false). */
  showGrid?: boolean;
  symbolResolver?: SymbolResolver;
  drawingDefaults?: { returnToCursorAfterDraw?: boolean };
  /** @deprecated Use features.indicators */
  indicatorConfig?: IndicatorConfig;
}

export type ChartEvent =
  | 'connectionChange'
  | 'barUpdate'
  | 'error'
  | 'visibleRangeChange'
  | 'symbolChange'
  | 'intervalChange'
  | 'crosshairChange'
  | 'destroyed'
  | 'drawingSelectionChange'
  | 'drawingContextMenu'
  | 'requestCursorTool'
  | 'featuresChange';

type EventHandler = (payload?: unknown) => void;

export class ChartController {
  private readonly store: BarStore;
  private readonly virtualWindow: VirtualWindow;
  private readonly orchestrator: PaneOrchestrator;
  private readonly handlers = new Map<ChartEvent, Set<EventHandler>>();
  private subscriptionId: string | null = null;
  private destroyed = false;
  private readonly resizeObserver: ResizeObserver;
  private loadingMore = false;
  private visibleRangeInitialized = false;
  /** Bumped on symbol/interval change to drop stale bootstrap / loadMore / WS merges. */
  private loadGeneration = 0;
  private drawingManager: DrawingManager | null = null;
  private offCrosshair: (() => void) | null = null;
  private features: ResolvedChartFeatures;
  private pineIr: PineIrProgram | null = null;
  private catchUpInFlight = false;
  private lastCatchUpAt = 0;
  private offPageResume: (() => void) | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: ChartOptions,
  ) {
    this.features = resolveChartFeatures({
      ...options.features,
      fetchPolicy: options.features?.fetchPolicy ?? options.fetchPolicy,
      indicators:
        options.features?.indicators !== undefined
          ? options.features.indicators
          : options.indicatorConfig !== undefined
            ? options.indicatorConfig
            : undefined,
    });

    const symbol = options.symbol?.trim() || PENDING_SYMBOL;
    const interval = parseInterval(options.interval ?? '1h');
    const fetchPolicy = this.features.gaps.fillVisibleHoles
      ? 'fill-visible-holes'
      : this.features.fetchPolicy;

    this.store = new BarStore(symbol || PENDING_SYMBOL, interval);
    this.virtualWindow = new VirtualWindow(this.store, { fetchPolicy });
    this.orchestrator = new PaneOrchestrator({
      container,
      indicatorRoot: options.indicatorHost,
      theme: options.theme ?? 'dark',
      scaleMode: options.scaleMode ?? 'linear',
      showGrid: options.showGrid ?? false,
      indicatorConfig: this.features.indicators,
      smoothPriceUpdate: this.features.smoothPriceUpdate,
      smoothPriceDurationMs: this.features.smoothPriceDurationMs,
    });

    if (options.width) container.style.width = `${options.width}px`;
    if (options.height) container.style.height = `${options.height}px`;

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.destroyed) this.resize();
    });
    this.resizeObserver.observe(container);

    this.orchestrator.bus.subscribeTransform(() => {
      const bus = this.orchestrator.bus;
      if (bus.visibleToMs > bus.visibleFromMs) {
        this.virtualWindow.setVisibleRange({
          fromMs: bus.visibleFromMs,
          toMs: bus.visibleToMs,
        });
        this.visibleRangeInitialized = true;
      }
      void this.maybeLoadMore();
      this.drawingManager?.redraw();
    });

    const overlay = this.orchestrator.getOverlayCanvas();
    if (overlay) {
      this.orchestrator.setOverlayPointerEvents('none');
      this.drawingManager = new DrawingManager({
        canvas: overlay,
        interactionHost: overlay.parentElement ?? undefined,
        chartId: options.chartId ?? 'default',
        symbol,
        interval,
        priceToY: (p) => this.orchestrator.priceToY(p),
        timeToX: (t) => this.orchestrator.timeToX(t),
        xToTime: (x) => this.orchestrator.xToTime(x),
        yToPrice: (y) => this.orchestrator.yToPrice(y),
        returnToCursorAfterDraw: options.drawingDefaults?.returnToCursorAfterDraw ?? false,
        onRequestCursorTool: () => this.emit('requestCursorTool'),
        onSelectionChange: (id, record) =>
          this.emit('drawingSelectionChange', { id, record }),
        onContextMenu: (payload) => this.emit('drawingContextMenu', payload),
      });
      this.drawingManager.setPersistence(this.features.drawings.persist);
      this.applyDrawingLayer();
    }

    this.offCrosshair = this.orchestrator.subscribeCrosshair((payload) => {
      this.emit('crosshairChange', payload);
    });

    this.bindPageResumeCatchUp();

    if (this.hasActiveSymbol()) {
      void this.bootstrap(this.loadGeneration);
    } else {
      this.emit('connectionChange', 'disconnected');
    }
  }

  getFeatures(): ResolvedChartFeatures {
    return { ...this.features };
  }

  setFeatures(patch: ChartFeatures): this {
    this.features = mergeChartFeatures(this.features, patch);
    this.applyFeatures();
    this.emit('featuresChange', this.getFeatures());
    return this;
  }

  hasActiveSymbol(): boolean {
    const s = this.store.symbol;
    return s.length > 0 && s !== PENDING_SYMBOL;
  }

  private applyFeatures(): void {
    const fetchPolicy = this.features.gaps.fillVisibleHoles
      ? 'fill-visible-holes'
      : this.features.fetchPolicy;
    this.virtualWindow.setFetchPolicy(fetchPolicy);

    this.orchestrator.setIndicatorConfig(this.features.indicators);
    this.orchestrator.setSmoothPriceUpdate(
      this.features.smoothPriceUpdate,
      this.features.smoothPriceDurationMs,
    );
    this.drawingManager?.setPersistence(this.features.drawings.persist);
    this.applyDrawingLayer();
    this.recompilePine();
  }

  private recompilePine(): void {
    if (!this.features.pineEnabled || !this.features.pineScript?.trim()) {
      this.pineIr = null;
      this.orchestrator.setPinePlots(null);
      return;
    }
    const compiled = compilePineLite(this.features.pineScript);
    if (!compiled.ok || !compiled.ir) {
      this.pineIr = null;
      this.orchestrator.setPinePlots(null);
      this.emit('error', { kind: 'pine', errors: compiled.errors });
      return;
    }
    this.pineIr = compiled.ir;
  }

  private applyPinePlots(bars: Bar[]): void {
    if (!this.features.pineEnabled || !this.pineIr) {
      this.orchestrator.setPinePlots(null);
      return;
    }
    const result = runPineLite(this.pineIr, bars);
    this.orchestrator.setPinePlots(
      result.plots.map((p) => ({
        title: p.title,
        values: p.values,
        color: undefined,
      })),
    );
  }

  /** Integrator push: update last candle close (and H/L) without WS. */
  updateLastPrice(price: number, timeMs = Date.now()): this {
    if (!this.hasActiveSymbol() || this.destroyed) return this;
    const bar = this.buildBarFromPrice(price, timeMs);
    void this.applyRealtimeBar(bar, true);
    return this;
  }

  private buildBarFromPrice(price: number, timeMs: number): Bar {
    const interval = this.store.interval;
    const open = floorBarOpenTime(timeMs, interval);
    const times = this.store.sortedTimes;
    const lastT = times.length > 0 ? times[times.length - 1]! : undefined;
    const existing = lastT !== undefined ? this.store.getBar(lastT) : undefined;

    if (existing && existing.t === open) {
      return {
        ...existing,
        c: price,
        h: Math.max(existing.h, price),
        l: Math.min(existing.l, price),
      };
    }

    const prevClose = existing?.c ?? price;
    return {
      t: open,
      o: prevClose,
      h: Math.max(prevClose, price),
      l: Math.min(prevClose, price),
      c: price,
      v: existing?.v ?? 0,
    };
  }

  private async applyRealtimeBar(
    bar: Bar,
    partial: boolean,
    loadGen = this.loadGeneration,
  ): Promise<void> {
    await this.store.mergeRealtime({ bar, partial });
    if (!this.isLoadGenerationCurrent(loadGen)) return;

    const bars = this.virtualWindow.getBarsForRender();
    const last = bars[bars.length - 1];
    if (last && this.features.smoothPriceUpdate) {
      this.orchestrator.updateLastBar(last, {
        smooth: true,
        durationMs: this.features.smoothPriceDurationMs,
      });
      this.drawingManager?.redraw();
    } else {
      this.refreshRender(loadGen);
    }
    this.emit('barUpdate', bar);
  }

  private applyDrawingLayer(): void {
    if (!this.drawingManager) return;
    this.drawingManager.setLayerVisible(this.features.drawings.layer);
    this.syncOverlayPointerEvents();
  }

  private syncOverlayPointerEvents(): void {
    if (!this.drawingManager) return;
    const layer = this.features.drawings.layer;
    if (!layer) {
      this.orchestrator.setOverlayPointerEvents('none');
      return;
    }
    const tool = this.drawingManager.getTool();
    this.orchestrator.setOverlayPointerEvents(tool === 'cursor' ? 'none' : 'auto');
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  getSymbol(): string {
    return this.store.symbol;
  }

  getInterval(): Interval {
    return this.store.interval;
  }

  async searchSymbols(query: string): Promise<import('@coderyo/data').SymbolSearchHit[]> {
    const resolver = this.options.symbolResolver;
    if (resolver?.search) return resolver.search(query);
    if (this.options.dataProvider.searchSymbols) {
      return this.options.dataProvider.searchSymbols(query);
    }
    return [];
  }

  async resolveSymbol(symbol: string): Promise<import('@coderyo/data').SymbolInfo | null> {
    if (this.options.symbolResolver) {
      return this.options.symbolResolver.resolve(symbol);
    }
    return { symbol };
  }

  on(event: ChartEvent, handler: EventHandler): this {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }

  off(event: ChartEvent, handler: EventHandler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  resize(size?: { width?: number; height?: number }): this {
    if (size?.width) this.container.style.width = `${size.width}px`;
    if (size?.height) this.container.style.height = `${size.height}px`;
    this.orchestrator.resize();
    return this;
  }

  setDrawingTool(tool: import('@coderyo/drawings').DrawingTool): this {
    this.drawingManager?.setTool(tool);
    this.syncOverlayPointerEvents();
    return this;
  }

  deleteSelectedDrawing(): boolean {
    return this.drawingManager?.deleteSelected() ?? false;
  }

  copySelectedDrawing(): DrawingRecord | null {
    return this.drawingManager?.copySelected() ?? null;
  }

  toggleLockSelectedDrawing(): boolean {
    return this.drawingManager?.toggleLockSelected() ?? false;
  }

  updateSelectedDrawingStyle(patch: DrawingStyleMeta): void {
    this.drawingManager?.updateSelectedStyle(patch);
  }

  deselectDrawing(): void {
    this.drawingManager?.deselect();
  }

  setIndicatorConfig(config: IndicatorConfig | null): void {
    this.features = mergeChartFeatures(this.features, { indicators: config });
    this.orchestrator.setIndicatorConfig(config);
    this.emit('featuresChange', this.getFeatures());
  }

  setReturnToCursorAfterDraw(v: boolean): void {
    this.drawingManager?.setReturnToCursorAfterDraw(v);
  }

  async setSymbol(symbol: string): Promise<void> {
    const trimmed = symbol.trim();
    if (!trimmed) return;
    const gen = this.beginDataContextChange();
    await this.teardownSubscription();
    await this.store.setSymbolInterval(trimmed, this.store.interval);
    this.drawingManager?.setContext(symbol, this.store.interval);
    const info = await this.resolveSymbol(symbol);
    await this.bootstrap(gen);
    this.emit('symbolChange', info ?? { symbol });
  }

  async setInterval(interval: Interval): Promise<void> {
    const gen = this.beginDataContextChange();
    await this.teardownSubscription();
    await this.store.setSymbolInterval(this.store.symbol, interval);
    this.drawingManager?.setContext(this.store.symbol, interval);
    if (this.hasActiveSymbol()) {
      await this.bootstrap(gen);
    }
  }

  setTheme(theme: 'dark' | 'light'): this {
    this.orchestrator.setTheme(theme);
    return this;
  }

  setShowGrid(show: boolean): this {
    this.orchestrator.setShowGrid(show);
    return this;
  }

  fitContent(): this {
    this.orchestrator.fitContent();
    return this;
  }

  scrollToRealtime(): this {
    this.orchestrator.scrollToRealtime();
    return this;
  }

  getVisibleRange(): ChartVisibleRange | null {
    return this.orchestrator.getVisibleRange();
  }

  getBarSpace(): number {
    return this.orchestrator.getBarSpace();
  }

  setBarSpace(px: number): this {
    this.orchestrator.setBarSpace(px);
    return this;
  }

  setVisibleRange(range: ChartVisibleRange): this {
    this.orchestrator.setVisibleRange(range);
    const { fromMs, toMs } = range;
    if (toMs > fromMs) {
      this.virtualWindow.setVisibleRange({ fromMs, toMs });
      this.visibleRangeInitialized = true;
    }
    return this;
  }

  scrollToTimestamp(tsMs: number, animationMs?: number): this {
    this.orchestrator.scrollToTimestamp(tsMs, animationMs);
    return this;
  }

  async reloadHistory(): Promise<this> {
    if (!this.hasActiveSymbol()) return this;
    const savedRange = this.getVisibleRange();
    const savedBarSpace = this.getBarSpace();
    const loadGen = this.loadGeneration;
    const symbol = this.store.symbol;
    const interval = this.store.interval;

    try {
      const history = await this.options.dataProvider.getHistory({
        mode: 'loadMore',
        symbol,
        interval,
        endTime: Date.now(),
        limit: 500,
      });
      if (!this.isLoadGenerationCurrent(loadGen)) return this;
      if (this.store.symbol !== symbol || this.store.interval !== interval) return this;
      if (history.bars.length === 0) return this;

      await this.store.mergeBars(history.bars.map((bar) => ({ bar, source: 'rest' as const })));
      if (!this.isLoadGenerationCurrent(loadGen)) return this;

      this.orchestrator.preserveViewportOnNextSetBars();
      this.refreshRender(loadGen);
      if (savedBarSpace > 0) this.setBarSpace(savedBarSpace);
      if (savedRange) this.setVisibleRange(savedRange);
    } catch (err) {
      this.emit('error', err);
    }
    return this;
  }

  setLogScale(enabled: boolean): this {
    this.orchestrator.setLogScale(enabled);
    return this;
  }

  setFullscreen(_enabled: boolean): this {
    if (_enabled && this.container.requestFullscreen) {
      void this.container.requestFullscreen();
    } else if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
    return this;
  }

  async exportImage(opts?: { pixelRatio?: number }): Promise<Blob> {
    const canvas = this.container.querySelector('canvas');
    if (!canvas) throw new Error('No canvas to export');
    const scale = opts?.pixelRatio ?? 2;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width * scale;
    exportCanvas.height = canvas.height * scale;
    const ctx = exportCanvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(canvas, 0, 0);
    return new Promise((resolve, reject) => {
      exportCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('export failed'))), 'image/png');
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.offPageResume?.();
    this.offPageResume = null;
    this.offCrosshair?.();
    this.offCrosshair = null;
    this.resizeObserver.disconnect();
    this.drawingManager?.destroy();
    void this.teardownSubscription();
    this.orchestrator.destroy();
    this.emit('destroyed', { chartId: this.options.chartId ?? 'default' });
    this.emit('connectionChange', 'disconnected');
  }

  private beginDataContextChange(): number {
    this.loadGeneration += 1;
    this.visibleRangeInitialized = false;
    this.virtualWindow.setVisibleRange({ fromMs: 0, toMs: 0 });
    this.orchestrator.resetViewState();
    this.orchestrator.clearBars();
    return this.loadGeneration;
  }

  private isLoadGenerationCurrent(gen: number): boolean {
    return !this.destroyed && gen === this.loadGeneration;
  }

  private async bootstrap(loadGen: number): Promise<void> {
    if (!this.isLoadGenerationCurrent(loadGen)) return;

    const symbol = this.store.symbol;
    const interval = this.store.interval;
    const endTime = Date.now();
    const history = await this.options.dataProvider.getHistory({
      mode: 'loadMore',
      symbol,
      interval,
      endTime,
      limit: 500,
    });

    if (!this.isLoadGenerationCurrent(loadGen)) return;
    if (this.store.symbol !== symbol || this.store.interval !== interval) return;

    await this.store.mergeBars(history.bars.map((bar) => ({ bar })));
    if (!this.isLoadGenerationCurrent(loadGen)) return;
    this.refreshRender(loadGen);
    void this.resolveSymbol(symbol).then((info) => {
      if (!this.isLoadGenerationCurrent(loadGen)) return;
      this.emit('symbolChange', info ?? { symbol });
    });
    this.emit('intervalChange', interval);

    const streamMode: RealtimeStreamMode = this.features.tickStream
      ? 'bar+tick'
      : this.features.streamMode;

    const params: SubscribeParams = {
      symbol,
      interval,
      channels: this.features.tickStream ? ['bar', 'tick'] : ['bar'],
      streamMode,
    };

    await this.options.dataProvider.connect?.();
    if (!this.isLoadGenerationCurrent(loadGen)) return;

    const sub = await this.options.dataProvider.subscribe(params, {
      onBar: (bar, meta) => {
        if (!this.isLoadGenerationCurrent(loadGen)) return;
        if (this.store.symbol !== symbol || this.store.interval !== interval) return;
        void this.applyRealtimeBar(bar, meta.partial, loadGen);
      },
      onTick: (tick) => {
        if (!this.isLoadGenerationCurrent(loadGen)) return;
        if (this.store.symbol !== symbol || this.store.interval !== interval) return;
        const bar = this.buildBarFromPrice(tick.price, tick.t);
        void this.applyRealtimeBar(bar, true, loadGen);
      },
      onConnectionChange: (state) => {
        this.emit('connectionChange', state);
        if (state === 'connected') {
          void this.catchUpMissedBars();
        }
      },
      onError: (err) => this.emit('error', err),
    });
    if (!this.isLoadGenerationCurrent(loadGen)) {
      await this.options.dataProvider.unsubscribe(sub.id);
      return;
    }
    this.subscriptionId = sub.id;
  }

  private async teardownSubscription(): Promise<void> {
    if (this.subscriptionId) {
      await this.options.dataProvider.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }
  }

  private bindPageResumeCatchUp(): void {
    if (typeof document === 'undefined') return;

    const onResume = () => {
      if (document.visibilityState !== 'visible') return;
      void this.catchUpMissedBars();
    };

    document.addEventListener('visibilitychange', onResume);
    const cleanups: Array<() => void> = [
      () => document.removeEventListener('visibilitychange', onResume),
    ];

    if (typeof window !== 'undefined') {
      const onFocus = () => void this.catchUpMissedBars();
      window.addEventListener('focus', onFocus);
      cleanups.push(() => window.removeEventListener('focus', onFocus));
    }

    this.offPageResume = () => {
      for (const fn of cleanups) fn();
    };
  }

  /**
   * Backfill bars missed while the tab/window was backgrounded or WS delivery paused.
   */
  private async catchUpMissedBars(): Promise<void> {
    if (this.destroyed || !this.hasActiveSymbol()) return;

    const now = Date.now();
    if (now - this.lastCatchUpAt < 400) return;
    if (this.catchUpInFlight) return;

    const times = this.store.sortedTimes;
    if (times.length === 0) return;

    const lastT = times[times.length - 1]!;
    const interval = this.store.interval;
    const to = now + intervalMs(interval);
    if (to <= lastT) return;

    this.catchUpInFlight = true;
    this.lastCatchUpAt = now;
    const loadGen = this.loadGeneration;
    const symbol = this.store.symbol;

    try {
      const history = await this.options.dataProvider.getHistory({
        mode: 'range',
        symbol,
        interval,
        from: lastT,
        to,
      });
      if (!this.isLoadGenerationCurrent(loadGen)) return;
      if (this.store.symbol !== symbol || this.store.interval !== interval) return;
      if (history.bars.length === 0) return;

      await this.store.mergeBars(
        history.bars.map((bar) => ({ bar, source: 'rest' as const })),
      );
      if (!this.isLoadGenerationCurrent(loadGen)) return;

      this.orchestrator.preserveViewportOnNextSetBars();
      this.refreshRender(loadGen);
    } catch (err) {
      this.emit('error', err);
    } finally {
      this.catchUpInFlight = false;
    }
  }

  private async maybeLoadMore(): Promise<void> {
    if (this.destroyed || this.loadingMore) return;
    const loadGen = this.loadGeneration;
    const reqs = this.virtualWindow.planFetches();
    if (reqs.length === 0) return;

    this.loadingMore = true;
    try {
      for (const req of reqs) {
        if (!this.isLoadGenerationCurrent(loadGen)) return;
        const history = await this.options.dataProvider.getHistory(toHistoryQuery(req));
        if (!this.isLoadGenerationCurrent(loadGen)) return;
        if (history.bars.length === 0) continue;
        await this.store.mergeBars(
          history.bars.map((bar) => ({ bar, source: 'rest' as const })),
          req.mode === 'loadMore',
        );
      }
      if (!this.isLoadGenerationCurrent(loadGen)) return;
      this.refreshRender(loadGen);
    } catch (err) {
      this.emit('error', err);
    } finally {
      this.loadingMore = false;
    }
  }

  private refreshRender(loadGen = this.loadGeneration): void {
    if (!this.isLoadGenerationCurrent(loadGen)) return;

    const times = this.store.sortedTimes;
    if (times.length === 0) return;

    // Only seed visible range once; resetting to full series each tick triggers spurious loadMore.
    if (!this.visibleRangeInitialized) {
      this.virtualWindow.setVisibleRange({
        fromMs: times[0]!,
        toMs: times[times.length - 1]!,
      });
      this.visibleRangeInitialized = true;
    }

    const bars = this.virtualWindow.getBarsForRender();
    if (bars.length === 0) return;

    this.orchestrator.setBars(bars);
    this.applyPinePlots(bars);
    this.drawingManager?.redraw();
    this.emit('visibleRangeChange', {
      from: bars[0]!.t,
      to: bars[bars.length - 1]!.t,
    });
  }

  private emit(event: ChartEvent, payload?: unknown): void {
    for (const h of this.handlers.get(event) ?? []) h(payload);
  }
}

function toHistoryQuery(req: HistoryRequest): HistoryQuery {
  if (req.mode === 'loadMore') {
    return {
      mode: 'loadMore',
      symbol: req.symbol,
      interval: req.interval,
      endTime: req.endTime ?? Date.now(),
      limit: req.limit,
    };
  }
  return {
    mode: 'range',
    symbol: req.symbol,
    interval: req.interval,
    from: req.fromMs ?? 0,
    to: req.toMs ?? Date.now(),
  };
}