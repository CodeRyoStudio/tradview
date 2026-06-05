import type { ChartViewport } from '../chart-viewport.js';
import type { PriceRange, PriceScaleMode } from '../price-scale.js';
import { scalePriceRange } from './price-scale-engine.js';
import { TIME_AXIS_CSS_PX } from './scale-types.js';

export type ScaleHitRegion =
  | 'plot'
  | 'price-axis'
  | 'volume-price-axis'
  | 'time-axis'
  | 'none';

export type PriceBandKind = 'price' | 'volume';

export interface ScaleLayoutCss {
  cssWidth: number;
  cssHeight: number;
  mainPaneHeight: number;
  volumeBandTop?: number;
  volumeBandBottom?: number;
}

export interface ScaleHitTestInput extends ScaleLayoutCss {
  canvasX: number;
  canvasY: number;
  priceAxisPosition?: 'left' | 'right';
}

/** Classify pointer position for scale vs plot interaction (CSS coordinates). */
export function hitTestScaleRegion(
  viewport: ChartViewport,
  input: ScaleHitTestInput,
): ScaleHitRegion {
  const {
    canvasX,
    canvasY,
    cssWidth,
    cssHeight,
    mainPaneHeight,
    volumeBandTop,
    volumeBandBottom,
  } = input;
  const plotW = viewport.plotWidthPx(cssWidth);
  const timeAxisH = TIME_AXIS_CSS_PX;
  const position = input.priceAxisPosition ?? 'right';

  if (canvasY >= cssHeight - timeAxisH && canvasY <= cssHeight) {
    return 'time-axis';
  }

  const inPriceGutterX =
    position === 'right'
      ? canvasX >= cssWidth - viewport.rightPaddingPx && canvasX <= cssWidth
      : canvasX >= 0 && canvasX < viewport.leftPaddingPx;

  if (
    volumeBandTop != null &&
    volumeBandBottom != null &&
    canvasY >= volumeBandTop &&
    canvasY <= volumeBandBottom &&
    inPriceGutterX
  ) {
    return 'volume-price-axis';
  }

  if (inPriceGutterX && canvasY >= 0 && canvasY <= mainPaneHeight) {
    return 'price-axis';
  }

  const plotBottom = cssHeight - timeAxisH;
  if (
    viewport.isPlotCanvasX(canvasX, cssWidth) &&
    canvasY >= 0 &&
    canvasY < plotBottom
  ) {
    return 'plot';
  }

  return 'none';
}

export function regionToBandKind(region: ScaleHitRegion): PriceBandKind | null {
  if (region === 'price-axis') return 'price';
  if (region === 'volume-price-axis') return 'volume';
  return null;
}

export interface ScaleInteractionCallbacks {
  requestRender: () => void;
  onPriceRangeOverride?: (band: PriceBandKind, range: PriceRange | null) => void;
  getAutoPriceRange: (band: PriceBandKind) => PriceRange;
  getPriceRangeOverride: (band: PriceBandKind) => PriceRange | null;
}

export interface ScaleInteractionOptions {
  viewport: ChartViewport;
  getLayout: () => ScaleLayoutCss;
  priceAxisPosition?: () => 'left' | 'right';
  priceScaleMode?: () => PriceScaleMode;
  enableTimeInteraction?: () => boolean;
  callbacks: ScaleInteractionCallbacks;
}

export interface ScaleWheelInput {
  region: ScaleHitRegion;
  deltaY: number;
  anchorPlotX: number;
  plotWidthCss: number;
}

export function applyScaleWheel(
  viewport: ChartViewport,
  opts: ScaleInteractionOptions,
  input: ScaleWheelInput,
): void {
  const { callbacks } = opts;
  const mode = opts.priceScaleMode?.() ?? 'linear';

  if (input.region === 'time-axis') {
    if (opts.enableTimeInteraction?.() === false) return;
    const delta = input.deltaY > 0 ? -0.8 : 0.8;
    viewport.zoomBarSpacing(delta, input.anchorPlotX, input.plotWidthCss);
    callbacks.requestRender();
    return;
  }

  const band = regionToBandKind(input.region);
  if (!band) return;

  const base = callbacks.getPriceRangeOverride(band) ?? callbacks.getAutoPriceRange(band);
  const factor = input.deltaY > 0 ? 1.08 : 0.92;
  const next = scalePriceRange(base, factor, 0.5, mode);
  callbacks.onPriceRangeOverride?.(band, next);
  callbacks.requestRender();
}

/**
 * Pointer handlers for price gutter and bottom time band.
 * Price range overrides live only in {@link PaneScaleHost} via callbacks.
 */
export class ScaleInteraction {
  private priceDragging = false;
  private timeDragging = false;
  private activeBand: PriceBandKind = 'price';
  private lastX = 0;
  private lastY = 0;

