import type { Bar } from '@coderyo/data';
import type { ChartViewport } from './chart-viewport.js';
import { pushQuad, SolidBatchRenderer } from './solid-batch.js';
import { maxVolumeForBars, type PriceRange } from './price-scale.js';
import type { ChartThemeColors } from './theme.js';
import type { PaneRect } from './candlestick-renderer.js';
import {
  barIndicesInLogicalRange,
  type LogicalBarLayout,
} from './logical-bar-layout.js';

export interface VolumeRenderParams {
  bars: readonly Bar[];
  layout?: LogicalBarLayout | null;
  viewport: ChartViewport;
  plotWidthPx: number;
  pane: PaneRect;
  resolution: [number, number];
  theme: ChartThemeColors;
  cssWidth?: number;
  dpr?: number;
  /** Effective volume scale (manual override or auto max). */
  volumeRange?: PriceRange;
}

/**
 * Volume histogram in the lower pane region.
 */
export class VolumeRenderer {
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

  render(params: VolumeRenderParams): void {
    const { bars, viewport, plotWidthPx, pane, resolution, theme, layout } = params;
    const cssW = params.cssWidth ?? plotWidthPx;
    const dpr = params.dpr ?? resolution[0] / Math.max(1, pane.width);
    const { from, to } = viewport.visibleBarIndexRange();
    if (to < from || bars.length === 0) return;

    const barSpan = layout
      ? barIndicesInLogicalRange(layout, from, to)
      : { from, to };
    const autoMax =
      barSpan.to >= barSpan.from
        ? maxVolumeForBars(bars, barSpan.from, barSpan.to)
        : maxVolumeForBars(bars, from, to);
    const maxVol = params.volumeRange?.max ?? autoMax;
    if (maxVol <= 0) return;
    const spacing = viewport.barSpacing;
    const barWidth = Math.max(1, spacing * 0.82);
    const baseline = pane.top + pane.height;

    const out = this.scratch;
    out.length = 0;

    for (let i = from; i <= to; i++) {
      const barIdx = layout ? layout.barIndexAtLogical(i) : i;
      if (barIdx < 0) continue;
      const bar = bars[barIdx]!;
      const vol = bar.v ?? 0;
      if (vol <= 0) continue;

      const cx = viewport.barCenterDeviceX(i + 0.5, cssW, dpr, pane.left);
      const h = (vol / maxVol) * pane.height;
      const bullish = bar.c >= bar.o;
      const color = bullish ? theme.volumeBullish : theme.volumeBearish;

      pushQuad(
        out,
        cx - barWidth / 2,
        baseline - h,
        cx + barWidth / 2,
        baseline,
        color,
      );
    }

    const verts = new Float32Array(out);
    this.batch.draw(verts, resolution);
  }
}