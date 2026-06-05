import type { PriceRange, PriceScaleMode } from '../price-scale.js';
import { priceToY } from '../price-scale.js';
import type { ChartViewport } from '../chart-viewport.js';
import {
  computePriceTicks,
  formatPriceLabel,
  formatVolumeLabel,
  type PriceTick,
} from './price-scale-engine.js';
import {
  computeTimeTicks,
  formatTimeAxisLabel,
  medianBarIntervalMs,
  type TimeTick,
} from './time-scale-engine.js';
import {
  DEFAULT_PRICE_SCALE_OPTIONS,
  DEFAULT_TIME_SCALE_OPTIONS,
  TIME_AXIS_CSS_PX,
  type PriceScaleOptions,
  type SymbolPriceFormat,
  type TimeScaleOptions,
} from './scale-types.js';

export interface PriceBandDrawSpec {
  top: number;
  bottom: number;
  range: PriceRange;
  mode?: PriceScaleMode;
  kind?: 'price' | 'volume';
}

export interface ScaleDrawParams {
  deviceWidth: number;
  deviceHeight: number;
  cssWidth: number;
  dpr: number;
  viewport: ChartViewport;
  bars: readonly { t: number; c?: number }[];
  priceBands: PriceBandDrawSpec[];
  showTimeAxis?: boolean;
  timeAxisTop?: number;
  priceScaleMode?: PriceScaleMode;
  symbolFormat?: SymbolPriceFormat;
  crosshairPrice?: number | null;
  crosshairTimeMs?: number | null;
  lastPrice?: number | null;
}

interface TickCache {
  key: string;
  priceTicksByBand: Map<number, PriceTick[]>;
  timeTicks: TimeTick[];
}

export class ScaleRenderer {
  private priceOpts: PriceScaleOptions = { ...DEFAULT_PRICE_SCALE_OPTIONS };
  private timeOpts: TimeScaleOptions = { ...DEFAULT_TIME_SCALE_OPTIONS };
  private timeZone = 'UTC';
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();
  private tickCache: TickCache | null = null;
  private cacheKey = '';

  setPriceOptions(opts: PriceScaleOptions): void {
    this.priceOpts = { ...DEFAULT_PRICE_SCALE_OPTIONS, ...opts };
  }

  setTimeOptions(opts: TimeScaleOptions): void {
    this.timeOpts = { ...DEFAULT_TIME_SCALE_OPTIONS, ...opts };
  }

  setTimezone(tz: string): void {
    this.timeZone = tz || 'UTC';
    this.formatters.clear();
  }

  invalidate(): void {
    this.tickCache = null;
    this.cacheKey = '';
  }

  draw(
    ctx: CanvasRenderingContext2D,
    params: ScaleDrawParams,
    opts?: { crosshairOnly?: boolean },
  ): void {
    const { deviceWidth: w, deviceHeight: h, cssWidth, dpr, viewport, bars } = params;
    if (w <= 0 || h <= 0) return;

    const key = this.buildCacheKey(params);
    if (key !== this.cacheKey) {
      this.tickCache = null;
      this.cacheKey = key;
    }

    const plotWDevice = Math.floor(viewport.plotWidthPx(cssWidth) * dpr);
    const plotLeftDevice = Math.floor(viewport.plotOffsetPx() * dpr);
    const position = this.priceOpts.position ?? 'right';
    const gutterEdge = position === 'right' ? plotLeftDevice + plotWDevice : plotLeftDevice;
    const gutterWidth = w - plotWDevice;

    if (!opts?.crosshairOnly || !this.tickCache) {
      ctx.clearRect(0, 0, w, h);
      this.ensureTickCache(params, w, h, dpr, plotWDevice);
      this.drawStaticLayers(ctx, params, {
        w,
        h,
        gutterEdge,
        gutterWidth,
        position,
        plotWDevice,
        plotLeftDevice,
      });
    } else if (this.tickCache) {
      ctx.clearRect(0, 0, w, h);
      this.drawStaticLayers(ctx, params, {
        w,
        h,
        gutterEdge,
        gutterWidth,
        position,
        plotWDevice,
        plotLeftDevice,
      });
    }

    this.drawCrosshairLayers(ctx, params, {
      gutterEdge,
      gutterWidth,
      position,
      w,
      h,
      dpr,
      bars,
    });
  }

  private buildCacheKey(params: ScaleDrawParams): string {
    const vp = params.viewport;
    const bands = params.priceBands
      .map(
        (b) =>
          `${b.kind}:${b.top}:${b.bottom}:${b.range.min}:${b.range.max}:${b.mode ?? ''}`,
      )
      .join('|');
    return [
      params.cssWidth,
      params.deviceWidth,
      params.deviceHeight,
      params.dpr,
      vp.visibleFrom,
      vp.visibleTo,
      vp.barSpacing,
      vp.leftPaddingPx,
      vp.rightPaddingPx,
      params.priceScaleMode,
      this.timeZone,
      bands,
      params.showTimeAxis,
      JSON.stringify(this.priceOpts),
      JSON.stringify(this.timeOpts),
      JSON.stringify(params.symbolFormat),
    ].join(';');
  }

