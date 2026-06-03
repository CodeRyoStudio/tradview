import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { detectIndicatorBarMutation } from '../src/indicator-panes.js';

function bar(t: number): Bar {
  return { t, o: 1, h: 2, l: 0.5, c: 1.5, v: 10, barSeq: String(t) };
}

describe('detectIndicatorBarMutation', () => {
  const base = [1, 2, 3].map((i) => bar(i).t);

  it('returns full when history shrinks or prefix changes', () => {
    expect(detectIndicatorBarMutation(base, [bar(1), bar(2)])).toBe('full');
    expect(detectIndicatorBarMutation(base, [bar(9), bar(2), bar(3)])).toBe('full');
  });

  it('detects tail-update and tail-append', () => {
    expect(detectIndicatorBarMutation(base, [bar(1), bar(2), bar(3)])).toBe('tail-update');
    expect(detectIndicatorBarMutation(base, [bar(1), bar(2), bar(3), bar(4)])).toBe('tail-append');
  });
});