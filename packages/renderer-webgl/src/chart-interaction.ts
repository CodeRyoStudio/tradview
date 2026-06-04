import type { ChartViewport } from './chart-viewport.js';

/**
 * Map wheel client coordinates to plot-local X, or null when over the price gutter.
 */
export function resolveWheelPlotAnchor(
  viewport: ChartViewport,
  clientX: number,
  rectLeft: number,
  totalWidthPx: number,
): { plotX: number; plotWidthPx: number } | null {
  const canvasX = clientX - rectLeft;
  if (!viewport.isPlotCanvasX(canvasX, totalWidthPx)) return null;
  const plotWidthPx = viewport.plotWidthPx(totalWidthPx);
  return {
    plotX: viewport.plotXFromCanvasX(canvasX, totalWidthPx),
    plotWidthPx,
  };
}

export interface ChartInteractionHandlers {
  onPan?: (deltaBars: number) => void;
  onZoom?: (deltaSpacing: number, anchorPlotX: number) => void;
  requestRender: () => void;
}

/**
 * Mouse wheel zoom + drag pan on a chart surface.
 */
export class ChartInteraction {
  private dragging = false;
  private lastX = 0;

  constructor(
    private readonly element: HTMLElement,
    private readonly viewport: ChartViewport,
    private readonly getPlotWidth: () => number,
    private readonly handlers: ChartInteractionHandlers,
  ) {
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('pointerleave', this.onPointerLeave);
  }

  destroy(): void {
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.element.getBoundingClientRect();
    const anchor = resolveWheelPlotAnchor(
      this.viewport,
      e.clientX,
      rect.left,
      rect.width,
    );
    if (!anchor) return;

    const delta = e.deltaY > 0 ? -0.8 : 0.8;
    this.viewport.zoomBarSpacing(delta, anchor.plotX, anchor.plotWidthPx);
    this.handlers.onZoom?.(delta, anchor.plotX);
    this.handlers.requestRender();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.element.setPointerCapture(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    const plotWidth = this.getPlotWidth();
    const span = this.viewport.visibleSpan;
    if (span <= 0) return;
    const deltaBars = (-dx / Math.max(1, plotWidth)) * span;
    this.viewport.pan(deltaBars);
    this.handlers.onPan?.(deltaBars);
    this.handlers.requestRender();
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  private readonly onPointerLeave = (): void => {
    this.dragging = false;
  };
}