/** Horizontal viewport in logical bar indices (fractional pan supported). */

export const DEFAULT_BAR_SPACING = 8;
export const MIN_BAR_SPACING = 2;
export const MAX_BAR_SPACING = 48;
export const DEFAULT_RIGHT_PADDING_PX = 56;
export const DEFAULT_GUTTER_PX = 56;

export interface ChartViewportOptions {
  barSpacing?: number;
  leftPaddingPx?: number;
  rightPaddingPx?: number;
}

export class ChartViewport {
  barSpacing: number;
  leftPaddingPx: number;
  rightPaddingPx: number;

  private _barCount = 0;
  private _visibleFrom = 0;
  private _visibleTo = 0;

  constructor(opts: ChartViewportOptions = {}) {
    this.barSpacing = clampBarSpacing(opts.barSpacing ?? DEFAULT_BAR_SPACING);
    this.leftPaddingPx = opts.leftPaddingPx ?? 0;
    this.rightPaddingPx = opts.rightPaddingPx ?? DEFAULT_RIGHT_PADDING_PX;
  }

  /** Place price gutter on left or right (main chart only). */
  setPriceAxisPosition(position: 'left' | 'right', gutterPx = DEFAULT_GUTTER_PX): void {
    if (position === 'left') {
      this.leftPaddingPx = gutterPx;
      this.rightPaddingPx = 0;
    } else {
      this.leftPaddingPx = 0;
      this.rightPaddingPx = gutterPx;
    }
  }

  get barCount(): number {
    return this._barCount;
  }

  get visibleFrom(): number {
    return this._visibleFrom;
  }

  get visibleTo(): number {
    return this._visibleTo;
  }

  /** Visible span in logical bar units. */
  get visibleSpan(): number {
    return this._visibleTo - this._visibleFrom;
  }

  /** CSS offset where the plot area begins. */
  plotOffsetPx(): number {
    return this.leftPaddingPx;
  }

  /** Update bar count only; does not change pan/zoom (use {@link fitLatest} or {@link syncFrom}). */
  setBarCount(count: number): void {
    this._barCount = Math.max(0, count);
    if (this._barCount <= 0) {
      this._visibleFrom = 0;
      this._visibleTo = 0;
    }
  }

  setVisibleRange(from: number, to: number): void {
    if (to <= from) return;
    this._visibleFrom = from;
    this._visibleTo = to;
    this.clampRange();
  }

  /** Plot width excluding left/right price gutters (CSS pixels). */
  plotWidthPx(totalWidthPx: number): number {
    return Math.max(1, totalWidthPx - this.leftPaddingPx - this.rightPaddingPx);
  }

  /** Whether canvas-local x (CSS) lies in the plot area. */
  isPlotCanvasX(canvasX: number, totalWidthPx: number): boolean {
    return (
      canvasX >= this.leftPaddingPx && canvasX < totalWidthPx - this.rightPaddingPx
    );
  }

  /** Map canvas-local x (CSS) to plot coordinates. */
  plotXFromCanvasX(canvasX: number, totalWidthPx: number): number {
    const plotW = this.plotWidthPx(totalWidthPx);
    return Math.min(plotW, Math.max(0, canvasX - this.leftPaddingPx));
  }

  /** Bars that fit at current spacing in the plot area. */
  visibleBarCapacity(plotWidthPx: number): number {
    return plotWidthPx / this.barSpacing;
  }

  /** Fit the last N bars into the plot width. */
  fitLatest(plotWidthPx: number): void {
    if (this._barCount <= 0) {
      this._visibleFrom = 0;
      this._visibleTo = 0;
      return;
    }
    const span = this.visibleBarCapacity(plotWidthPx);
    const to = this._barCount;
    const from = Math.max(0, to - span);
    this._visibleFrom = from;
    this._visibleTo = to;
  }

  /** Pan by delta bars (positive = scroll left / older bars). */
  pan(deltaBars: number): void {
    if (deltaBars === 0) return;
    this._visibleFrom += deltaBars;
    this._visibleTo += deltaBars;
    this.clampRange();
  }

