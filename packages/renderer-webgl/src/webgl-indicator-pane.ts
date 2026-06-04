import type { Bar } from '@coderyo/data';
import {
  kdj,
  macd,
  rsi,
  type IndicatorConfig,
  type IndicatorSource,
} from '@coderyo/indicators';
import { ChartViewport } from './chart-viewport.js';
import { LineSeriesRenderer } from './line-series-renderer.js';
import { WebGL2Context } from './webgl2-context.js';
import { mergeTheme, type ChartThemeColors } from './theme.js';
import type { ViewportSyncBus } from './viewport-sync-bus.js';

export type WebGLIndicatorPaneId = 'macd' | 'rsi' | 'kdj';

export interface WebGLIndicatorPaneOptions {
  paneId: WebGLIndicatorPaneId;
  label: string;
  theme?: Partial<ChartThemeColors>;
  debug?: boolean;
  syncBus?: ViewportSyncBus;
}

function barsForSource(bars: Bar[], source: IndicatorSource): Bar[] {
  if (source === 'close') return bars;
  return bars.map((b) => ({ ...b, c: (b.h + b.l + b.c) / 3 }));
}

/**
 * Single indicator sub-pane (MACD / RSI / KDJ) with its own WebGL canvas.
 */
export class WebGLIndicatorPane {
  readonly viewport: ChartViewport;
  readonly context: WebGL2Context;

  private readonly paneId: WebGLIndicatorPaneId;
  private readonly lines: LineSeriesRenderer;
  private readonly theme: ChartThemeColors;
  private readonly debug: boolean;
  private readonly syncBus: ViewportSyncBus | undefined;
  private readonly syncUnregister: (() => void) | null;

  private bars: Bar[] = [];
  private config: IndicatorConfig | null = null;
  private width = 0;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    opts: WebGLIndicatorPaneOptions,
  ) {
    this.paneId = opts.paneId;
    this.theme = mergeTheme(opts.theme);
    this.debug = opts.debug ?? false;
    this.viewport = new ChartViewport();
    this.context = new WebGL2Context(container, { debug: this.debug });
    this.lines = new LineSeriesRenderer(this.context.gl, this.debug);
    this.syncBus = opts.syncBus;
    this.syncUnregister = opts.syncBus?.register(this.viewport) ?? null;

    container.style.position = container.style.position || 'relative';
    container.style.overflow = 'hidden';
    container.style.minHeight = '72px';

    const tag = document.createElement('span');
    tag.textContent = opts.label;
    tag.style.cssText =
      'position:absolute;left:6px;top:4px;z-index:2;font-size:10px;color:#8b949e;pointer-events:none;';
    container.appendChild(tag);

    this.context.setContextHandlers({
      onRestored: () => {
        this.lines.onContextRestored();
        this.scheduleRender();
      },
    });
  }

  setBars(bars: readonly Bar[], config: IndicatorConfig): void {
    this.bars = bars.slice();
    this.config = config;
    this.viewport.setBarCount(this.bars.length);
    this.syncBus?.propagate();
    this.scheduleRender();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.width = cssWidth;
    this.context.resize(cssWidth, cssHeight);
    this.scheduleRender();
  }

  render(): void {
    if (this.disposed || this.context.isContextLost || !this.config) return;
    const size = this.context.canvas;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0 || this.bars.length === 0) return;

    const plotW = this.viewport.plotWidthPx(this.width || w);
    const pane = { left: 0, top: 0, width: w, height: h };
    const resolution: [number, number] = [w, h];

    this.context.clear(this.theme.background);
    const series = this.buildSeries(this.bars, this.config);
    if (!series) return;

    this.lines.render({
      viewport: this.viewport,
      plotWidthPx: plotW,
      pane,
      resolution,
      ...series,
    });
    this.context.gl.flush();
  }

  destroy(): void {
    this.disposed = true;
    this.syncUnregister?.();
    this.lines.dispose();
    this.context.destroy();
    this.container.replaceChildren();
  }

  private buildSeries(
    bars: Bar[],
    config: IndicatorConfig,
  ): Pick<
    import('./line-series-renderer.js').LineSeriesRenderParams,
    'lines' | 'histogram'
  > | null {
    const src = barsForSource(bars, config.source);
    switch (this.paneId) {
      case 'macd': {
        const m = macd(src, config.macdFast, config.macdSlow, config.macdSignal);
        return {
          histogram: {
            values: m.histogram,
            positiveColor: [0.15, 0.65, 0.6, 0.55],
            negativeColor: [0.94, 0.33, 0.31, 0.55],
          },
          lines: [
            { values: m.macd, color: [0.16, 0.38, 1, 1], lineWidth: 1.5 },
            { values: m.signal, color: [1, 0.6, 0, 1], lineWidth: 1.5 },
          ],
        };
      }
      case 'rsi': {
        const r = rsi(src, config.rsiPeriod);
        return {
          lines: [{ values: r, color: [0.67, 0.28, 0.74, 1], lineWidth: 1.5 }],
        };
      }
      case 'kdj': {
        const k = kdj(src, config.kdjPeriod, config.kdjKSmooth, config.kdjDSmooth);
        return {
          lines: [
            { values: k.k, color: [0.26, 0.65, 0.96, 1], lineWidth: 1.5 },
            { values: k.d, color: [1, 0.65, 0.15, 1], lineWidth: 1.5 },
            { values: k.j, color: [0.94, 0.33, 0.31, 1], lineWidth: 1.5 },
          ],
        };
      }
      default:
        return null;
    }
  }

  private rafId: number | null = null;

  private scheduleRender(): void {
    if (this.disposed || this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }
}