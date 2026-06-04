/** Built-in series accessors and indicators (Pine-lite v1 whitelist). */

export const SERIES_IDENTIFIERS = new Set([
  'close',
  'open',
  'high',
  'low',
  'volume',
  'hl2',
  'hlc3',
]);

/** Indicator builtins counted toward V2 GA target (≥18). Series ids are excluded. */
export const INDICATOR_BUILTINS = new Set([
  'sma',
  'ema',
  'rsi',
  'highest',
  'lowest',
  'crossover',
  'crossunder',
  'wma',
  'stdev',
  'change',
  'roc',
  'atr',
  'cci',
  'mfi',
  'stoch',
  'sum',
  'bb',
  'macd',
]);

export type IndicatorBuiltin =
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'highest'
  | 'lowest'
  | 'crossover'
  | 'crossunder'
  | 'wma'
  | 'stdev'
  | 'change'
  | 'roc'
  | 'atr'
  | 'cci'
  | 'mfi'
  | 'stoch'
  | 'sum'
  | 'bb'
  | 'macd';

/** Two-arg indicators: `fn(series, period)`. */
export const PERIOD_INDICATOR_BUILTINS = new Set([
  'sma',
  'ema',
  'rsi',
  'highest',
  'lowest',
  'wma',
  'stdev',
  'change',
  'roc',
  'atr',
  'cci',
  'mfi',
  'stoch',
  'sum',
  'bb',
  'macd',
]);

export function isBuiltin(name: string): boolean {
  return SERIES_IDENTIFIERS.has(name) || INDICATOR_BUILTINS.has(name);
}

export function builtinArity(name: string): number | null {
  if (SERIES_IDENTIFIERS.has(name)) return 0;
  if (PERIOD_INDICATOR_BUILTINS.has(name)) return 2;
  if (name === 'crossover' || name === 'crossunder') return 2;
  return null;
}