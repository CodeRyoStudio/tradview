import type { Bar } from '@coderyo/data';
import {
  DEFAULT_INDICATOR_CONFIG,
  isVolumePaneVisible,
  type IndicatorConfig,
} from '@coderyo/indicators';
import { ChartViewport } from './chart-viewport.js';
import { CandlestickRenderer } from './candlestick-renderer.js';
import { VolumeRenderer } from './volume-renderer.js';
import { WebGL2Context } from './webgl2-context.js';
import { ChartInteraction } from './chart-interaction.js';
import { mergeTheme, type ChartThemeColors } from './theme.js';
import { pushQuad, SolidBatchRenderer } from './solid-batch.js';
import type { ViewportSyncBus } from './viewport-sync-bus.js';
import { LineSeriesRenderer, type LineSeriesSpec } from './line-series-renderer.js';
import { buildMainOverlayLineSpecs } from './main-chart-overlays.js';
import { buildVolMaLineSpec } from './volume-overlays.js';
import type { MainPaneLayout } from './chart-coordinates.js';
import {
  maxVolumeForBars,
  priceRangeForBars,
  type PriceRange,
  type PriceScaleMode,
} from './price-scale.js';
import type { PriceBandKind, ScaleLayoutCss } from './scale/scale-interaction.js';
import { PaneScaleHost } from './scale/pane-scale-host.js';
import { hitTestScaleRegion } from './scale/scale-interaction.js';
import type { PriceScaleOptions, SymbolPriceFormat, TimeScaleOptions } from './scale/scale-types.js';
import { TIME_AXIS_CSS_PX } from './scale/scale-types.js';

export interface WebGLChartPaneOptions {
  /** Embedded volume band height: `0` = off; otherwise clamped to 0.12–0.45 of canvas. */
  volumeHeightRatio?: number;
  theme?: Partial<ChartThemeColors>;
  debug?: boolean;
  barSpacing?: number;
  /** When set, pan/zoom on this pane propagates to indicator followers. */
  syncBus?: ViewportSyncBus;
  timeZone?: string;
  /** Fired after pan/zoom (workspace time-scale link). */
  onViewportChange?: () => void;
}

const DEFAULT_VOLUME_RATIO = 0.22;
const PANE_GAP_PX = 2;

/**
 * Single-canvas chart pane: candlesticks (top) + volume histogram (bottom).
 */
export class WebGLChartPane {
  readonly viewport: ChartViewport;
  readonly context: WebGL2Context;

  private bars: Bar[] = [];
  private width = 0;
  private volumeRatio: number;
  private theme: ChartThemeColors;
  private readonly debug: boolean;

  private candles: CandlestickRenderer;
  private volume: VolumeRenderer;
  private overlays: LineSeriesRenderer;
  private gridBatch: SolidBatchRenderer;
  private indicatorConfig: IndicatorConfig = DEFAULT_INDICATOR_CONFIG;
  private interaction: ChartInteraction | null = null;
  private syncBus: ViewportSyncBus | null = null;
  private rafId: number | null = null;
  private disposed = false;
  private priceScaleMode: PriceScaleMode = 'linear';
  private priceAxisPosition: 'left' | 'right' = 'right';
  private pineOverlayLines: LineSeriesSpec[] = [];
  private showGrid = true;
  private readonly scaleHost: PaneScaleHost;
  private crosshairPrice: number | null = null;
  private crosshairTimeMs: number | null = null;
  private readonly onViewportChange?: () => void;
  /** First fit deferred until pane has non-zero width. */
  private pendingInitialFit = false;