  private ensureTickCache(
    params: ScaleDrawParams,
    w: number,
    h: number,
    dpr: number,
    plotWDevice: number,
  ): void {
    if (this.tickCache) return;
    const priceTicksByBand = new Map<number, PriceTick[]>();
    params.priceBands.forEach((band, i) => {
      const mode =
        (band.kind ?? 'price') === 'volume' ? 'linear' : (band.mode ?? params.priceScaleMode ?? 'linear');
      const ticks = computePriceTicks({
        range: band.range,
        top: band.top,
        bottom: band.bottom,
        mode,
        format: params.symbolFormat,
      }).map((t) =>
        (band.kind ?? 'price') === 'volume'
          ? { ...t, label: formatVolumeLabel(t.price) }
          : t,
      );
      priceTicksByBand.set(i, ticks);
    });

    const timeTicks =
      params.showTimeAxis === false
        ? []
        : computeTimeTicks({
            viewport: params.viewport,
            bars: params.bars,
            plotWidthPx: params.viewport.plotWidthPx(params.cssWidth),
            dpr,
            timeZone: this.timeZone,
            formatters: this.formatters,
          });

    this.tickCache = { key: this.cacheKey, priceTicksByBand, timeTicks };
    void w;
    void h;
    void plotWDevice;
  }

  private drawStaticLayers(
    ctx: CanvasRenderingContext2D,
    params: ScaleDrawParams,
    layout: {
      w: number;
      h: number;
      gutterEdge: number;
      gutterWidth: number;
      position: 'left' | 'right';
      plotWDevice: number;
      plotLeftDevice: number;
    },
  ): void {
    const cache = this.tickCache!;
    const priceFont = this.priceOpts.font ?? DEFAULT_PRICE_SCALE_OPTIONS.font;
    ctx.strokeStyle = this.priceOpts.borderColor ?? DEFAULT_PRICE_SCALE_OPTIONS.borderColor;
    ctx.lineWidth = 1;

    params.priceBands.forEach((band, i) => {
      const ticks = cache.priceTicksByBand.get(i) ?? [];
      const kind = band.kind ?? 'price';
      const mode =
        kind === 'volume' ? 'linear' : (band.mode ?? params.priceScaleMode ?? 'linear');
      this.drawPriceBandStatic(ctx, {
        band,
        ticks,
        gutterEdge: layout.gutterEdge,
        gutterWidth: layout.gutterWidth,
        position: layout.position,
        font: priceFont,
        mode,
        format: params.symbolFormat,
        kind,
      });
    });

    if (params.showTimeAxis !== false) {
      const timeAxisH = Math.floor(TIME_AXIS_CSS_PX * params.dpr);
      const top = params.timeAxisTop ?? layout.h - timeAxisH;
      this.drawTimeBandStatic(ctx, {
        plotRight: layout.plotLeftDevice + layout.plotWDevice,
        canvasW: layout.w,
        canvasH: layout.h,
        timeTop: top,
        ticks: cache.timeTicks,
        font: this.timeOpts.font ?? DEFAULT_TIME_SCALE_OPTIONS.font,
      });
    }
  }

