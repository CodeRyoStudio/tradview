import type { Bar } from '@coderyo/data';
import type { ChartViewport } from './chart-viewport.js';
import { pushQuad, SolidBatchRenderer } from './solid-batch.js';
import { maxVolumeForBars } from './price-scale.js';
import type { ChartThemeColors } from './theme.js';
import type { PaneRect } from './candlestick-renderer.js';

export interface VolumeRenderParams {
  bars: readonly Bar[];
  viewport: ChartViewport;
  plotWidthPx: number;
  pane: PaneRect;
  resolution: [number, number];
  theme: ChartThemeColors;
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
    const { bars, viewport, plotWidthPx, pane, resolution, theme } = params;
    const { from, to } = viewport.visibleBarIndexRange();
    if (to < from || bars.length === 0) return;

    const maxVol = maxVolumeForBars(bars, from, to);
    const spacing = viewport.barSpacing;
    const barWidth = Math.max(1, spacing * 0.82);
    const baseline = pane.top + pane.height;

    const out = this.scratch;
    out.length = 0;

    for (let i = from; i <= to; i++) {
      const bar = bars[i]!;
      const vol = bar.v ?? 0;
      if (vol <= 0) continue;

      const cx = pane.left + viewport.plotXForBarIndex(i + 0.5, plotWidthPx);
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