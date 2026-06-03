import { describe, expect, it } from 'vitest';
import { computeGapStartTimes } from '../src/gaps.js';

describe('computeGapStartTimes', () => {
  it('detects gaps wider than 1.5x interval', () => {
    const t0 = 0;
    const t1 = 60_000;
    const t2 = 180_000;
    const gaps = computeGapStartTimes([t0, t1, t2], '1m');
    expect(gaps).toEqual([t2]);
  });

  it('returns empty for contiguous 1m bars', () => {
    const times = [0, 60_000, 120_000];
    expect(computeGapStartTimes(times, '1m')).toEqual([]);
  });
});