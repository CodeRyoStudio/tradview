import { intervalMs, type Interval } from '@coderyo/data';
import type { ChartVisibleRange } from './time-scale-bus.js';

/** Target number of candles visible after interval change (shorter intervals → more bars). */
export function targetVisibleBarsForInterval(interval: Interval): number {
  const ms = intervalMs(interval);
  if (ms <= 5_000) return 180;
  if (ms <= 30_000) return 150;
  if (ms <= 300_000) return 120;
  if (ms <= 3_600_000) return 100;
  if (ms <= 86_400_000) return 80;
  return 60;
}

export interface IntervalViewportFit {
  range: ChartVisibleRange;
  barSpacing: number;
}

/**
 * Pick a time window ending at the latest bar and bar spacing so candles are neither
 * too compressed nor too zoomed for the active interval.
 */
export function computeIntervalViewport(
  barTimesMs: number[],
  interval: Interval,
  chartWidthPx: number,
): IntervalViewportFit | null {
  if (barTimesMs.length === 0 || chartWidthPx <= 0) return null;

  const count = targetVisibleBarsForInterval(interval);
  const endIdx = barTimesMs.length - 1;
  const startIdx = Math.max(0, endIdx - count + 1);
  const fromMs = barTimesMs[startIdx]!;
  const toMs = barTimesMs[endIdx]! + intervalMs(interval);
  const visibleBars = endIdx - startIdx + 1;
  const spacing = chartWidthPx / (visibleBars * 1.12);
  const barSpacing = Math.min(24, Math.max(4, spacing));

  return { range: { fromMs, toMs }, barSpacing };
}