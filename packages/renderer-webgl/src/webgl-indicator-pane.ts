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
import { PaneScaleHost } from './scale/pane-scale-host.js';
import { hitTestScaleRegion, type ScaleLayoutCss } from './scale/scale-interaction.js';
import { ChartInteraction } from './chart-interaction.js';
import {
  DEFAULT_INDICATOR_PRICE_FORMAT,
  type PriceScaleOptions,
  type SymbolPriceFormat,
  type TimeScaleOptions,
} from './scale/scale-types.js';
import type { PriceRange } from './price-scale.js';
import { detectIndicatorBarMutation } from './indicator-bar-mutation.js';

export type WebGLIndicatorPaneId = 'macd' | 'rsi' | 'kdj';

type CachedIndicatorSeries = {
  lines: Array<{
    values: (number | null)[];
    color: [number, number, number, number];
    lineWidth?: number;
  }>;
  histogram?: {
    values: (number | null)[];
    positiveColor: [number, number, number, number];
    negativeColor: [number, number, number, number];
  };
};

export interface WebGLIndicatorPaneOptions {
  paneId: WebGLIndicatorPaneId;
  label: string;
  theme?: Partial<ChartThemeColors>;
  debug?: boolean;
  syncBus?: ViewportSyncBus;
  timeZone?: string;
}

function barsForSource(bars: Bar[], source: IndicatorSource): Bar[] {
  if (source === 'close') return bars;
  return bars.map((b) => ({ ...b, c: (b.h + b.l + b.c) / 3 }));
}

function valueRangeFromSeries(
  series: Array<{ values: readonly (number | null)[] }>,
  from: number,
  to: number,
): PriceRange {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) {
    for (let i = from; i <= to; i++) {
      const v = s.values[i];
      if (v == null || !Number.isFinite(v)) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.05);
    return { min: min - pad, max: max + pad };
  }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

/**
 * Single indicator sub-pane (MACD / RSI / KDJ) with its own WebGL canvas + price axis.
 */
export class WebGLIndicatorPane {
  readonly viewport: ChartViewport;
  readonly context: WebGL2Context;

  private readonly paneId: WebGLIndicatorPaneId;
  private readonly lines: LineSeriesRenderer;
  private readonly theme: ChartThemeColors;
  private readonly debug: boolean;
  private readonly syncBus: ViewportSyncBus | undefined;
  private syncUnregister: (() => void) | null = null;
  private readonly scaleHost: PaneScaleHost;
  private interaction: ChartInteraction | null = null;

  private bars: Bar[] = [];
  private config: IndicatorConfig | null = null;
  private width = 0;
  private height = 0;
  private disposed = false;
  private rafId: number | null = null;
  private crosshairPrice: number | null = null;
  private crosshairTimeMs: number | null = null;
  private lastAutoRange: PriceRange = { min: 0, max: 1 };
  private lastBarTimes: number[] = [];
  private cachedSeries: CachedIndicatorSeries | null = null;

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
    this.syncUnregister = null;
    const followsMaster = opts.syncBus != null;

    this.scaleHost = new PaneScaleHost(container, {
      interactionElement: this.context.canvas,
      getAutoPriceRange: () => this.lastAutoRange,
      requestRender: () => this.scheduleRender(),
      getCssLayout: () => this.getScaleLayoutCss(),
      enableTimeInteraction: !followsMaster,
    });
    this.scaleHost.bindViewport(this.viewport);
    this.scaleHost.setSymbolPriceFormat(DEFAULT_INDICATOR_PRICE_FORMAT);
    if (opts.timeZone) this.scaleHost.setTimezone(opts.timeZone);

    container.style.position = container.style.position || 'relative';
    container.style.overflow = 'hidden';
    container.style.minHeight = '72px';

    const tag = document.createElement('span');
    tag.textContent = opts.label;
    tag.style.cssText =
      'position:absolute;left:6px;top:4px;z-index:2;font-size:10px;color:#8b949e;pointer-events:none;';
    container.appendChild(tag);

