/** Canonical interval strings (case-sensitive per DESIGN §8.0). */
export const INTERVAL_REGISTRY = {
  '1s': 1_000,
  '5s': 5_000,
  '15s': 15_000,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1D': 86_400_000,
  '1W': 604_800_000,
} as const;

export type Interval = keyof typeof INTERVAL_REGISTRY;

export class InvalidIntervalError extends Error {
  readonly code = 'INVALID_INTERVAL' as const;

  constructor(interval: string) {
    super(`Invalid interval: ${interval}`);
    this.name = 'InvalidIntervalError';
  }
}

export function isInterval(value: string): value is Interval {
  return Object.prototype.hasOwnProperty.call(INTERVAL_REGISTRY, value);
}

export function parseInterval(value: string): Interval {
  if (!isInterval(value)) {
    throw new InvalidIntervalError(value);
  }
  return value;
}

export function intervalMs(interval: Interval): number {
  return INTERVAL_REGISTRY[interval];
}

export const SUB_SECOND_INTERVALS: Interval[] = ['1s', '5s', '15s', '30s'];

export const DEFAULT_INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];

/** Playground / advanced integrators: sub-second + standard intervals. */
export const EXTENDED_INTERVALS: Interval[] = [...SUB_SECOND_INTERVALS, ...DEFAULT_INTERVALS];

export function floorBarOpenTime(t: number, interval: Interval): number {
  const ms = intervalMs(interval);
  return Math.floor(t / ms) * ms;
}