import type { Bar } from '@coderyo/data';
import type { ChartViewport } from '../chart-viewport.js';
import type { PriceRange, PriceScaleMode } from '../price-scale.js';
import { ScaleRenderer, type PriceBandDrawSpec, type ScaleDrawParams } from './scale-renderer.js';
import {
  ScaleInteraction,
  type PriceBandKind,
  type ScaleLayoutCss,
} from './scale-interaction.js';
import { translatePriceRange } from './price-scale-engine.js';
import {
  DEFAULT_PRICE_SCALE_OPTIONS,
  DEFAULT_TIME_SCALE_OPTIONS,
  mergePriceScaleOptions,
  mergeTimeScaleOptions,
  type PriceScaleOptions,
  type SymbolPriceFormat,
  type TimeScaleOptions,
} from './scale-types.js';

export interface PaneScaleHostDrawInput {
  deviceWidth: number;
  deviceHeight: number;
  cssWidth: number;
  dpr: number;
  viewport: ChartViewport;
  bars: readonly Bar[];
  priceBands: PriceBandDrawSpec[];
  priceScaleMode?: PriceScaleMode;
  showTimeAxis?: boolean;
  timeAxisTop?: number;
  crosshairPrice?: number | null;
  crosshairTimeMs?: number | null;
  lastPrice?: number | null;
  volumeBandTopCss?: number;
  volumeBandBottomCss?: number;
}

export interface PaneScaleHostOptions {
  interactionElement?: HTMLElement;
  getAutoPriceRange: (band: PriceBandKind) => PriceRange;
  getAutoVolumeRange?: () => PriceRange;
  requestRender: () => void;
  getCssLayout: () => ScaleLayoutCss;
  priceScaleMode?: () => PriceScaleMode;
  enableTimeInteraction?: boolean;
}

/**
 * Facade: 2D scale overlay + interaction for one chart surface.
 */
export class PaneScaleHost {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly renderer = new ScaleRenderer();
  private scaleInteraction: ScaleInteraction | null = null;
  private priceOpts: PriceScaleOptions = { ...DEFAULT_PRICE_SCALE_OPTIONS };
  private timeOpts: TimeScaleOptions = { ...DEFAULT_TIME_SCALE_OPTIONS };
  private symbolFormat: SymbolPriceFormat = {};
  private priceRangeOverride: PriceRange | null = null;
  private volumeRangeOverride: PriceRange | null = null;
  private timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  private crosshairOnly = false;

  constructor(
    parent: HTMLElement,
    private readonly options: PaneScaleHostOptions,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    parent.style.position = parent.style.position || 'relative';
    parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable for chart scales');
    this.ctx = ctx;
  }

  getOverlayCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  bindViewport(viewport: ChartViewport): void {
    if (!this.options.interactionElement) return;
    this.scaleInteraction?.destroy();
    this.scaleInteraction = new ScaleInteraction(this.options.interactionElement, {
      viewport,
      getLayout: this.options.getCssLayout,
      priceAxisPosition: () => this.priceOpts.position ?? 'right',
      priceScaleMode: this.options.priceScaleMode,
      enableTimeInteraction: () => this.options.enableTimeInteraction !== false,
      callbacks: {
        requestRender: this.options.requestRender,
        getAutoPriceRange: (band) =>
          band === 'volume'
            ? (this.options.getAutoVolumeRange?.() ?? this.options.getAutoPriceRange('volume'))
            : this.options.getAutoPriceRange('price'),
        getPriceRangeOverride: (band) =>
          band === 'volume' ? this.volumeRangeOverride : this.priceRangeOverride,
        onPriceRangeOverride: (band, r) => {
          if (band === 'volume') this.volumeRangeOverride = r;
          else this.priceRangeOverride = r;
          this.renderer.invalidate();
        },
      },
    });
  }

  applyPriceScaleOptions(patch?: Partial<PriceScaleOptions>): void {
    this.priceOpts = mergePriceScaleOptions(this.priceOpts, patch);
    this.renderer.setPriceOptions(this.priceOpts);
    this.renderer.invalidate();
  }

  applyTimeScaleOptions(patch?: Partial<TimeScaleOptions>): void {
    this.timeOpts = mergeTimeScaleOptions(this.timeOpts, patch);
    this.renderer.setTimeOptions(this.timeOpts);
    this.renderer.invalidate();
  }

  setSymbolPriceFormat(format: SymbolPriceFormat): void {
    this.symbolFormat = format;
    this.renderer.invalidate();
  }

  setTimezone(tz: string): void {
    this.timeZone = tz || 'UTC';
    this.renderer.setTimezone(this.timeZone);
    this.renderer.invalidate();
  }

  getEffectivePriceRange(autoRange: PriceRange, kind: PriceBandKind = 'price'): PriceRange {
    const override = kind === 'volume' ? this.volumeRangeOverride : this.priceRangeOverride;
    return override ?? autoRange;
  }

  clearPriceRangeOverride(kind?: PriceBandKind): void {
    if (kind === 'volume' || kind === undefined) this.volumeRangeOverride = null;
    if (kind === 'price' || kind === undefined) this.priceRangeOverride = null;
    this.renderer.invalidate();
  }

  /** Vertical plot drag: shift effective range (TV chart-body pan). */
  panPriceRange(band: PriceBandKind, dyPx: number, plotHeightPx: number): void {
    if (!Number.isFinite(dyPx) || dyPx === 0 || plotHeightPx <= 0) return;
    const auto = this.options.getAutoPriceRange(band);
    const current = this.getEffectivePriceRange(auto, band);
    const span = current.max - current.min;
    if (span <= 0) return;
    const shift = (dyPx / plotHeightPx) * span;
    const next = translatePriceRange(current, shift);
    if (band === 'volume') this.volumeRangeOverride = next;
    else this.priceRangeOverride = next;
    this.renderer.invalidate();
    this.options.requestRender();
  }

  resize(cssWidth: number, cssHeight: number, dpr = globalThis.devicePixelRatio ?? 1): void {
    const w = Math.max(1, Math.floor(cssWidth * dpr));
    const h = Math.max(1, Math.floor(cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.renderer.invalidate();
    }
  }

  draw(input: PaneScaleHostDrawInput): void {
    const hadCrosshair =
      input.crosshairPrice != null ||
      input.crosshairTimeMs != null ||
      input.lastPrice != null;
    this.crosshairOnly = hadCrosshair;

    const priceBands = input.priceBands.map((b) => {
      const kind = b.kind ?? 'price';
      return {
        ...b,
        range: this.getEffectivePriceRange(b.range, kind),
      };
    });

    const params: ScaleDrawParams = {
      deviceWidth: input.deviceWidth,
      deviceHeight: input.deviceHeight,
      cssWidth: input.cssWidth,
      dpr: input.dpr,
      viewport: input.viewport,
      bars: input.bars,
      priceBands,
      showTimeAxis: input.showTimeAxis,
      timeAxisTop: input.timeAxisTop,
      priceScaleMode: input.priceScaleMode,
      symbolFormat: this.symbolFormat,
      crosshairPrice: input.crosshairPrice,
      crosshairTimeMs: input.crosshairTimeMs,
      lastPrice: input.lastPrice,
    };

    this.renderer.draw(this.ctx, params, { crosshairOnly: this.crosshairOnly });
  }

  destroy(): void {
    this.scaleInteraction?.destroy();
    this.scaleInteraction = null;
    this.canvas.remove();
  }
}