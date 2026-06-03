import type { IndicatorConfig } from '@tradview/indicators';
import { DEFAULT_INDICATOR_CONFIG, indicatorConfigStorageKey } from '@tradview/indicators';

export const GRID_SETTING_KEY = 'tradview:settings:showGrid';
export const RETURN_CURSOR_KEY = 'tradview:settings:returnToCursorAfterDraw';

export function loadShowGridPreference(): boolean {
  try {
    return localStorage.getItem(GRID_SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveShowGridPreference(show: boolean): void {
  try {
    localStorage.setItem(GRID_SETTING_KEY, show ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadReturnToCursorPreference(): boolean {
  try {
    return localStorage.getItem(RETURN_CURSOR_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveReturnToCursorPreference(v: boolean): void {
  try {
    localStorage.setItem(RETURN_CURSOR_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadIndicatorConfig(symbol: string, interval: string): IndicatorConfig {
  try {
    const raw = localStorage.getItem(indicatorConfigStorageKey(symbol, interval));
    if (!raw) return { ...DEFAULT_INDICATOR_CONFIG };
    return { ...DEFAULT_INDICATOR_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_INDICATOR_CONFIG };
  }
}

export function saveIndicatorConfig(
  symbol: string,
  interval: string,
  config: IndicatorConfig,
): void {
  try {
    localStorage.setItem(indicatorConfigStorageKey(symbol, interval), JSON.stringify(config));
  } catch {
    /* ignore */
  }
}