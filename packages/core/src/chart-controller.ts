import type { DataProvider, HistoryQuery, Interval, SubscribeParams } from '@tradview/data';
import type { HistoryRequest } from '@tradview/virtual-window';
import { parseInterval } from '@tradview/data';
import { BarStore } from '@tradview/series';
import { VirtualWindow, type FetchPolicy } from '@tradview/virtual-window';
import { DrawingManager } from '@tradview/drawings';
import { PaneOrchestrator } from '@tradview/renderer-lite';

export interface ChartOptions {
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
  interval?: Interval;
  symbol?: string;
  chartId?: string;
  /** Host element below main chart for MACD/RSI/KDJ panes (from ui-shell layout). */
  indicatorHost?: HTMLElement;
  dataProvider: DataProvider;
  fetchPolicy?: FetchPolicy;
  scaleMode?: 'linear' | 'log';
}

export type ChartEvent =
  | 'connectionChange'
  | 'barUpdate'
  | 'error'
  | 'visibleRangeChange'
  | 'symbolChange'
  | 'intervalChange'
  | 'crosshairChange'
  | 'destroyed';

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
  private drawingManager: DrawingManager | null = null;
  private offCrosshair: (() => void) | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: ChartOptions,
  ) {
    // container exposed via getContainer() for bridge/embed
    const symbol = options.symbol ?? 'BINANCE:BTCUSDT';
    const interval = parseInterval(options.interval ?? '1h');

    this.store = new BarStore(symbol, interval);
    this.virtualWindow = new VirtualWindow(this.store, {
      fetchPolicy: options.fetchPolicy ?? 'lazy-left-only',
    });
    this.orchestrator = new PaneOrchestrator({
      container,
      indicatorRoot: options.indicatorHost,
      theme: options.theme ?? 'dark',
      scaleMode: options.scaleMode ?? 'linear',
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
      this.drawingManager = new DrawingManager({
        canvas: overlay,
        chartId: options.chartId ?? 'default',
        symbol,
        interval,
        priceToY: (p) => this.orchestrator.priceToY(p),
        timeToX: (t) => this.orchestrator.timeToX(t),
        xToTime: (x) => this.orchestrator.xToTime(x),
        yToPrice: (y) => this.orchestrator.yToPrice(y),
      });
    }

    this.offCrosshair = this.orchestrator.subscribeCrosshair((payload) => {
      this.emit('crosshairChange', payload);
    });

    void this.bootstrap();
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

  async searchSymbols(query: string): Promise<import('@tradview/data').SymbolSearchHit[]> {
    if (!this.options.dataProvider.searchSymbols) return [];
    return this.options.dataProvider.searchSymbols(query);
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

  setDrawingTool(tool: import('@tradview/drawings').DrawingTool): this {
    this.drawingManager?.setTool(tool);
    return this;
  }

  async setSymbol(symbol: string): Promise<void> {
    await this.teardownSubscription();
    this.visibleRangeInitialized = false;
    this.orchestrator.resetViewState();
    await this.store.setSymbolInterval(symbol, this.store.interval);
    this.drawingManager?.setContext(symbol, this.store.interval);
    await this.bootstrap();
  }

  async setInterval(interval: Interval): Promise<void> {
    await this.teardownSubscription();
    this.visibleRangeInitialized = false;
    this.orchestrator.resetViewState();
    await this.store.setSymbolInterval(this.store.symbol, interval);
    this.drawingManager?.setContext(this.store.symbol, interval);
    await this.bootstrap();
  }

  setTheme(theme: 'dark' | 'light'): this {
    this.orchestrator.setTheme(theme);
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
    this.offCrosshair?.();
    this.offCrosshair = null;
    this.resizeObserver.disconnect();
    this.drawingManager?.destroy();
    void this.teardownSubscription();
    this.orchestrator.destroy();
    this.emit('destroyed', { chartId: this.options.chartId ?? 'default' });
    this.emit('connectionChange', 'disconnected');
  }

  private async bootstrap(): Promise<void> {
    if (this.destroyed) return;

    const endTime = Date.now();
    const history = await this.options.dataProvider.getHistory({
      mode: 'loadMore',
      symbol: this.store.symbol,
      interval: this.store.interval,
      endTime,
      limit: 500,
    });

    await this.store.mergeBars(history.bars.map((bar) => ({ bar })));
    this.refreshRender();
    this.emit('symbolChange', this.store.symbol);
    this.emit('intervalChange', this.store.interval);

    const params: SubscribeParams = {
      symbol: this.store.symbol,
      interval: this.store.interval,
      channels: ['bar'],
      streamMode: 'bar',
    };

    await this.options.dataProvider.connect?.();

    const sub = await this.options.dataProvider.subscribe(params, {
      onBar: (bar, meta) => {
        void this.store.mergeRealtime({
          bar,
          partial: meta.partial,
        }).then(() => this.refreshRender());
        this.emit('barUpdate', bar);
      },
      onConnectionChange: (state) => this.emit('connectionChange', state),
      onError: (err) => this.emit('error', err),
    });
    this.subscriptionId = sub.id;
  }

  private async teardownSubscription(): Promise<void> {
    if (this.subscriptionId) {
      await this.options.dataProvider.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }
  }

  private async maybeLoadMore(): Promise<void> {
    if (this.destroyed || this.loadingMore) return;
    const reqs = this.virtualWindow.planFetches();
    if (reqs.length === 0) return;

    this.loadingMore = true;
    try {
      for (const req of reqs) {
        const history = await this.options.dataProvider.getHistory(toHistoryQuery(req));
        if (history.bars.length === 0) continue;
        await this.store.mergeBars(
          history.bars.map((bar) => ({ bar, source: 'rest' as const })),
          req.mode === 'loadMore',
        );
      }
      this.refreshRender();
    } catch (err) {
      this.emit('error', err);
    } finally {
      this.loadingMore = false;
    }
  }

  private refreshRender(): void {
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