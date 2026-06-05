import type { Bar } from '@coderyo/data';
import { isVolumePaneVisible, type IndicatorConfig } from '@coderyo/indicators';
import { ChartViewport } from './chart-viewport.js';
import { LineSeriesRenderer } from './line-series-renderer.js';
import { VolumeRenderer } from './volume-renderer.js';
import { buildVolMaLineSpec } from './volume-overlays.js';
import { WebGL2Context } from './webgl2-context.js';
import { mergeTheme, type ChartThemeColors } from './theme.js';
import type { ViewportSyncBus } from './viewport-sync-bus.js';
import { PaneScaleHost } from './scale/pane-scale-host.js';
import { hitTestScaleRegion, type ScaleLayoutCss } from './scale/scale-interaction.js';
import { ChartInteraction } from './chart-interaction.js';
import { maxVolumeForBars, type PriceRange } from './price-scale.js';
import type { PriceScaleOptions, TimeScaleOptions } from './scale/scale-types.js';
import { TIME_AXIS_CSS_PX } from './scale/scale-types.js';

export interface WebGLVolumePaneOptions {
  theme?: Partial<ChartThemeColors>;
  debug?: boolean;
  /** When set, time pan/zoom follow the main chart via {@link ViewportSyncBus}. */
  syncBus?: ViewportSyncBus;
  timeZone?: string;
}

/**
 * Standalone volume histogram pane (layer compositor `volumeMount`).
 * Independent volume price axis; optional time sync with main chart.
 */
export class WebGLVolumePane {
  readonly viewport: ChartViewport;
  readonly context: WebGL2Context;

  private readonly volume: VolumeRenderer;
  private readonly volMaLines: LineSeriesRenderer;
  private readonly theme: ChartThemeColors;
  private readonly debug: boolean;
  private readonly syncBus: ViewportSyncBus | undefined;
  private readonly syncUnregister: (() => void) | null;
  private readonly scaleHost: PaneScaleHost;
  private interaction: ChartInteraction | null = null;

  private bars: Bar[] = [];
  private config: IndicatorConfig | null = null;
  private width = 0;
  private height = 0;
  private disposed = false;
  private rafId: number | null = null;
  private crosshairPrice: number | null = null;
  private crosshairTimeMs: number | null = null;

  constructor(
    private readonly container: HTMLElement,
    opts: WebGLVolumePaneOptions = {},
  ) {
    this.theme = mergeTheme(opts.theme);
    this.debug = opts.debug ?? false;
    this.viewport = new ChartViewport();
    this.context = new WebGL2Context(container, { debug: this.debug });
    this.volume = new VolumeRenderer(this.context.gl, this.debug);
    this.volMaLines = new LineSeriesRenderer(this.context.gl, this.debug);
    this.syncBus = opts.syncBus;
    this.syncUnregister = opts.syncBus?.register(this.viewport) ?? null;
    const followsMaster = opts.syncBus != null;

    this.scaleHost = new PaneScaleHost(container, {
      interactionElement: this.context.canvas,
      getAutoPriceRange: () => this.autoVolumePriceRange(),
      requestRender: () => this.scheduleRender(),
      getCssLayout: () => this.getScaleLayoutCss(),
      enableTimeInteraction: !followsMaster,
    });
    this.scaleHost.bindViewport(this.viewport);
    if (opts.timeZone) this.scaleHost.setTimezone(opts.timeZone);

    container.style.position = container.style.position || 'relative';
    container.style.overflow = 'hidden';
    container.style.touchAction = 'none';
    container.style.minHeight = '48px';

    this.interaction = new ChartInteraction(
      this.context.canvas,
      this.viewport,
      () => this.viewport.plotWidthPx(this.width),
      {
        requestRender: () => this.scheduleRender(),
        shouldHandlePlotPointer: (e) => this.shouldHandlePlotPointer(e),
        enableTimePan: () => !this.syncBus,
        enablePricePan: () => true,
        resolvePriceBand: () => 'volume',
        getPlotHeight: () => this.plotHeightCss(),
        onPricePan: (dy, plotH) => {
          this.scaleHost.panPriceRange('volume', dy, plotH);
        },
      },
    );

    this.context.setContextHandlers({
      onRestored: () => {
        this.volume.onContextRestored();
        this.volMaLines.onContextRestored();
        this.scheduleRender();
      },
    });
  }

