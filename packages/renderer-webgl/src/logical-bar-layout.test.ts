import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { lodDecimateBars } from '@coderyo/series';
import {
  barIndicesInLogicalRange,
  buildLogicalBarLayout,
  remapGapTimesAfterDecimation,
  timeMsAtLogicalIndex,
} from './logical-bar-layout.js';

function bar(t: number): Bar {
  return { t, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };
}

describe('buildLogicalBarLayout', () => {
  it('inserts a gap slot before bars at gap times', () => {
    const bars = [bar(1000), bar(5000), bar(9000)];
    const layout = buildLogicalBarLayout(bars, [5000]);
    expect(layout.logicalCount).toBe(4);
    expect(layout.barIndexAtLogical(0)).toBe(0);
    expect(layout.barIndexAtLogical(1)).toBe(-1);
    expect(layout.barIndexAtLogical(2)).toBe(1);
    expect(layout.barIndexAtLogical(3)).toBe(2);
    expect(layout.logicalIndexForBarIndex(1)).toBe(2);
  });

  it('maps logical range to bar indices for price range', () => {
    const bars = [bar(1000), bar(5000), bar(9000)];
    const layout = buildLogicalBarLayout(bars, [5000]);
    expect(barIndicesInLogicalRange(layout, 0, 3)).toEqual({ from: 0, to: 1 });
    expect(barIndicesInLogicalRange(layout, 2, 4)).toEqual({ from: 1, to: 2 });
  });

  it('timeMsAtLogicalIndex resolves gap slots from neighbors', () => {
    const bars = [bar(1000), bar(5000)];
    const layout = buildLogicalBarLayout(bars, [5000]);
    expect(timeMsAtLogicalIndex(bars, layout, 1)).toBe(1000);
  });

  it('remapGapTimesAfterDecimation keeps gaps only on surviving LOD bars', () => {
    const bars = Array.from({ length: 200 }, (_, i) => bar(1000 + i * 1000));
    const gapTimes = [bars[50]!.t, bars[150]!.t];
    const renderBars = lodDecimateBars(bars, 40);
    const remapped = remapGapTimesAfterDecimation(renderBars, gapTimes) ?? [];
    expect(remapped.every((t) => renderBars.some((b) => b.t === t))).toBe(true);
    const layout = buildLogicalBarLayout(renderBars, remapped);
    expect(layout.logicalCount).toBe(renderBars.length + remapped.length);
  });
});