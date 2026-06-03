import { describe, expect, it } from 'vitest';
import {
  computeIntervalViewport,
  targetVisibleBarsForInterval,
} from './viewport-fit.js';

describe('viewport-fit', () => {
  it('uses more visible bars for shorter intervals', () => {
    expect(targetVisibleBarsForInterval('1s')).toBeGreaterThan(targetVisibleBarsForInterval('1h'));
    expect(targetVisibleBarsForInterval('1h')).toBeGreaterThan(targetVisibleBarsForInterval('1W'));
  });

  it('computes range ending at latest bar and clamps bar spacing', () => {
    const times = Array.from({ length: 500 }, (_, i) => 1_700_000_000_000 + i * 60_000);
    const fit = computeIntervalViewport(times, '1m', 960);
    expect(fit).not.toBeNull();
    expect(fit!.range.toMs).toBeGreaterThan(fit!.range.fromMs);
    expect(fit!.barSpacing).toBeGreaterThanOrEqual(4);
    expect(fit!.barSpacing).toBeLessThanOrEqual(24);
    const visibleMs = fit!.range.toMs - fit!.range.fromMs;
    expect(visibleMs).toBeLessThan(500 * 60_000);
  });
});