import type { IndicatorConfig } from '@coderyo/indicators';
import {
  defaultChartStorage,
  loadIndicatorConfig as loadIndicatorConfigFromCore,
  saveIndicatorConfig as saveIndicatorConfigToCore,
} from '@coderyo/core';

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

/** @deprecated Prefer `@coderyo/core` `loadIndicatorConfig(storage, …)` when not using ui-shell. */
export function loadIndicatorConfig(symbol: string, interval: string): IndicatorConfig {
  return loadIndicatorConfigFromCore(defaultChartStorage, symbol, interval);
}

/** @deprecated Prefer `@coderyo/core` `saveIndicatorConfig(storage, …)` when not using ui-shell. */
export function saveIndicatorConfig(
  symbol: string,
  interval: string,
  config: IndicatorConfig,
): void {
  saveIndicatorConfigToCore(defaultChartStorage, symbol, interval, config);
}