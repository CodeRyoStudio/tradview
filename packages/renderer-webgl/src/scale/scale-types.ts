/** Freeze-friendly price scale styling (TV tick logic is fixed). */
export interface PriceScaleOptions {
  position?: 'left' | 'right';
  textColor?: string;
  borderColor?: string;
  font?: string;
  lastPriceBackground?: string;
  lastPriceTextColor?: string;
}

/** Freeze-friendly time scale styling. */
export interface TimeScaleOptions {
  textColor?: string;
  borderColor?: string;
  font?: string;
}

/** Symbol-driven formatting from {@link SymbolInfo} / chart controller. */
export interface SymbolPriceFormat {
  precision?: number;
  minMove?: number;
}

export const DEFAULT_PRICE_SCALE_OPTIONS: Required<
  Pick<
    PriceScaleOptions,
    | 'position'
    | 'textColor'
    | 'borderColor'
    | 'font'
    | 'lastPriceBackground'
    | 'lastPriceTextColor'
  >
> = {
  position: 'right',
  textColor: '#8b949e',
  borderColor: 'rgba(48, 54, 61, 0.9)',
  font: '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  lastPriceBackground: '#2962ff',
  lastPriceTextColor: '#ffffff',
};

export const DEFAULT_TIME_SCALE_OPTIONS: Required<
  Pick<TimeScaleOptions, 'textColor' | 'borderColor' | 'font'>
> = {
  textColor: '#8b949e',
  borderColor: 'rgba(48, 54, 61, 0.9)',
  font: '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

export const TIME_AXIS_CSS_PX = 22;
export const MIN_TICK_SPACING_PX = 52;

export function mergePriceScaleOptions(
  base: PriceScaleOptions,
  patch?: Partial<PriceScaleOptions>,
): PriceScaleOptions {
  return { ...base, ...patch };
}

export function mergeTimeScaleOptions(
  base: TimeScaleOptions,
  patch?: Partial<TimeScaleOptions>,
): TimeScaleOptions {
  return { ...base, ...patch };
}

/** Fixed decimals for indicator pane axes (not symbol OHLC minMove). */
export const DEFAULT_INDICATOR_PRICE_FORMAT: SymbolPriceFormat = { precision: 4 };

export function symbolFormatFromInfo(info?: {
  priceScale?: number;
  minMove?: number;
}): SymbolPriceFormat {
  const minMove = info?.minMove;
  const priceScale = info?.priceScale;
  let precision: number | undefined;
  if (minMove != null && minMove > 0) {
    precision = decimalsFromMinMove(minMove);
  } else if (priceScale != null && priceScale > 0) {
    precision = Math.max(0, Math.round(Math.log10(priceScale)));
  }
  return { precision, minMove };
}

export function decimalsFromMinMove(minMove: number): number {
  if (!Number.isFinite(minMove) || minMove <= 0) return 2;
  const s = minMove.toString();
  const dot = s.indexOf('.');
  if (dot < 0) return 0;
  return s.length - dot - 1;
}