  constructor(
    container: HTMLElement,
    opts: WebGLChartPaneOptions = {},
  ) {
    this.volumeRatio = clampRatio(opts.volumeHeightRatio ?? DEFAULT_VOLUME_RATIO);
    this.theme = mergeTheme(opts.theme);
    this.debug = opts.debug ?? false;
    this.viewport = new ChartViewport({ barSpacing: opts.barSpacing });
    this.context = new WebGL2Context(container, { debug: this.debug });
    this.onViewportChange = opts.onViewportChange;

    this.scaleHost = new PaneScaleHost(container, {
      interactionElement: this.context.canvas,
      getAutoPriceRange: (band) =>
        band === 'volume' ? this.autoVolumePriceRange() : this.autoMainPriceRange(),
      requestRender: () => this.afterViewportChange(),
      getCssLayout: () => this.getScaleLayoutCss(),
      priceScaleMode: () => this.priceScaleMode,
      enableTimeInteraction: true,
    });
    this.scaleHost.bindViewport(this.viewport);
    if (opts.timeZone) this.scaleHost.setTimezone(opts.timeZone);

    const { gl } = this.context;

    this.candles = new CandlestickRenderer(gl, this.debug);
    this.volume = new VolumeRenderer(gl, this.debug);
    this.overlays = new LineSeriesRenderer(gl, this.debug);
    this.gridBatch = new SolidBatchRenderer(gl, this.debug);

    this.context.setContextHandlers({
      onRestored: () => {
        this.candles.onContextRestored();
        this.volume.onContextRestored();
        this.overlays.onContextRestored();
        this.gridBatch.markDirty();
        this.scheduleRender();
      },
    });

    this.syncBus = opts.syncBus ?? null;
    this.interaction = new ChartInteraction(
      this.context.canvas,
      this.viewport,
      () => this.viewport.plotWidthPx(this.width),
      {
        requestRender: () => this.afterViewportChange(),
        shouldHandlePlotPointer: (e) => this.shouldHandlePlotPointer(e),
        resolvePriceBand: (e) => this.resolvePlotPriceBand(e),
        getPlotHeight: (band) => this.plotHeightForBand(band),
        onPricePan: (dy, plotH, band) => {
          this.scaleHost.panPriceRange(band, dy, plotH);
        },
      },
    );

    container.style.position = container.style.position || 'relative';
    container.style.overflow = 'hidden';
    container.style.touchAction = 'none';
  }

  applyPriceScaleOptions(opts: Partial<PriceScaleOptions>): void {
    this.scaleHost.applyPriceScaleOptions(opts);
    if (opts.position) {
      this.priceAxisPosition = opts.position;
      this.viewport.setPriceAxisPosition(opts.position);
    }
    this.scheduleRender();
  }

  getEffectiveMainPriceRange(): PriceRange {
    return this.scaleHost.getEffectivePriceRange(this.autoMainPriceRange(), 'price');
  }

  getScaleOverlayCanvas(): HTMLCanvasElement {
    return this.scaleHost.getOverlayCanvas();
  }

  applyTimeScaleOptions(opts: Partial<TimeScaleOptions>): void {
    this.scaleHost.applyTimeScaleOptions(opts);
    this.scheduleRender();
  }

  setSymbolPriceFormat(format: SymbolPriceFormat): void {
    this.scaleHost.setSymbolPriceFormat(format);
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

  /** Attach time-scale sync after orchestrator creates the bus (single pane init). */
  attachSyncBus(bus: ViewportSyncBus): void {
    this.syncBus = bus;
  }

  setVolumeHeightRatio(ratio: number): void {
    this.volumeRatio = clampRatio(ratio);
    this.scheduleRender();
  }

  setData(bars: readonly Bar[], options?: { fitViewport?: boolean }): void {
    this.bars = bars.slice();
    this.viewport.setBarCount(this.bars.length);
    if (options?.fitViewport) {
      this.applyInitialViewportFit();
    }
    this.afterViewportChange();
  }

  setIndicatorConfig(config: IndicatorConfig): void {
    this.indicatorConfig = config;
    this.scheduleRender();
  }

  getIndicatorConfig(): IndicatorConfig {
    return this.indicatorConfig;
  }

  setLogScale(enabled: boolean): void {
    this.priceScaleMode = enabled ? 'log' : 'linear';
    this.scheduleRender();
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.scheduleRender();
  }

  getPriceScaleMode(): PriceScaleMode {
    return this.priceScaleMode;
  }

  setPineOverlayLines(lines: readonly LineSeriesSpec[]): void {
    this.pineOverlayLines = lines.slice();
    this.scheduleRender();
  }

  /** WebGL chart surface (pan/zoom + drawing hit-test host). */
  getChartCanvas(): HTMLCanvasElement {
    return this.context.canvas;
  }

  /** Layout metrics for drawing overlay coordinate mapping (V2-R9). */
  getLayoutMetrics(): MainPaneLayout | null {
    const size = this.context.canvas;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0) return null;
    const cssWidth =
      this.width ||
      size.clientWidth ||
      w / (globalThis.devicePixelRatio ?? 1);
    const volRatio = this.activeVolumeRatio();
    const mainH =
      volRatio > 0 ? Math.floor(h * (1 - volRatio) - PANE_GAP_PX) : h;
    return {
      canvasWidth: w,
      canvasHeight: h,
      mainPaneHeight: Math.max(1, mainH),
      cssWidth,
    };
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.width = cssWidth;
    const size = this.context.resize(cssWidth, cssHeight);
    this.scaleHost.resize(cssWidth, cssHeight, size.dpr);
    if (this.pendingInitialFit) {
      this.applyInitialViewportFit();
    }
    this.scheduleRender();
  }

