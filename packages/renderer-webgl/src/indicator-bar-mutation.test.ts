import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { detectIndicatorBarMutation } from './indicator-bar-mutation.js';

function bar(t: number): Bar {
  return { t, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };
}

describe('detectIndicatorBarMutation (webgl)', () => {
  const base = [1, 2, 3].map((i) => bar(i).t);

  it('matches lite parity for tail mutations', () => {
    expect(detectIndicatorBarMutation(base, [bar(1), bar(2), bar(3)])).toBe('tail-update');
    expect(detectIndicatorBarMutation(base, [bar(1), bar(2), bar(3), bar(4)])).toBe('tail-append');
    expect(detectIndicatorBarMutation(base, [bar(9), bar(2), bar(3)])).toBe('full');
  });
});