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

export const INDICATOR_BUILTINS = new Set([
  'sma',
  'ema',
  'rsi',
  'highest',
  'lowest',
  'crossover',
  'crossunder',
]);

export function isBuiltin(name: string): boolean {
  return SERIES_IDENTIFIERS.has(name) || INDICATOR_BUILTINS.has(name);
}

export function builtinArity(name: string): number | null {
  if (SERIES_IDENTIFIERS.has(name)) return 0;
  if (name === 'sma' || name === 'ema' || name === 'rsi' || name === 'highest' || name === 'lowest') {
    return 2;
  }
  if (name === 'crossover' || name === 'crossunder') return 2;
  return null;
}