  render(): void {
    if (this.disposed || this.context.isContextLost) return;

    const size = this.context.canvas;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0) return;

    const cssWidth = this.width || w / (globalThis.devicePixelRatio ?? 1);
    const dpr = w / Math.max(1, cssWidth);
    const plotW = this.viewport.plotWidthPx(cssWidth);
    const volRatio = this.activeVolumeRatio();
    const mainH =
      volRatio > 0 ? Math.floor(h * (1 - volRatio) - PANE_GAP_PX) : h;
    const volTop = mainH + PANE_GAP_PX;
    const volH = h - volTop;

    const { gl } = this.context;
    this.context.clear(this.theme.background);

    if (this.showGrid) {
      this.drawGrid(w, h, mainH, plotW);
    }
    if (volRatio > 0) {
      this.drawPaneDivider(w, mainH, h);
    }

    const resolution: [number, number] = [w, h];
    const mainPane = { left: 0, top: 0, width: w, height: mainH };
    const { from, to } = this.viewport.visibleBarIndexRange();
    const autoMainRange = priceRangeForBars(this.bars, from, to, this.priceScaleMode);
    const mainRange = this.scaleHost.getEffectivePriceRange(autoMainRange, 'price');
    const lastBar = this.bars[this.bars.length - 1];
    const lastPrice = lastBar?.c ?? null;

    this.candles.render({
      bars: this.bars,
      viewport: this.viewport,
      plotWidthPx: plotW,
      cssWidth,
      dpr,
      pane: mainPane,
      resolution,
      theme: this.theme,
      priceScaleMode: this.priceScaleMode,
      priceRange: mainRange,
    });

    const overlayLines = [
      ...buildMainOverlayLineSpecs(this.bars, this.indicatorConfig),
      ...this.pineOverlayLines,
    ];
    if (overlayLines.length > 0 && to >= from) {
      this.overlays.render({
        viewport: this.viewport,
        plotWidthPx: plotW,
        cssWidth,
        dpr,
        pane: mainPane,
        resolution,
        lines: overlayLines,
        priceRange: mainRange,
      });
    }

    const priceBands: Array<{
      top: number;
      bottom: number;
      range: PriceRange;
      mode?: PriceScaleMode;
      kind: 'price' | 'volume';
    }> = [{ top: 0, bottom: mainH, range: autoMainRange, mode: this.priceScaleMode, kind: 'price' }];

    if (volRatio > 0) {
      const volAuto = this.autoVolumePriceRange();
      const volRange = this.scaleHost.getEffectivePriceRange(volAuto, 'volume');
      const volPane = { left: 0, top: volTop, width: w, height: volH };
      this.volume.render({
        bars: this.bars,
        viewport: this.viewport,
        plotWidthPx: plotW,
        cssWidth,
        dpr,
        pane: volPane,
        resolution,
        theme: this.theme,
        volumeRange: volRange,
      });
      const volMa = buildVolMaLineSpec(this.bars, this.indicatorConfig);
      if (volMa && to >= from) {
        this.overlays.render({
          viewport: this.viewport,
          plotWidthPx: plotW,
          cssWidth,
          dpr,
          pane: volPane,
          resolution,
          lines: [volMa],
          priceRange: volRange,
        });
      }
    }

    gl.flush();

    const volTopCss = volRatio > 0 ? volTop / dpr : undefined;
    const hCss = h / dpr;

