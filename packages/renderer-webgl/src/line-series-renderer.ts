import type { ChartViewport } from './chart-viewport.js';
import { pushQuad, SolidBatchRenderer } from './solid-batch.js';
import type { PaneRect } from './candlestick-renderer.js';
import { priceToY, type PriceRange } from './price-scale.js';

export interface LineSeriesSpec {
  values: readonly (number | null)[];
  color: [number, number, number, number];
  lineWidth?: number;
}

export interface HistogramSeriesSpec {
  values: readonly (number | null)[];
  positiveColor: [number, number, number, number];
  negativeColor: [number, number, number, number];
}

export interface LineSeriesRenderParams {
  viewport: ChartViewport;
  plotWidthPx: number;
  pane: PaneRect;
  resolution: [number, number];
  lines: LineSeriesSpec[];
  histogram?: HistogramSeriesSpec;
  /** When set, line values are prices (main chart Y scale, V2-R6 overlays). */
  priceRange?: PriceRange;
  cssWidth?: number;
  dpr?: number;
}

function valueRange(
  valuesList: readonly (readonly (number | null)[])[],
  from: number,
  to: number,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const values of valuesList) {
    for (let i = from; i <= to; i++) {
      const v = values[i];
      if (v == null || !Number.isFinite(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

function yForValue(
  value: number,
  range: PriceRange,
  pane: PaneRect,
  priceScale: boolean,
): number {
  if (priceScale) {
    return priceToY(value, range, pane.top, pane.top + pane.height);
  }
  const span = range.max - range.min;
  const t = span > 0 ? (value - range.min) / span : 0.5;
  return pane.top + pane.height * (1 - t);
}

/**
 * WebGL line strips and optional signed histogram (MACD).
 */
export class LineSeriesRenderer {
  private readonly batch: SolidBatchRenderer;
  private readonly scratch: number[] = [];

  constructor(
    gl: WebGL2RenderingContext,
    debug = false,
  ) {
    this.batch = new SolidBatchRenderer(gl, debug);
  }

  dispose(): void {
    this.batch.dispose();
  }

  onContextRestored(): void {
    this.batch.markDirty();
  }

  render(params: LineSeriesRenderParams): void {
    const { viewport, plotWidthPx, pane, resolution, lines, histogram, priceRange } = params;
    const cssW = params.cssWidth ?? plotWidthPx;
    const dpr = params.dpr ?? resolution[0] / Math.max(1, pane.width);
    const { from, to } = viewport.visibleBarIndexRange();
    if (to < from) return;

    const seriesValues = lines.map((l) => l.values);
    if (histogram) seriesValues.push(histogram.values);
    const range =
      priceRange ?? valueRange(seriesValues, from, to);
    const usePriceScale = priceRange != null;

    const out = this.scratch;
    out.length = 0;

    if (histogram) {
      const zeroY = yForValue(0, range, pane, usePriceScale);
      const barWidth = Math.max(1, viewport.barSpacing * 0.72);
      for (let i = from; i <= to; i++) {
        const v = histogram.values[i];
        if (v == null) continue;
        const cx = viewport.barCenterDeviceX(i + 0.5, cssW, dpr, pane.left);
        const yVal = yForValue(v, range, pane, usePriceScale);
        const top = Math.min(zeroY, yVal);
        const bottom = Math.max(zeroY, yVal);
        const h = Math.max(1, bottom - top);
        const color = v >= 0 ? histogram.positiveColor : histogram.negativeColor;
        pushQuad(out, cx - barWidth / 2, top, cx + barWidth / 2, top + h, color);
      }
    }

    for (const spec of lines) {
      const w = spec.lineWidth ?? 1.5;
      let prevX: number | null = null;
      let prevY: number | null = null;
      for (let i = from; i <= to; i++) {
        const v = spec.values[i];
        if (v == null) {
          prevX = null;
          prevY = null;
          continue;
        }
        const x = viewport.barCenterDeviceX(i + 0.5, cssW, dpr, pane.left);
        const y = yForValue(v, range, pane, usePriceScale);
        if (prevX != null && prevY != null) {
          pushLineSegment(out, prevX, prevY, x, y, w, spec.color);
        }
        prevX = x;
        prevY = y;
      }
    }

    if (out.length === 0) return;
    if (!this.batch.ensureReady()) return;
    this.batch.draw(new Float32Array(out), resolution);
  }
}

function pushLineSegment(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: [number, number, number, number],
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) {
    pushQuad(out, x0 - width / 2, y0 - width / 2, x0 + width / 2, y0 + width / 2, color);
    return;
  }
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);
  pushTriangleQuad(
    out,
    x0 + nx,
    y0 + ny,
    x1 + nx,
    y1 + ny,
    x1 - nx,
    y1 - ny,
    x0 - nx,
    y0 - ny,
    color,
  );
}

function pushTriangleQuad(
  out: number[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  color: [number, number, number, number],
): void {
  const [r, g, b, a] = color;
  out.push(ax, ay, r, g, b, a, bx, by, r, g, b, a, cx, cy, r, g, b, a);
  out.push(ax, ay, r, g, b, a, cx, cy, r, g, b, a, dx, dy, r, g, b, a);
}