  /**
   * Zoom around a pixel anchor in plot coordinates.
   * @param factor >1 zoom in (fewer bars), <1 zoom out
   */
  zoom(factor: number, anchorPlotX: number, plotWidthPx: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const span = this.visibleSpan;
    if (span <= 0) return;

    const anchorT =
      this._visibleFrom + (anchorPlotX / Math.max(1, plotWidthPx)) * span;
    const newSpan = clamp(
      span / factor,
      this.barSpacing / plotWidthPx,
      this._barCount + 10,
    );
    const ratio = span > 0 ? (anchorT - this._visibleFrom) / span : 0.5;

    this._visibleFrom = anchorT - ratio * newSpan;
    this._visibleTo = this._visibleFrom + newSpan;
    this.clampRange();
    this.barSpacing = clampBarSpacing(this.barSpacing * factor);
  }

  /** Wheel zoom: adjust bar spacing with anchor. */
  zoomBarSpacing(delta: number, anchorPlotX: number, plotWidthPx: number): void {
    const prev = this.barSpacing;
    const next = clampBarSpacing(prev + delta);
    if (next === prev) return;
    const factor = next / prev;
    this.zoom(1 / factor, anchorPlotX, plotWidthPx);
    this.barSpacing = next;
  }

  /** Logical bar index at plot x (center of bar at half-integer alignment). */
  barIndexAtPlotX(plotX: number, plotWidthPx: number): number {
    const span = this.visibleSpan;
    if (span <= 0) return 0;
    const t = this._visibleFrom + (plotX / Math.max(1, plotWidthPx)) * span;
    return t;
  }

  /** Plot x for bar index (bar center), relative to plot area origin (CSS px). */
  plotXForBarIndex(barIndex: number, plotWidthPx: number): number {
    const span = this.visibleSpan;
    if (span <= 0) return 0;
    return ((barIndex - this._visibleFrom) / span) * plotWidthPx;
  }

  /** Canvas X (CSS) for bar center. */
  canvasXForBarIndex(barIndex: number, totalWidthCss: number): number {
    return this.plotOffsetPx() + this.plotXForBarIndex(barIndex, this.plotWidthPx(totalWidthCss));
  }

  /** Device-pixel X for bar center on canvas. */
  barCenterDeviceX(
    barIndex: number,
    totalWidthCss: number,
    dpr: number,
    paneLeftDevice = 0,
  ): number {
    return paneLeftDevice + this.canvasXForBarIndex(barIndex, totalWidthCss) * dpr;
  }

  /** Inclusive integer bar index range intersecting the viewport. */
  visibleBarIndexRange(): { from: number; to: number } {
    const from = Math.max(0, Math.floor(this._visibleFrom));
    const to = Math.min(this._barCount - 1, Math.ceil(this._visibleTo) - 1);
    return { from, to: Math.max(from, to) };
  }

  /** Copy pan/zoom state from another viewport (time-scale sync across panes). */
  syncFrom(source: ChartViewport): void {
    this.barSpacing = source.barSpacing;
    this._barCount = source._barCount;
    this._visibleFrom = source._visibleFrom;
    this._visibleTo = source._visibleTo;
  }

  private clampRange(): void {
    const span = this.visibleSpan;
    const maxSpan = Math.max(this._barCount + 20, span);
    let from = this._visibleFrom;
    let to = this._visibleTo;

    if (to - from < 1) {
      to = from + 1;
    }
    if (to - from > maxSpan) {
      to = from + maxSpan;
    }

    const overscroll = span * 0.15;
    const minFrom = -overscroll;
    const maxFrom = Math.max(0, this._barCount - span * 0.25) + overscroll;
    if (from < minFrom) {
      const shift = minFrom - from;
      from += shift;
      to += shift;
    }
    if (from > maxFrom && this._barCount > 0) {
      const shift = from - maxFrom;
      from -= shift;
      to -= shift;
    }

    this._visibleFrom = from;
    this._visibleTo = to;
  }
}

export function clampBarSpacing(value: number): number {
  return clamp(value, MIN_BAR_SPACING, MAX_BAR_SPACING);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}