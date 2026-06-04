import type { Bar } from '@coderyo/data';
import { ChartViewport } from './chart-viewport.js';
import { CandlestickRenderer } from './candlestick-renderer.js';
import { VolumeRenderer } from './volume-renderer.js';
import { WebGL2Context } from './webgl2-context.js';
import { ChartInteraction } from './chart-interaction.js';
import { mergeTheme, type ChartThemeColors } from './theme.js';
import { pushQuad, SolidBatchRenderer } from './solid-batch.js';
import type { ViewportSyncBus } from './viewport-sync-bus.js';

export interface WebGLChartPaneOptions {
  /** Fraction of height for volume pane (0–0.5). */
  volumeHeightRatio?: number;
  theme?: Partial<ChartThemeColors>;
  debug?: boolean;
  barSpacing?: number;
  /** When set, pan/zoom on this pane propagates to indicator followers. */
  syncBus?: ViewportSyncBus;
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
  private gridBatch: SolidBatchRenderer;
  private interaction: ChartInteraction | null = null;
  private syncBus: ViewportSyncBus | null = null;
  private rafId: number | null = null;
  private disposed = false;

  constructor(
    container: HTMLElement,
    opts: WebGLChartPaneOptions = {},
  ) {
    this.volumeRatio = clampRatio(opts.volumeHeightRatio ?? DEFAULT_VOLUME_RATIO);
    this.theme = mergeTheme(opts.theme);
    this.debug = opts.debug ?? false;
    this.viewport = new ChartViewport({ barSpacing: opts.barSpacing });
    this.context = new WebGL2Context(container, { debug: this.debug });
    const { gl } = this.context;

    this.candles = new CandlestickRenderer(gl, this.debug);
    this.volume = new VolumeRenderer(gl, this.debug);
    this.gridBatch = new SolidBatchRenderer(gl, this.debug);

    this.context.setContextHandlers({
      onRestored: () => {
        this.candles.onContextRestored();
        this.volume.onContextRestored();
        this.gridBatch.markDirty();
        this.scheduleRender();
      },
    });

    this.syncBus = opts.syncBus ?? null;
    this.interaction = new ChartInteraction(
      this.context.canvas,
      this.viewport,
      () => this.viewport.plotWidthPx(this.width),
      { requestRender: () => this.afterViewportChange() },
    );

    container.style.position = container.style.position || 'relative';
    container.style.overflow = 'hidden';
    container.style.touchAction = 'none';
  }

  /** Attach time-scale sync after orchestrator creates the bus (single pane init). */
  attachSyncBus(bus: ViewportSyncBus): void {
    this.syncBus = bus;
  }

  setVolumeHeightRatio(ratio: number): void {
    this.volumeRatio = clampRatio(ratio);
    this.scheduleRender();
  }

  setData(bars: readonly Bar[]): void {
    this.bars = bars.slice();
    this.viewport.setBarCount(this.bars.length);
    if (this.width > 0) {
      this.viewport.fitLatest(this.viewport.plotWidthPx(this.width));
    }
    this.afterViewportChange();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.width = cssWidth;
    this.context.resize(cssWidth, cssHeight);
    this.scheduleRender();
  }

  render(): void {
    if (this.disposed || this.context.isContextLost) return;

    const size = this.context.canvas;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0) return;

    const plotW = this.viewport.plotWidthPx(this.width || w);
    const mainH = Math.floor(h * (1 - this.volumeRatio) - PANE_GAP_PX);
    const volTop = mainH + PANE_GAP_PX;
    const volH = h - volTop;

    const { gl } = this.context;
    this.context.clear(this.theme.background);

    this.drawGrid(w, h, mainH, plotW);
    this.drawPaneDivider(w, mainH, h);

    const resolution: [number, number] = [w, h];

    this.candles.render({
      bars: this.bars,
      viewport: this.viewport,
      plotWidthPx: plotW,
      pane: { left: 0, top: 0, width: w, height: mainH },
      resolution,
      theme: this.theme,
    });

    this.volume.render({
      bars: this.bars,
      viewport: this.viewport,
      plotWidthPx: plotW,
      pane: { left: 0, top: volTop, width: w, height: volH },
      resolution,
      theme: this.theme,
    });

    gl.flush();
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
    this.gridBatch.dispose();
    this.context.destroy();
  }

  private afterViewportChange(): void {
    this.syncBus?.propagate();
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
  return Math.min(0.45, Math.max(0.12, r));
}