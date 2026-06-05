import { describe, expect, it } from 'vitest';
import {
  formatPriceAxisLabel,
  formatTimeAxisLabel,
  medianBarIntervalMs,
} from './chart-axis-format.js';

describe('chart-axis-format', () => {
  it('formatPriceAxisLabel compresses large values', () => {
    expect(formatPriceAxisLabel(94_250.5)).toMatch(/9425/);
    expect(formatPriceAxisLabel(1_500_000_000)).toBe('1.50B');
  });

  it('medianBarIntervalMs uses middle delta', () => {
    const bars = [
      { t: 0 },
      { t: 60_000 },
      { t: 120_000 },
      { t: 180_000 },
    ];
    expect(medianBarIntervalMs(bars, 0, 3)).toBe(60_000);
  });

  it('formatTimeAxisLabel adapts to bar interval', () => {
    const ms = Date.UTC(2024, 5, 1, 14, 30);
    const daily = formatTimeAxisLabel(ms, 86_400_000);
    const hourly = formatTimeAxisLabel(ms, 3_600_000);
    expect(daily.length).toBeGreaterThan(4);
    expect(hourly).toContain('30');
    expect(hourly).not.toBe(daily);
    expect(formatTimeAxisLabel(ms, 60_000).length).toBeGreaterThan(4);
  });
});