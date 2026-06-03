import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { detectIndicatorBarMutation } from '../src/indicator-panes.js';

function bar(t: number): Bar {
  return { t, o: 1, h: 2, l: 0.5, c: 1.5, v: 10, barSeq: String(t) };
}

describe('detectIndicatorBarMutation after config change', () => {
  it('treats same-length series as tail-update only when times match', () => {
    const times = [1, 2, 3].map((i) => bar(i).t);
    const bars = times.map((t) => bar(t));
    expect(detectIndicatorBarMutation(times, bars)).toBe('tail-update');
  });
});