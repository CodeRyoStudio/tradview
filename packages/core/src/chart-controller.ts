import type { DrawingRecord, DrawingStyleMeta } from '@coderyo/drawings';
import {
  clearedIndicatorConfig,
  disableIndicatorLayer as applyDisableIndicatorLayer,
  listActiveIndicatorLayers,
  type IndicatorConfig,
  type IndicatorLayerId,
  type IndicatorLayerInfo,
} from '@coderyo/indicators';

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
import { BarStore, computeGapStartTimes, TickAggregator } from '@coderyo/series';
import { setLocale as setI18nLocale } from '@coderyo/i18n';
import { fetchChartHistory } from './fetch-chart-history.js';
import { VirtualWindow, type FetchPolicy } from '@coderyo/virtual-window';
import { DrawingManager } from '@coderyo/drawings';
import {
  compilePineLite,
  runPineLiteAsync,
  terminatePineWorker,
  type PineIrProgram,
} from '@coderyo/pine-lite';
import {
  PaneOrchestrator,
  type ChartPaneId,
  type ChartVisibleRange,
} from '@coderyo/renderer-lite';
import { WebGLChartRenderBackend } from './chart-renderer-webgl.js';
import {
  resolvePaneSyncGroupsFromLayers,
  type LayerSyncInput,
} from './resolve-pane-sync-groups.js';

export type { ChartVisibleRange };
import {
  mergeChartFeatures,
  PENDING_SYMBOL,
  resolveChartFeatures,
  type ChartFeatures,
  type ResolvedChartFeatures,
} from './chart-features.js';
import {
  defaultChartStorage,
  loadIndicatorConfig,
  saveIndicatorConfig,
  type ChartStorageAdapter,
} from './indicator-storage.js';

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
  /** P2: separate volume pane mount (layer compositor). */
  volumeMount?: HTMLElement;
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
  /** Storage backend for `features.indicatorPersist` (default `localStorage`). */
  chartStorage?: ChartStorageAdapter;
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
  | 'featuresChange'
  | 'telemetry';

type EventHandler = (payload?: unknown) => void;

export class ChartController {
  private readonly store: BarStore;
  private fetchPolicy: FetchPolicy;
  /** Per sync-group viewport for loadMore / render slicing (active bus drives IChart APIs). */
  private readonly virtualWindows = new Map<string, VirtualWindow>();
  private readonly orchestrator: PaneOrchestrator | WebGLChartRenderBackend;
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
  private tickAggregator: TickAggregator | null = null;
  private catchUpInFlight = false;
  private lastCatchUpAt = 0;
  private offPageResume: (() => void) | null = null;
  /** After clearAllIndicators(); blocks Pine replot until script/features change. */
  private pinePlotsSuppressed = false;
  private readonly chartStorage: ChartStorageAdapter;
  private readonly onPaneResize = () => {
    if (this.destroyed) return;
    // Layout-driven pane height changes must resize every LWC instance.
    this.orchestrator.setResizeFocusPanes(null);
  };

