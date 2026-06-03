import { intervalMs, type Interval } from '@coderyo/data';

/** Times (ms) at which to insert LWC whitespace before the next bar (§10.5). */
export function computeGapStartTimes(times: readonly number[], interval: Interval): number[] {
  if (times.length < 2) return [];
  const threshold = intervalMs(interval) * 1.5;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    if (times[i]! - times[i - 1]! > threshold) {
      gaps.push(times[i]!);
    }
  }
  return gaps;
}