  private drawCrosshairLayers(
    ctx: CanvasRenderingContext2D,
    params: ScaleDrawParams,
    layout: {
      gutterEdge: number;
      gutterWidth: number;
      position: 'left' | 'right';
      w: number;
      h: number;
      dpr: number;
      bars: readonly { t: number }[];
    },
  ): void {
    const mainBand = params.priceBands.find((b) => (b.kind ?? 'price') === 'price');
    if (mainBand && params.lastPrice != null && Number.isFinite(params.lastPrice)) {
      const mode = params.priceScaleMode ?? 'linear';
      const y = priceToY(params.lastPrice, mainBand.range, mainBand.top, mainBand.bottom, mode);
      this.drawPriceTag(ctx, {
        y,
        text: formatPriceLabel(params.lastPrice, params.symbolFormat, mode),
        gutterEdge: layout.gutterEdge,
        gutterWidth: layout.gutterWidth,
        position: layout.position,
        font: this.priceOpts.font ?? DEFAULT_PRICE_SCALE_OPTIONS.font,
        background:
          this.priceOpts.lastPriceBackground ?? DEFAULT_PRICE_SCALE_OPTIONS.lastPriceBackground,
        textColor:
          this.priceOpts.lastPriceTextColor ?? DEFAULT_PRICE_SCALE_OPTIONS.lastPriceTextColor,
      });
    }

    if (
      mainBand &&
      params.crosshairPrice != null &&
      Number.isFinite(params.crosshairPrice)
    ) {
      const mode = params.priceScaleMode ?? 'linear';
      const y = priceToY(
        params.crosshairPrice,
        mainBand.range,
        mainBand.top,
        mainBand.bottom,
        mode,
      );
      this.drawPriceTag(ctx, {
        y,
        text: formatPriceLabel(params.crosshairPrice, params.symbolFormat, mode),
        gutterEdge: layout.gutterEdge,
        gutterWidth: layout.gutterWidth,
        position: layout.position,
        font: this.priceOpts.font ?? DEFAULT_PRICE_SCALE_OPTIONS.font,
        background: 'rgba(41, 98, 255, 0.85)',
        textColor: '#ffffff',
      });
    }

    if (params.showTimeAxis !== false && params.crosshairTimeMs != null) {
      const ticks = this.tickCache?.timeTicks ?? [];
      if (ticks.length) {
        const timeAxisH = Math.floor(TIME_AXIS_CSS_PX * params.dpr);
        const top = params.timeAxisTop ?? layout.h - timeAxisH;
        const { from, to } = params.viewport.visibleBarIndexRange();
        const barIntervalMs = medianBarIntervalMs(params.bars, from, to);
        const match = ticks.reduce((best, t) =>
          Math.abs(t.timeMs - params.crosshairTimeMs!) <
          Math.abs(best.timeMs - params.crosshairTimeMs!)
            ? t
            : best,
        );
        const label = formatTimeAxisLabel(
          params.crosshairTimeMs,
          barIntervalMs,
          this.timeZone,
          undefined,
          this.formatters,
        );
        const boxW = measureTextWidth(ctx, label) + 8;
        if (typeof ctx.fillRect === 'function') {
          ctx.fillStyle = 'rgba(41, 98, 255, 0.9)';
          ctx.fillRect(match.x - boxW / 2, top + 2, boxW, 14);
        }
        ctx.font = this.timeOpts.font ?? DEFAULT_TIME_SCALE_OPTIONS.font;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, match.x, top + 4);
      }
    }
  }

  private drawPriceBandStatic(
    ctx: CanvasRenderingContext2D,
    spec: {
      band: PriceBandDrawSpec;
      ticks: PriceTick[];
      gutterEdge: number;
      gutterWidth: number;
      position: 'left' | 'right';
      font: string;
      mode: PriceScaleMode;
      format?: SymbolPriceFormat;
      kind: 'price' | 'volume';
    },
  ): void {
    const { band, ticks, gutterEdge, position, font } = spec;
    const { top, bottom } = band;
    if (bottom <= top) return;

    ctx.font = font;
    ctx.fillStyle = this.priceOpts.textColor ?? DEFAULT_PRICE_SCALE_OPTIONS.textColor;
    ctx.textBaseline = 'middle';

    const axisX = position === 'right' ? gutterEdge + 0.5 : gutterEdge + spec.gutterWidth - 0.5;
    ctx.beginPath();
    ctx.moveTo(axisX, top);
    ctx.lineTo(axisX, bottom);
    ctx.stroke();

    const padX = 6;
    for (const tick of ticks) {
      if (position === 'right') {
        ctx.textAlign = 'left';
        ctx.fillText(tick.label, gutterEdge + padX, tick.y);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(tick.label, gutterEdge + spec.gutterWidth - padX, tick.y);
      }
    }
  }

  private drawPriceTag(
    ctx: CanvasRenderingContext2D,
    spec: {
      y: number;
      text: string;
      gutterEdge: number;
      gutterWidth: number;
      position: 'left' | 'right';
      font: string;
      background: string;
      textColor: string;
    },
  ): void {
    ctx.font = spec.font;
    const padH = 4;
    const boxH = 16;
    const boxW = measureTextWidth(ctx, spec.text) + padH * 2;
    const x =
      spec.position === 'right'
        ? spec.gutterEdge + 4
        : spec.gutterEdge + spec.gutterWidth - boxW - 4;

    if (typeof ctx.fillRect === 'function') {
      ctx.fillStyle = spec.background;
      ctx.fillRect(x, spec.y - boxH / 2, boxW, boxH);
    }
    ctx.fillStyle = spec.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.text, x + padH, spec.y);
  }

  private drawTimeBandStatic(
    ctx: CanvasRenderingContext2D,
    spec: {
      plotRight: number;
      canvasW: number;
      canvasH: number;
      timeTop: number;
      ticks: TimeTick[];
      font: string;
    },
  ): void {
    ctx.strokeStyle = this.timeOpts.borderColor ?? DEFAULT_TIME_SCALE_OPTIONS.borderColor;
    ctx.beginPath();
    ctx.moveTo(0, spec.timeTop + 0.5);
    ctx.lineTo(spec.canvasW, spec.timeTop + 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(spec.plotRight + 0.5, spec.timeTop);
    ctx.lineTo(spec.plotRight + 0.5, spec.canvasH);
    ctx.stroke();

    ctx.font = spec.font;
    ctx.fillStyle = this.timeOpts.textColor ?? DEFAULT_TIME_SCALE_OPTIONS.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const tick of spec.ticks) {
      ctx.fillText(tick.label, tick.x, spec.timeTop + 4);
    }
  }
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string): number {
  if (typeof ctx.measureText === 'function') {
    return ctx.measureText(text).width;
  }
  return text.length * 6.5;
}