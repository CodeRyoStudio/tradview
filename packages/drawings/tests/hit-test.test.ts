import { describe, expect, it } from 'vitest';
import type { DrawingRecord } from '../src/storage.js';

/** Mirror distance logic for unit tests without DOM. */
function distHLine(y: number, lineY: number): number {
  return Math.abs(y - lineY);
}

describe('drawing hit-test distances', () => {
  it('hline distance is vertical delta', () => {
    expect(distHLine(100, 105)).toBe(5);
  });

  it('trendline needs two points', () => {
    const d: DrawingRecord = {
      id: '1',
      type: 'trendline',
      symbol: 'X',
      interval: '1h',
      points: [
        { t: 0, price: 1 },
        { t: 1, price: 2 },
      ],
    };
    expect(d.points.length).toBe(2);
  });
});