  applyPriceScaleOptions(opts: Partial<PriceScaleOptions>): void {
    const { position: _position, ...rest } = opts;
    this.scaleHost.applyPriceScaleOptions(rest);
    this.scheduleRender();
  }

  applyTimeScaleOptions(opts: Partial<TimeScaleOptions>): void {
    this.scaleHost.applyTimeScaleOptions(opts);
    this.scheduleRender();
  }

  setTimezone(timeZone: string): void {
    this.scaleHost.setTimezone(timeZone);
    this.scheduleRender();
  }

  setCrosshairReadout(price: number | null, timeMs: number | null): void {
    this.crosshairPrice = price;
    this.crosshairTimeMs = timeMs;
    this.scheduleRender();
  }

  setData(bars: readonly Bar[], config: IndicatorConfig): void {
    this.bars = bars.slice();
    this.config = config;
    this.viewport.setBarCount(this.bars.length);
    this.scheduleRender();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.width = cssWidth;
    this.height = cssHeight;
    const size = this.context.resize(cssWidth, cssHeight);
    this.scaleHost.resize(cssWidth, cssHeight, size.dpr);
    this.scheduleRender();
  }

  render(): void {
    if (this.disposed || this.context.isContextLost) return;
    if (!this.config || !isVolumePaneVisible(this.config)) return;

    const size = this.context.canvas;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0 || this.bars.length === 0) return;

    const cssWidth = this.width || w / (globalThis.devicePixelRatio ?? 1);
    const dpr = w / Math.max(1, cssWidth);
    const plotW = this.viewport.plotWidthPx(cssWidth);
    const pane = { left: 0, top: 0, width: w, height: h };
    const resolution: [number, number] = [w, h];

    this.context.clear(this.theme.background);

    const volAuto = this.autoVolumePriceRange();
    const volRange = this.scaleHost.getEffectivePriceRange(volAuto, 'volume');
    const { from, to } = this.viewport.visibleBarIndexRange();
    this.volume.render({
      bars: this.bars,
      viewport: this.viewport,
      plotWidthPx: plotW,
      cssWidth,
      dpr,
      pane,
      resolution,
      theme: this.theme,
      volumeRange: volRange,
    });
    const volMa = this.config ? buildVolMaLineSpec(this.bars, this.config) : null;
    if (volMa && to >= from) {
      this.volMaLines.render({
        viewport: this.viewport,
        plotWidthPx: plotW,
        cssWidth,
        dpr,
        pane,
        resolution,
        lines: [volMa],
        priceRange: volRange,
      });
    }
    this.context.gl.flush();

    this.scaleHost.draw({
      deviceWidth: w,
      deviceHeight: h,
      cssWidth,
      dpr,
      viewport: this.viewport,
      bars: this.bars,
      showTimeAxis: true,
      crosshairPrice: this.crosshairPrice,
      crosshairTimeMs: this.crosshairTimeMs,
      priceBands: [{ top: 0, bottom: h, range: volAuto, kind: 'volume' }],
    });
  }

  destroy(): void {
    this.disposed = true;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.interaction?.destroy();
    this.interaction = null;
    this.syncUnregister?.();
    this.volume.dispose();
    this.volMaLines.dispose();
    this.scaleHost.destroy();
    this.context.destroy();
    this.container.replaceChildren();
  }

  private autoVolumePriceRange(): PriceRange {
    const { from, to } = this.viewport.visibleBarIndexRange();
    const max = maxVolumeForBars(this.bars, from, to);
    return { min: 0, max };
  }

  private plotHeightCss(): number {
    const cssHeight = this.height || this.context.canvas.clientHeight || 72;
    return Math.max(1, cssHeight - TIME_AXIS_CSS_PX);
  }

  private getScaleLayoutCss(): ScaleLayoutCss {
    const cssWidth = this.width || this.context.canvas.clientWidth || 400;
    const cssHeight = this.height || this.context.canvas.clientHeight || 72;
    return { cssWidth, cssHeight, mainPaneHeight: this.plotHeightCss() };
  }

  private shouldHandlePlotPointer(e: PointerEvent | WheelEvent): boolean {
    const rect = this.context.canvas.getBoundingClientRect();
    const region = hitTestScaleRegion(this.viewport, {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      ...this.getScaleLayoutCss(),
    });
    return region === 'plot';
  }

  private scheduleRender(): void {
    if (this.disposed || this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }
}