import type { DataProvider, Interval, SubscribeParams } from '@tradview/data';
import { parseInterval } from '@tradview/data';
import { BarStore } from '@tradview/series';
import { VirtualWindow, type FetchPolicy } from '@tradview/virtual-window';
import { PaneOrchestrator } from '@tradview/renderer-lite';

export interface ChartOptions {
  width?: number;
  height?: number;
  theme?: 'dark' | 'light';
  interval?: Interval;
  symbol?: string;
  dataProvider: DataProvider;
  fetchPolicy?: FetchPolicy;
  scaleMode?: 'linear' | 'log';
}

export type ChartEvent =
  | 'connectionChange'
  | 'barUpdate'
  | 'error'
  | 'visibleRangeChange';

type EventHandler = (payload?: unknown) => void;

export class ChartController {
  private readonly store: BarStore;
  private readonly virtualWindow: VirtualWindow;
  private readonly orchestrator: PaneOrchestrator;
  private readonly handlers = new Map<ChartEvent, Set<EventHandler>>();
  private subscriptionId: string | null = null;
  private destroyed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: ChartOptions,
  ) {
    const symbol = options.symbol ?? 'BINANCE:BTCUSDT';
    const interval = parseInterval(options.interval ?? '1h');

    this.store = new BarStore(symbol, interval);
    this.virtualWindow = new VirtualWindow(this.store, {
      fetchPolicy: options.fetchPolicy ?? 'lazy-left-only',
    });
    this.orchestrator = new PaneOrchestrator({
      container,
      theme: options.theme ?? 'dark',
      scaleMode: options.scaleMode ?? 'linear',
    });

    if (options.width) container.style.width = `${options.width}px`;
    if (options.height) container.style.height = `${options.height}px`;

    void this.bootstrap();
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

  async setSymbol(symbol: string): Promise<void> {
    await this.teardownSubscription();
    await this.store.setSymbolInterval(symbol, this.store.interval);
    await this.bootstrap();
  }

  async setInterval(interval: Interval): Promise<void> {
    await this.teardownSubscription();
    await this.store.setSymbolInterval(this.store.symbol, interval);
    await this.bootstrap();
  }

  setTheme(theme: 'dark' | 'light'): this {
    this.orchestrator.setTheme(theme);
    return this;
  }

  fitContent(): this {
    return this;
  }

  scrollToRealtime(): this {
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
    this.destroyed = true;
    void this.teardownSubscription();
    this.orchestrator.destroy();
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

  private refreshRender(): void {
    const bars = this.virtualWindow.getBarsForRender();
    if (bars.length === 0) return;
    this.virtualWindow.setVisibleRange({
      fromMs: bars[0]!.t,
      toMs: bars[bars.length - 1]!.t,
    });
    this.orchestrator.setBars(bars);
    this.emit('visibleRangeChange', {
      from: bars[0]!.t,
      to: bars[bars.length - 1]!.t,
    });
  }

  private emit(event: ChartEvent, payload?: unknown): void {
    for (const h of this.handlers.get(event) ?? []) h(payload);
  }
}