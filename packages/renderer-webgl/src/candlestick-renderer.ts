import type { Bar } from '@coderyo/data';
import type { ChartViewport } from './chart-viewport.js';
import { pushQuad, SolidBatchRenderer } from './solid-batch.js';
import {
  priceRangeForBars,
  priceToY,
  type PriceRange,
  type PriceScaleMode,
} from './price-scale.js';
import type { ChartThemeColors } from './theme.js';

export interface PaneRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CandlestickRenderParams {
  bars: readonly Bar[];
  viewport: ChartViewport;
  plotWidthPx: number;
  pane: PaneRect;
  /** Full canvas resolution in device pixels (shader clip-space). */
  resolution: [number, number];
  theme: ChartThemeColors;
  priceScaleMode?: PriceScaleMode;
}

/**
 * OHLC candlesticks (wick + body) for the visible logical range.
 */
export class CandlestickRenderer {
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

  render(params: CandlestickRenderParams): void {
    const { bars, viewport, plotWidthPx, pane, resolution, theme } = params;
    const { from, to } = viewport.visibleBarIndexRange();
    if (to < from || bars.length === 0) return;

    const mode = params.priceScaleMode ?? 'linear';
    const range = priceRangeForBars(bars, from, to, mode);
    const spacing = viewport.barSpacing;
    const bodyWidth = Math.max(1, spacing * 0.72);
    const wickWidth = Math.max(1, Math.min(2, spacing * 0.12));

    const out = this.scratch;
    out.length = 0;

    for (let i = from; i <= to; i++) {
      const bar = bars[i]!;
      const cx = pane.left + viewport.plotXForBarIndex(i + 0.5, plotWidthPx);
      const bullish = bar.c >= bar.o;
      const color = bullish ? theme.bullish : theme.bearish;

      const yOpen = yForPrice(bar.o, range, pane, mode);
      const yClose = yForPrice(bar.c, range, pane, mode);
      const yHigh = yForPrice(bar.h, range, pane, mode);
      const yLow = yForPrice(bar.l, range, pane, mode);

      const bodyTop = Math.min(yOpen, yClose);
      const bodyBottom = Math.max(yOpen, yClose);
      const bodyH = Math.max(1, bodyBottom - bodyTop);

      // Wick (thin quad from high to low)
      pushQuad(
        out,
        cx - wickWidth / 2,
        yHigh,
        cx + wickWidth / 2,
        yLow,
        color,
      );

      // Body
      pushQuad(
        out,
        cx - bodyWidth / 2,
        bodyTop,
        cx + bodyWidth / 2,
        bodyTop + bodyH,
        color,
      );
    }

    const verts = new Float32Array(out);
    this.batch.draw(verts, resolution);
  }
}

function yForPrice(
  price: number,
  range: PriceRange,
  pane: PaneRect,
  mode: PriceScaleMode,
): number {
  return priceToY(price, range, pane.top, pane.top + pane.height, mode);
}