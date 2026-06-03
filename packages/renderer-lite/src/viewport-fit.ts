import { intervalMs, type Interval } from '@coderyo/data';

/**
 * Default horizontal bar spacing (px) per interval so candle width feels consistent
 * when the integrator controls how many bars are loaded / visible.
 */
export function defaultBarSpacingForInterval(interval: Interval): number {
  const ms = intervalMs(interval);
  if (ms <= 1_000) return 3;
  if (ms <= 5_000) return 4;
  if (ms <= 15_000) return 5;
  if (ms <= 30_000) return 6;
  if (ms <= 60_000) return 7;
  if (ms <= 300_000) return 8;
  if (ms <= 900_000) return 9;
  if (ms <= 3_600_000) return 10;
  if (ms <= 14_400_000) return 11;
  return 12;
}

export function resolveBarSpacingForInterval(
  interval: Interval,
  overrides?: Partial<Record<Interval, number>>,
): number {
  const custom = overrides?.[interval];
  if (custom != null && Number.isFinite(custom) && custom > 0) {
    return Math.min(24, Math.max(2, custom));
  }
  return defaultBarSpacingForInterval(interval);
}