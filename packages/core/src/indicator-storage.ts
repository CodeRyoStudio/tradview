import {
  DEFAULT_INDICATOR_CONFIG,
  indicatorConfigStorageKey,
  type IndicatorConfig,
} from '@coderyo/indicators';

/** Pluggable key-value storage for `indicatorPersist` (default: `localStorage`). */
export interface ChartStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createLocalChartStorage(): ChartStorageAdapter {
  return {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore quota / private mode */
      }
    },
  };
}

export const defaultChartStorage: ChartStorageAdapter = createLocalChartStorage();

export function loadIndicatorConfig(
  storage: ChartStorageAdapter,
  symbol: string,
  interval: string,
): IndicatorConfig {
  try {
    const raw = storage.getItem(indicatorConfigStorageKey(symbol, interval));
    if (!raw) return { ...DEFAULT_INDICATOR_CONFIG };
    return { ...DEFAULT_INDICATOR_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_INDICATOR_CONFIG };
  }
}

export function saveIndicatorConfig(
  storage: ChartStorageAdapter,
  symbol: string,
  interval: string,
  config: IndicatorConfig,
): void {
  try {
    storage.setItem(indicatorConfigStorageKey(symbol, interval), JSON.stringify(config));
  } catch {
    /* ignore */
  }
}