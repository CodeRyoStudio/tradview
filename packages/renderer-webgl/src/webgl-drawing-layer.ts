import {
  DrawingManager,
  type DrawingTool,
  type DrawingRecord,
  type DrawingStyleMeta,
} from '@coderyo/drawings';
import type { Bar } from '@coderyo/data';
import type { ChartViewport } from './chart-viewport.js';
import {
  createChartCoordinateMapper,
  type ChartCoordinateMapperOptions,
  type MainPaneLayout,
} from './chart-coordinates.js';

export interface WebGLDrawingLayerOptions {
  parent: HTMLElement;
  interactionHost: HTMLElement;
  chartId: string;
  symbol: string;
  interval: string;
  getViewport: () => ChartViewport | null;
  getBars: () => readonly Bar[];
  getLayout: () => MainPaneLayout | null;
  getCoordinateContext?: () => ChartCoordinateMapperOptions | null;
}

/**
 * 2D overlay for {@link DrawingManager} on top of a WebGL chart pane (V2-R10).
 * Text labels use canvas 2D (OQ-V2-1: no MSDF in renderer-webgl).
 */
export class WebGLDrawingLayer {
  readonly overlayCanvas: HTMLCanvasElement;
  private readonly manager: DrawingManager;
  private visible = true;

  constructor(private readonly opts: WebGLDrawingLayerOptions) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    opts.parent.style.position = opts.parent.style.position || 'relative';
    opts.parent.appendChild(canvas);
    this.overlayCanvas = canvas;

    this.manager = new DrawingManager({
      canvas,
      interactionHost: opts.interactionHost,
      chartId: opts.chartId,
      symbol: opts.symbol,
      interval: opts.interval,
      priceToY: (p) => this.mapper()?.priceToY(p) ?? null,
      timeToX: (t) => this.mapper()?.timeToX(t) ?? null,
      xToTime: (x) => this.mapper()?.xToTime(x) ?? null,
      yToPrice: (y) => this.mapper()?.yToPrice(y) ?? null,
    });
  }

  setContext(symbol: string, interval: string): void {
    this.manager.setContext(symbol, interval);
  }

  setLayerVisible(visible: boolean): void {
    this.visible = visible;
    this.manager.setLayerVisible(visible);
  }

  setTool(tool: DrawingTool): void {
    this.manager.setTool(tool);
  }

  getTool(): DrawingTool {
    return this.manager.getTool();
  }

  redraw(): void {
    if (!this.visible) return;
    this.manager.redraw();
  }

  deleteSelected(): boolean {
    return this.manager.deleteSelected();
  }

  getSelected(): DrawingRecord | null {
    return this.manager.getSelected();
  }

  clearAll(): number {
    return this.manager.clearAll();
  }

  updateSelectedStyle(patch: DrawingStyleMeta): void {
    this.manager.updateSelectedStyle(patch);
  }

  /** Match WebGL canvas CSS size and device-pixel bitmap. */
  syncOverlaySize(cssWidth: number, cssHeight: number): void {
    const dpr = globalThis.devicePixelRatio ?? 1;
    const w = Math.max(1, Math.floor(cssWidth * dpr));
    const h = Math.max(1, Math.floor(cssHeight * dpr));
    if (this.overlayCanvas.width !== w || this.overlayCanvas.height !== h) {
      this.overlayCanvas.width = w;
      this.overlayCanvas.height = h;
    }
    this.redraw();
  }

  destroy(): void {
    this.manager.destroy();
    this.overlayCanvas.remove();
  }

  private mapper() {
    const vp = this.opts.getViewport();
    const layout = this.opts.getLayout();
    if (!vp || !layout) return null;
    const ctx = this.opts.getCoordinateContext?.() ?? {};
    return createChartCoordinateMapper(vp, this.opts.getBars(), layout, ctx);
  }
}