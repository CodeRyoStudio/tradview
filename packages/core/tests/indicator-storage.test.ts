import { describe, expect, it } from 'vitest';
import {
  createLocalChartStorage,
  loadIndicatorConfig,
  saveIndicatorConfig,
} from '../src/indicator-storage.js';
import { indicatorConfigStorageKey } from '@coderyo/indicators';

describe('indicator-storage', () => {
  it('round-trips config via in-memory adapter', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    const symbol = 'TEST:SYM';
    const interval = '1h';
    saveIndicatorConfig(storage, symbol, interval, {
      ...loadIndicatorConfig(storage, symbol, interval),
      showMacd: false,
      maPeriod: 99,
    });
    const loaded = loadIndicatorConfig(storage, symbol, interval);
    expect(loaded.showMacd).toBe(false);
    expect(loaded.maPeriod).toBe(99);
    expect(mem.has(indicatorConfigStorageKey(symbol, interval))).toBe(true);
  });

  it('createLocalChartStorage does not throw when localStorage missing', () => {
    expect(() => createLocalChartStorage()).not.toThrow();
  });
});