    this.interaction = new ChartInteraction(
      this.context.canvas,
      this.viewport,
      () => this.viewport.plotWidthPx(this.width),
      {
        requestRender: () => this.scheduleRender(),
        shouldHandlePlotPointer: (e) => this.shouldHandlePlotPointer(e),
        enableTimePan: () => !this.syncBus,
        enablePricePan: () => true,
        getPlotHeight: () => this.height || this.context.canvas.clientHeight || 72,
        onPricePan: (dy, plotH) => {
          this.scaleHost.panPriceRange('price', dy, plotH);
        },
      },
    );

    this.context.setContextHandlers({
      onRestored: () => {
        this.lines.onContextRestored();
        this.scheduleRender();
      },
    });
  }

  applyPriceScaleOptions(opts: Partial<PriceScaleOptions>): void {
    const { position: _position, ...rest } = opts;
    this.scaleHost.applyPriceScaleOptions(rest);
    this.scheduleRender();
  }

  applyTimeScaleOptions(opts: Partial<TimeScaleOptions>): void {
    this.scaleHost.applyTimeScaleOptions(opts);
    this.scheduleRender();
  }

  setSymbolPriceFormat(format: SymbolPriceFormat): void {
    this.scaleHost.setSymbolPriceFormat(format);
    this.scheduleRender();
  }

  setTimezone(timeZone: string): void {
    this.scaleHost.setTimezone(timeZone);
    this.scheduleRender();
  }

  setCrosshairReadout(price: number | null, timeMs: number | null): void {
    this.crosshairPrice = price;
    this.crosshairTimeMs = timeMs;
    this.scheduleRender();
  }

  setBars(bars: readonly Bar[], config: IndicatorConfig): void {
    if (bars.length === 0) {
      this.bars = [];
      this.lastBarTimes = [];
      this.cachedSeries = null;
      this.viewport.setBarCount(0);
      this.scheduleRender();
      return;
    }

    const mutation = detectIndicatorBarMutation(this.lastBarTimes, bars);
    this.bars = bars.slice();
    this.config = config;
    this.lastBarTimes = this.bars.map((b) => b.t);
    this.viewport.setBarCount(this.bars.length);

    if (this.syncBus) {
      this.syncUnregister?.();
      this.syncUnregister = this.syncBus.register(this.viewport, this.bars);
    }

    if (mutation === 'full') {
      this.cachedSeries = this.buildSeries(this.bars, config);
    } else if (this.cachedSeries) {
      this.patchCachedSeries(mutation, this.bars, config);
    } else {
      this.cachedSeries = this.buildSeries(this.bars, config);
    }

    this.scheduleRender();
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.width = cssWidth;
    this.height = cssHeight;
    const size = this.context.resize(cssWidth, cssHeight);
    this.scaleHost.resize(cssWidth, cssHeight, size.dpr);
    this.scheduleRender();
  }

  render(): void {
    if (this.disposed || this.context.isContextLost || !this.config) return;
    const size = this.context.canvas;
    const w = size.width;
    const h = size.height;
    if (w <= 0 || h <= 0 || this.bars.length === 0) return;

    const cssWidth = this.width || w / (globalThis.devicePixelRatio ?? 1);
    const dpr = w / Math.max(1, cssWidth);
    const plotW = this.viewport.plotWidthPx(cssWidth);
    const pane = { left: 0, top: 0, width: w, height: h };
    const resolution: [number, number] = [w, h];

    this.context.clear(this.theme.background);
    const series = this.cachedSeries ?? this.buildSeries(this.bars, this.config);
    if (!series) return;

    const { from, to } = this.viewport.visibleBarIndexRange();
    const allLines = [
      ...series.lines,
      ...(series.histogram ? [{ values: series.histogram.values }] : []),
    ];
    this.lastAutoRange = valueRangeFromSeries(allLines, from, to);
    const priceRange = this.scaleHost.getEffectivePriceRange(this.lastAutoRange, 'price');

    this.lines.render({
      viewport: this.viewport,
      plotWidthPx: plotW,
      cssWidth,
      dpr,
      pane,
      resolution,
      ...series,
      priceRange,
    });
    this.context.gl.flush();

    this.scaleHost.draw({
      deviceWidth: w,
      deviceHeight: h,
      cssWidth,
      dpr,
      viewport: this.viewport,
      bars: this.bars,
      showTimeAxis: false,
      crosshairPrice: this.crosshairPrice,
      crosshairTimeMs: this.crosshairTimeMs,
      priceBands: [{ top: 0, bottom: h, range: this.lastAutoRange, kind: 'price' }],
    });
  }

  destroy(): void {
    this.disposed = true;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.interaction?.destroy();
    this.interaction = null;
    this.syncUnregister?.();
    this.scaleHost.destroy();
    this.lines.dispose();
    this.context.destroy();
    this.container.replaceChildren();
  }

  private getScaleLayoutCss(): ScaleLayoutCss {
    const cssWidth = this.width || this.context.canvas.clientWidth || 400;
    const cssHeight = this.height || this.context.canvas.clientHeight || 72;
    return { cssWidth, cssHeight, mainPaneHeight: cssHeight };
  }

  private shouldHandlePlotPointer(e: PointerEvent | WheelEvent): boolean {
    const rect = this.context.canvas.getBoundingClientRect();
    const region = hitTestScaleRegion(this.viewport, {
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
      ...this.getScaleLayoutCss(),
    });
    return region === 'plot';
  }

  private warmupLookback(config: IndicatorConfig): number {
    return (
      Math.max(
        config.macdSlow + config.macdSignal,
        config.rsiPeriod,
        config.kdjPeriod + config.kdjKSmooth + config.kdjDSmooth,
      ) + 5
    );
  }

  private patchCachedSeries(
    mutation: 'tail-append' | 'tail-update',
    bars: Bar[],
    config: IndicatorConfig,
  ): void {
    const from =
      mutation === 'tail-update'
        ? Math.max(0, bars.length - 1)
        : Math.max(0, bars.length - this.warmupLookback(config));
    const fresh = this.buildSeries(bars, config);
    if (!fresh || !this.cachedSeries) {
      this.cachedSeries = fresh;
      return;
    }
    const patchLine = (
      target: { values: (number | null)[] },
      source: { values: readonly (number | null)[] },
    ) => {
      while (target.values.length < bars.length) target.values.push(null);
      for (let i = from; i < bars.length; i++) {
        target.values[i] = source.values[i] ?? null;
      }
    };
    for (let i = 0; i < fresh.lines.length; i++) {
      patchLine(this.cachedSeries.lines[i]!, fresh.lines[i]!);
    }
    if (fresh.histogram && this.cachedSeries.histogram) {
      while (this.cachedSeries.histogram.values.length < bars.length) {
        this.cachedSeries.histogram.values.push(null);
      }
      for (let i = from; i < bars.length; i++) {
        this.cachedSeries.histogram.values[i] = fresh.histogram.values[i] ?? null;
      }
    }
  }

  private buildSeries(bars: Bar[], config: IndicatorConfig): CachedIndicatorSeries | null {
    const src = barsForSource(bars, config.source);
    switch (this.paneId) {
      case 'macd': {
        const m = macd(src, config.macdFast, config.macdSlow, config.macdSignal);
        return {
          histogram: {
            values: [...m.histogram],
            positiveColor: [0.15, 0.65, 0.6, 0.55],
            negativeColor: [0.94, 0.33, 0.31, 0.55],
          },
          lines: [
            { values: [...m.macd], color: [0.16, 0.38, 1, 1], lineWidth: 1.5 },
            { values: [...m.signal], color: [1, 0.6, 0, 1], lineWidth: 1.5 },
          ],
        };
      }
      case 'rsi': {
        const r = rsi(src, config.rsiPeriod);
        return {
          lines: [{ values: [...r], color: [0.67, 0.28, 0.74, 1], lineWidth: 1.5 }],
        };
      }
      case 'kdj': {
        const k = kdj(src, config.kdjPeriod, config.kdjKSmooth, config.kdjDSmooth);
        return {
          lines: [
            { values: [...k.k], color: [0.26, 0.65, 0.96, 1], lineWidth: 1.5 },
            { values: [...k.d], color: [1, 0.65, 0.15, 1], lineWidth: 1.5 },
            { values: [...k.j], color: [0.94, 0.33, 0.31, 1], lineWidth: 1.5 },
          ],
        };
      }
      default:
        return null;
    }
  }

  private scheduleRender(): void {
    if (this.disposed || this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }
}