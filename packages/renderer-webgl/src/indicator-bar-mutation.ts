import type { Bar } from '@coderyo/data';

/** PR-21 / lite parity: detect in-place tail updates vs full recompute. */
export function detectIndicatorBarMutation(
  prevTimes: readonly number[],
  bars: readonly Bar[],
): 'full' | 'tail-append' | 'tail-update' {
  if (bars.length === 0 || prevTimes.length === 0) return 'full';
  if (bars.length < prevTimes.length) return 'full';
  for (let i = 0; i < prevTimes.length - 1; i++) {
    if (bars[i]!.t !== prevTimes[i]) return 'full';
  }
  if (bars.length === prevTimes.length) {
    return bars[bars.length - 1]!.t === prevTimes[prevTimes.length - 1]
      ? 'tail-update'
      : 'full';
  }
  if (bars.length === prevTimes.length + 1) {
    return bars[prevTimes.length - 1]!.t === prevTimes[prevTimes.length - 1]
      ? 'tail-append'
      : 'full';
  }
  return 'full';
}