    this.scaleHost.draw({
      deviceWidth: w,
      deviceHeight: h,
      cssWidth,
      dpr,
      viewport: this.viewport,
      bars: this.bars,
      priceScaleMode: this.priceScaleMode,
      crosshairPrice: this.crosshairPrice,
      crosshairTimeMs: this.crosshairTimeMs,
      lastPrice,
      volumeBandTopCss: volTopCss,
      volumeBandBottomCss: volRatio > 0 ? hCss : undefined,
      priceBands:
        volRatio > 0
          ? [
              ...priceBands,
              {
                top: volTop,
                bottom: h,
                range: this.autoVolumePriceRange(),
                kind: 'volume',
              },
            ]
          : priceBands,
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
    this.candles.dispose();
    this.volume.dispose();
    this.overlays.dispose();
    this.gridBatch.dispose();
    this.scaleHost.destroy();
    this.context.destroy();
  }

  private applyInitialViewportFit(): void {
    if (this.bars.length === 0) {
      this.pendingInitialFit = false;
      return;
    }
    if (this.width > 0) {
      this.viewport.fitLatest(this.viewport.plotWidthPx(this.width));
      this.pendingInitialFit = false;
      return;
    }
    this.pendingInitialFit = true;
  }

  private autoMainPriceRange() {
    const { from, to } = this.viewport.visibleBarIndexRange();
    return priceRangeForBars(this.bars, from, to, this.priceScaleMode);
  }

  private shouldHandlePlotPointer(e: PointerEvent | WheelEvent): boolean {
    const rect = this.context.canvas.getBoundingClientRect();
    const region = hitTestScaleRegion(this.viewport, {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      priceAxisPosition: this.priceAxisPosition,
      ...this.getScaleLayoutCss(),
    });
    return region === 'plot';
  }

  private resolvePlotPriceBand(e: PointerEvent): PriceBandKind {
    if (!this.isVolumeVisible()) return 'price';
    const rect = this.context.canvas.getBoundingClientRect();
    const layout = this.getScaleLayoutCss();
    const canvasY = e.clientY - rect.top;
    if (
      layout.volumeBandTop != null &&
      canvasY >= layout.volumeBandTop &&
      canvasY < layout.cssHeight - TIME_AXIS_CSS_PX
    ) {
      return 'volume';
    }
    return 'price';
  }

  private isVolumeVisible(): boolean {
    return isVolumePaneVisible(this.indicatorConfig);
  }

  private activeVolumeRatio(): number {
    return this.isVolumeVisible() ? this.volumeRatio : 0;
  }

  private plotHeightForBand(band: PriceBandKind): number {
    const layout = this.getScaleLayoutCss();
    if (band === 'volume' && layout.volumeBandTop != null && layout.volumeBandBottom != null) {
      return Math.max(1, layout.volumeBandBottom - layout.volumeBandTop);
    }
    return Math.max(1, layout.mainPaneHeight);
  }

  private getScaleLayoutCss(): ScaleLayoutCss {
    const cssWidth = this.width || this.context.canvas.clientWidth || 800;
    const cssHeight = this.context.canvas.clientHeight || 400;
    const volRatio = this.activeVolumeRatio();
    const mainPaneHeight = Math.max(
      1,
      volRatio > 0
        ? Math.floor(cssHeight * (1 - volRatio) - PANE_GAP_PX)
        : cssHeight,
    );
    const volTopCss = mainPaneHeight + PANE_GAP_PX;
    return {
      cssWidth,
      cssHeight,
      mainPaneHeight,
      volumeBandTop: volRatio > 0 ? volTopCss : undefined,
      volumeBandBottom: volRatio > 0 ? cssHeight : undefined,
    };
  }

  private autoVolumePriceRange(): PriceRange {
    const { from, to } = this.viewport.visibleBarIndexRange();
    const max = maxVolumeForBars(this.bars, from, to);
    return { min: 0, max };
  }

  private afterViewportChange(): void {
    this.syncBus?.propagate();
    this.onViewportChange?.();
    this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.disposed || this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  private drawGrid(canvasW: number, canvasH: number, mainH: number, plotW: number): void {
    const lines: number[] = [];
    const hLines = 5;
    for (let i = 1; i < hLines; i++) {
      const y = (mainH * i) / hLines;
      pushQuad(lines, 0, y, canvasW, y + 1, this.theme.grid);
    }
    const { from, to } = this.viewport.visibleBarIndexRange();
    const count = Math.max(0, to - from + 1);
    const vLines = Math.min(8, Math.max(3, Math.floor(count / 12)));
    for (let i = 1; i < vLines; i++) {
      const x = (plotW * i) / vLines;
      pushQuad(lines, x, 0, x + 1, mainH, this.theme.grid);
    }
    if (lines.length === 0) return;
    if (!this.gridBatch.ensureReady()) return;
    this.gridBatch.draw(new Float32Array(lines), [canvasW, canvasH]);
  }

  private drawPaneDivider(canvasW: number, mainH: number, canvasH: number): void {
    const lines: number[] = [];
    pushQuad(lines, 0, mainH, canvasW, mainH + PANE_GAP_PX, [0.2, 0.22, 0.27, 1]);
    if (!this.gridBatch.ensureReady()) return;
    this.gridBatch.draw(new Float32Array(lines), [canvasW, canvasH]);
  }
}

function clampRatio(r: number): number {
  if (r <= 0) return 0;
  return Math.min(0.45, Math.max(0.12, r));
}