  constructor(
    private readonly element: HTMLElement,
    private readonly options: ScaleInteractionOptions,
  ) {
    element.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    element.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    element.addEventListener('pointermove', this.onPointerMove, { capture: true });
    element.addEventListener('pointerup', this.onPointerUp, { capture: true });
    element.addEventListener('pointercancel', this.onPointerUp, { capture: true });
    element.addEventListener('dblclick', this.onDblClick, { capture: true });
  }

  destroy(): void {
    this.element.removeEventListener('wheel', this.onWheel, { capture: true });
    this.element.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    this.element.removeEventListener('pointermove', this.onPointerMove, { capture: true });
    this.element.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    this.element.removeEventListener('pointercancel', this.onPointerUp, { capture: true });
    this.element.removeEventListener('dblclick', this.onDblClick, { capture: true });
  }

  private hitFromClient(clientX: number, clientY: number): ScaleHitRegion {
    const rect = this.element.getBoundingClientRect();
    const layout = this.options.getLayout();
    return hitTestScaleRegion(this.options.viewport, {
      canvasX: clientX - rect.left,
      canvasY: clientY - rect.top,
      priceAxisPosition: this.options.priceAxisPosition?.() ?? 'right',
      ...layout,
    });
  }

  private readonly onWheel = (e: WheelEvent): void => {
    const region = this.hitFromClient(e.clientX, e.clientY);
    if (region === 'none' || region === 'plot') return;

    e.preventDefault();
    e.stopPropagation();

    const rect = this.element.getBoundingClientRect();
    const layout = this.options.getLayout();
    const anchorPlotX = this.options.viewport.plotXFromCanvasX(
      e.clientX - rect.left,
      layout.cssWidth,
    );

    applyScaleWheel(this.options.viewport, this.options, {
      region,
      deltaY: e.deltaY,
      anchorPlotX,
      plotWidthCss: this.options.viewport.plotWidthPx(layout.cssWidth),
    });
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const region = this.hitFromClient(e.clientX, e.clientY);
    const band = regionToBandKind(region);
    if (band) {
      e.preventDefault();
      e.stopPropagation();
      this.priceDragging = true;
      this.activeBand = band;
      this.lastY = e.clientY;
      this.element.setPointerCapture(e.pointerId);
      if (!this.options.callbacks.getPriceRangeOverride(band)) {
        this.options.callbacks.onPriceRangeOverride?.(band, {
          ...this.options.callbacks.getAutoPriceRange(band),
        });
      }
      return;
    }
    if (region === 'time-axis' && this.options.enableTimeInteraction?.() !== false) {
      e.preventDefault();
      e.stopPropagation();
      this.timeDragging = true;
      this.lastX = e.clientX;
      this.element.setPointerCapture(e.pointerId);
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const { viewport, callbacks } = this.options;
    if (this.priceDragging) {
      e.preventDefault();
      e.stopPropagation();
      const dy = e.clientY - this.lastY;
      this.lastY = e.clientY;
      const mode = this.options.priceScaleMode?.() ?? 'linear';
      const base =
        callbacks.getPriceRangeOverride(this.activeBand) ??
        callbacks.getAutoPriceRange(this.activeBand);
      const factor = Math.exp(dy * 0.004);
      callbacks.onPriceRangeOverride?.(
        this.activeBand,
        scalePriceRange(base, factor, 0.5, mode),
      );
      callbacks.requestRender();
      return;
    }
    if (this.timeDragging) {
      e.preventDefault();
      e.stopPropagation();
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;
      const layout = this.options.getLayout();
      const plotW = viewport.plotWidthPx(layout.cssWidth);
      const span = viewport.visibleSpan;
      if (span <= 0) return;
      viewport.pan((-dx / Math.max(1, plotW)) * span);
      callbacks.requestRender();
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.priceDragging && !this.timeDragging) return;
    this.priceDragging = false;
    this.timeDragging = false;
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch {
      /* released */
    }
  };

  private readonly onDblClick = (e: MouseEvent): void => {
    const region = this.hitFromClient(e.clientX, e.clientY);
    if (region === 'none' || region === 'plot') return;
    e.preventDefault();
    e.stopPropagation();

    const { viewport, callbacks } = this.options;
    const layout = this.options.getLayout();
    const plotW = viewport.plotWidthPx(layout.cssWidth);

    const band = regionToBandKind(region);
    if (band) {
      callbacks.onPriceRangeOverride?.(band, null);
      callbacks.requestRender();
      return;
    }

    if (region === 'time-axis' && this.options.enableTimeInteraction?.() !== false) {
      viewport.fitLatest(plotW);
      callbacks.requestRender();
    }
  };
}