  constructor(
    private readonly container: HTMLElement,
    private readonly options: ChartOptions,
  ) {
    this.chartStorage = options.chartStorage ?? defaultChartStorage;
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
    this.fetchPolicy = this.features.gaps.fillVisibleHoles
      ? 'fill-visible-holes'
      : this.features.fetchPolicy;

    this.store = new BarStore(symbol || PENDING_SYMBOL, interval);
    if (this.features.renderer === 'webgl') {
      this.orchestrator = new WebGLChartRenderBackend(container, {
        chartId: options.chartId,
        drawingsLayer: this.features.drawings.layer,
        indicatorConfig: this.features.indicators ?? undefined,
      });
    } else {
      this.orchestrator = new PaneOrchestrator({
        container,
        volumeMount: options.volumeMount,
        listenPaneResizeEvents: false,
        indicatorRoot: options.indicatorHost,
        theme: options.theme ?? 'dark',
        scaleMode: options.scaleMode ?? 'linear',
        showGrid: options.showGrid ?? false,
        indicatorConfig: this.features.indicators,
        smoothPriceUpdate: this.features.smoothPriceUpdate,
        smoothPriceDurationMs: this.features.smoothPriceDurationMs,
        onIndicatorConfigChange: (config) => this.setIndicatorConfig(config),
        autoBarSpacingOnInterval: this.features.autoBarSpacingOnInterval,
        barSpacingByInterval: this.features.barSpacingByInterval,
      });
      this.orchestrator.setIntervalContext(interval);
    }

    if (options.width) container.style.width = `${options.width}px`;
    if (options.height) container.style.height = `${options.height}px`;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.destroyed) return;
      this.orchestrator.setResizeFocusPanes(null);
    });
    const resizeTargets = [container, options.volumeMount, options.indicatorHost].filter(
      Boolean,
    ) as HTMLElement[];
    for (const el of resizeTargets) this.resizeObserver.observe(el);
    window.addEventListener('tradview:pane-resize', this.onPaneResize);

    this.orchestrator.busRegistry.forEachBus((key, bus) => {
      bus.subscribeTransform(() => {
        if (key !== this.orchestrator.busRegistry.getActiveBusKey()) return;
        if (bus.visibleToMs > bus.visibleFromMs) {
          this.activeVirtualWindow().setVisibleRange({
            fromMs: bus.visibleFromMs,
            toMs: bus.visibleToMs,
          });
          this.visibleRangeInitialized = true;
        }
        void this.maybeLoadMore();
        this.drawingManager?.redraw();
      });
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
    this.applyPersistedIndicatorsOnInit(options);

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
    if (patch.pineEnabled === true || patch.pineScript !== undefined) {
      this.pinePlotsSuppressed = false;
    }
    this.features = mergeChartFeatures(this.features, patch);
    this.applyFeatures();
    this.emit('featuresChange', this.getFeatures());
    return this;
  }

  hasActiveSymbol(): boolean {
    const s = this.store.symbol;
    return s.length > 0 && s !== PENDING_SYMBOL;
  }

  private activeVirtualWindow(): VirtualWindow {
    const key = this.orchestrator.busRegistry.getActiveBusKey();
    let vw = this.virtualWindows.get(key);
    if (!vw) {
      vw = new VirtualWindow(this.store, { fetchPolicy: this.fetchPolicy });
      const range = this.orchestrator.busRegistry.getOrCreateBus(key).getVisibleRange();
      if (range) vw.setVisibleRange(range);
      this.virtualWindows.set(key, vw);
    }
    return vw;
  }

  private applyFeatures(): void {
    const fetchPolicy = this.features.gaps.fillVisibleHoles
      ? 'fill-visible-holes'
      : this.features.fetchPolicy;
    this.fetchPolicy = fetchPolicy;
    for (const vw of this.virtualWindows.values()) vw.setFetchPolicy(fetchPolicy);

    this.orchestrator.setIndicatorConfig(this.features.indicators);
    this.orchestrator.setBarSpacingPolicy({
      autoBarSpacingOnInterval: this.features.autoBarSpacingOnInterval,
      barSpacingByInterval: this.features.barSpacingByInterval,
    });
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
    if (this.hasActiveSymbol()) {
      const bars = this.activeVirtualWindow().getBarsForRender();
      if (bars.length > 0) this.applyPinePlots(bars);
    }
  }

  private applyPinePlots(bars: Bar[]): void {
    if (this.pinePlotsSuppressed || !this.features.pineEnabled || !this.pineIr) {
      this.orchestrator.setPinePlots(null);
      return;
    }
    const ir = this.pineIr;
    const useWorker = this.features.pineWorker;
    void runPineLiteAsync(ir, bars, { useWorker })
      .then((result) => {
        if (this.destroyed || this.pineIr !== ir) return;
        this.orchestrator.setPinePlots(
          result.plots.map((p) => ({
            title: p.title,
            values: p.values,
            color: undefined,
          })),
        );
      })
      .catch((err) => this.emit('error', err));
  }

  private trackTelemetry(event: string, data?: Record<string, unknown>): void {
    if (!this.features.telemetry) return;
    this.emit('telemetry', { event, ...data });
  }

  setLocale(locale: string): this {
    setI18nLocale(locale);
    this.trackTelemetry('locale', { locale });
    return this;
  }

  subscribeBars(handler: (bar: Bar) => void): () => void {
    const wrapper = (payload?: unknown) => handler(payload as Bar);
    this.on('barUpdate', wrapper);
    return () => this.off('barUpdate', wrapper);
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

    if (this.features.smoothPriceUpdate) {
      const updated = this.orchestrator.updateLastBar(bar, {
        smooth: true,
        durationMs: this.features.smoothPriceDurationMs,
      });
      if (updated) {
        this.drawingManager?.redraw();
      } else {
        this.refreshRender(loadGen);
      }
    } else {
      this.refreshRender(loadGen);
    }
    this.emit('barUpdate', bar);
    this.trackTelemetry('barUpdate', { t: bar.t, partial });
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

  /** P2: limit LWC resize to focused panes; also selects that pane's time-scale sync group for IChart APIs. */
  setChartPaneResizeFocus(pane: ChartPaneId | 'all'): this {
    if (pane !== 'all') {
      this.orchestrator.setActiveSyncPane(pane);
      this.orchestrator.setResizeFocusPanes([pane]);
    } else {
      this.orchestrator.setResizeFocusPanes(null);
    }
    return this;
  }

  /** Apply `syncTimeScaleGroupId` from layout layers to pane buses (empty = independent). */
  applyTimeScaleSyncFromLayers(layers: LayerSyncInput[], pageId?: string): this {
    this.orchestrator.setPaneSyncGroups(resolvePaneSyncGroupsFromLayers(layers, pageId));
    return this;
  }

  setDrawingTool(tool: import('@coderyo/drawings').DrawingTool): this {
    if (this.features.renderer === 'webgl') {
      (this.orchestrator as WebGLChartRenderBackend).setDrawingTool(tool);
    } else {
      this.drawingManager?.setTool(tool);
    }
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
    if (config && this.features.indicatorPersist && this.hasActiveSymbol()) {
      saveIndicatorConfig(
        this.chartStorage,
        this.store.symbol,
        this.store.interval,
        config,
      );
    }
    this.emit('featuresChange', this.getFeatures());
  }

  private applyPersistedIndicatorsOnInit(options: ChartOptions): void {
    if (!this.features.indicatorPersist || !this.hasActiveSymbol()) return;
    const explicit =
      options.features?.indicators !== undefined || options.indicatorConfig !== undefined;
    if (explicit) return;
    this.applyPersistedIndicatorsForContext();
  }

  private applyPersistedIndicatorsForContext(): void {
    if (!this.features.indicatorPersist || !this.hasActiveSymbol()) return;
    const loaded = loadIndicatorConfig(
      this.chartStorage,
      this.store.symbol,
      this.store.interval,
    );
    this.features = mergeChartFeatures(this.features, { indicators: loaded });
    this.orchestrator.setIndicatorConfig(loaded);
    this.emit('featuresChange', this.getFeatures());
  }

  /** @public List built-in indicator layers currently enabled on the chart. */
  listIndicatorLayers(): IndicatorLayerInfo[] {
    if (this.features.indicators === null) return [];
    return listActiveIndicatorLayers(this.features.indicators);
  }

  /** @public Disable a single built-in indicator layer by id. */
  disableIndicatorLayer(id: IndicatorLayerId): IndicatorConfig {
    if (this.features.indicators === null) {
      return clearedIndicatorConfig();
    }
    const next = applyDisableIndicatorLayer(this.features.indicators, id);
    this.setIndicatorConfig(next);
    return next;
  }

  clearAllIndicators(): IndicatorConfig {
    const config = clearedIndicatorConfig(this.features.indicators ?? undefined);
    this.setIndicatorConfig(config);
    this.orchestrator.setPinePlots(null);
    this.pinePlotsSuppressed = true;
    return config;
  }

  clearAllDrawings(): number {
    return this.drawingManager?.clearAll() ?? 0;
  }

  setReturnToCursorAfterDraw(v: boolean): void {
    this.drawingManager?.setReturnToCursorAfterDraw(v);
  }

  async setSymbol(symbol: string): Promise<void> {
    const trimmed = symbol.trim();
    if (!trimmed) return;
    this.orchestrator.setIntervalContext(this.store.interval);
    const gen = this.beginDataContextChange();
    await this.teardownSubscription();
    await this.store.setSymbolInterval(trimmed, this.store.interval);
    this.drawingManager?.setContext(symbol, this.store.interval);
    this.applyPersistedIndicatorsForContext();
    const info = await this.resolveSymbol(symbol);
    await this.bootstrap(gen);
    this.emit('symbolChange', info ?? { symbol });
  }

  async setInterval(interval: Interval): Promise<void> {
    this.orchestrator.setIntervalContext(interval);
    const gen = this.beginDataContextChange();
    await this.teardownSubscription();
    await this.store.setSymbolInterval(this.store.symbol, interval);
    this.drawingManager?.setContext(this.store.symbol, interval);
    this.applyPersistedIndicatorsForContext();
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
      this.activeVirtualWindow().setVisibleRange({ fromMs, toMs });
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
      const history = await fetchChartHistory(this.options.dataProvider, {
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
    window.removeEventListener('tradview:pane-resize', this.onPaneResize);
    this.drawingManager?.destroy();
    void this.teardownSubscription();
    this.orchestrator.destroy();
    terminatePineWorker();
    this.emit('destroyed', { chartId: this.options.chartId ?? 'default' });
    this.emit('connectionChange', 'disconnected');
  }

  private beginDataContextChange(): number {
    this.loadGeneration += 1;
    this.visibleRangeInitialized = false;
    this.virtualWindows.clear();
    this.orchestrator.resetViewState();
    this.orchestrator.clearBars();
    return this.loadGeneration;
  }

  private isLoadGenerationCurrent(gen: number): boolean {
    return !this.destroyed && gen === this.loadGeneration;
  }

  /** Opt-in WS protobuf when provider advertises `encoding` (PR-02b-2). */
  private async applyProtobufWsEncodingIfEnabled(): Promise<void> {
    if (!this.features.protobuf) return;

    const caps = await this.options.dataProvider.getCapabilities?.();
    if (!caps?.encoding?.includes('protobuf')) {
      this.emit('error', {
        code: 'PROTOBUF_UNAVAILABLE',
        message: 'Data provider does not advertise protobuf in capabilities.encoding',
      });
      return;
    }

    this.options.dataProvider.setWsEncoding?.('protobuf');
  }

  private async bootstrap(loadGen: number): Promise<void> {
    if (!this.isLoadGenerationCurrent(loadGen)) return;

    const symbol = this.store.symbol;
    const interval = this.store.interval;

    try {
      const endTime = Date.now();
      await this.applyProtobufWsEncodingIfEnabled();

      const history = await fetchChartHistory(this.options.dataProvider, {
        mode: 'loadMore',
        symbol,
        interval,
        endTime,
        limit: 500,
      });

      if (!this.isLoadGenerationCurrent(loadGen)) return;
      if (this.store.symbol !== symbol || this.store.interval !== interval) return;

      if (history.bars.length === 0) {
        this.emit('error', {
          kind: 'history',
          message: `No bars returned for ${symbol} (${interval})`,
        });
        return;
      }

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
      const tickOnly = streamMode === 'tick';

      const params: SubscribeParams = {
        symbol,
        interval,
        channels: tickOnly ? ['tick'] : this.features.tickStream ? ['bar', 'tick'] : ['bar'],
        streamMode,
      };

      this.tickAggregator = tickOnly
        ? new TickAggregator(interval, (bar, partial) => {
            if (!this.isLoadGenerationCurrent(loadGen)) return;
            if (this.store.symbol !== symbol || this.store.interval !== interval) return;
            void this.applyRealtimeBar(bar, partial, loadGen);
          })
        : null;

      await this.options.dataProvider.connect?.();
      if (!this.isLoadGenerationCurrent(loadGen)) return;

      const sub = await this.options.dataProvider.subscribe(params, {
        onBar: tickOnly
          ? undefined
          : (bar, meta) => {
              if (!this.isLoadGenerationCurrent(loadGen)) return;
              if (this.store.symbol !== symbol || this.store.interval !== interval) return;
              void this.applyRealtimeBar(bar, meta.partial, loadGen);
            },
        onTick: (tick) => {
          if (!this.isLoadGenerationCurrent(loadGen)) return;
          if (this.store.symbol !== symbol || this.store.interval !== interval) return;
          if (this.tickAggregator) {
            this.tickAggregator.ingest(tick);
            return;
          }
          const bar = this.buildBarFromPrice(tick.price, tick.t);
          void this.applyRealtimeBar(bar, true, loadGen);
        },
        onConnectionChange: (state) => {
          this.emit('connectionChange', state);
          // Only backfill on reconnect; initial connect loads history in bootstrap.
          if (state === 'connected' && this.subscriptionId != null) {
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
    } catch (err) {
      this.emit('error', err);
      this.emit('connectionChange', 'disconnected');
    }
  }

  private async teardownSubscription(): Promise<void> {
    this.tickAggregator?.flush();
    this.tickAggregator = null;
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
      const history = await fetchChartHistory(this.options.dataProvider, {
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
    const reqs = this.activeVirtualWindow().planFetches();
    if (reqs.length === 0) return;

    this.loadingMore = true;
    try {
      const sortedTimesBefore = [...this.store.sortedTimes];
      let didPrepend = false;
      for (const req of reqs) {
        if (!this.isLoadGenerationCurrent(loadGen)) return;
        const history = await fetchChartHistory(
          this.options.dataProvider,
          toHistoryQuery(req),
        );
        if (!this.isLoadGenerationCurrent(loadGen)) return;
        if (history.bars.length === 0) continue;
        const prepend = req.mode === 'loadMore';
        if (prepend) didPrepend = true;
        await this.store.mergeBars(
          history.bars.map((bar) => ({ bar, source: 'rest' as const })),
          prepend,
        );
      }
      if (!this.isLoadGenerationCurrent(loadGen)) return;
      if (didPrepend && this.visibleRangeInitialized) {
        this.orchestrator.compensatePrependForBuses(
          sortedTimesBefore,
          this.store.sortedTimes,
          this.store.interval,
        );
      }
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
      this.activeVirtualWindow().setVisibleRange({
        fromMs: times[0]!,
        toMs: times[times.length - 1]!,
      });
      this.visibleRangeInitialized = true;
    }

    const bars = this.activeVirtualWindow().getBarsForRender();
    if (bars.length === 0) return;

    const gaps = this.features.gaps.whitespace
      ? computeGapStartTimes(
          bars.map((b) => b.t),
          this.store.interval,
        )
      : undefined;
    this.orchestrator.setBars(bars, gaps);
    // Viewport fit: resize all panes once without clearing integrator pane focus.
    this.orchestrator.resizeAllPanes();
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