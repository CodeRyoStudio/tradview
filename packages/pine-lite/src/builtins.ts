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

export const INDICATOR_BUILTINS = new Set(['sma', 'ema', 'rsi']);

export function isBuiltin(name: string): boolean {
  return SERIES_IDENTIFIERS.has(name) || INDICATOR_BUILTINS.has(name);
}

export function builtinArity(name: string): number | null {
  if (SERIES_IDENTIFIERS.has(name)) return 0;
  if (name === 'sma' || name === 'ema' || name === 'rsi') return 2;
  return null;
}