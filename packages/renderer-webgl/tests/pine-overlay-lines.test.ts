import { describe, expect, it } from 'vitest';
import { pinePlotsToLineSpecs } from '../src/pine-overlay-lines.js';

describe('pinePlotsToLineSpecs (Appendix A / review #6)', () => {
  it('maps plot values to line specs', () => {
    const specs = pinePlotsToLineSpecs([
      { title: 'p1', color: '#ff0000', values: [1, 2, null, 4] },
    ]);
    expect(specs).toHaveLength(1);
    expect(specs[0]!.values).toEqual([1, 2, null, 4]);
    expect(specs[0]!.color[0]).toBeCloseTo(1, 1);
  });

  it('returns empty for null plots', () => {
    expect(pinePlotsToLineSpecs(null)).toEqual([]);
  });
});