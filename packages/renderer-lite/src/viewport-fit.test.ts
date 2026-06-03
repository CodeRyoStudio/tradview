import { describe, expect, it } from 'vitest';
import {
  defaultBarSpacingForInterval,
  resolveBarSpacingForInterval,
} from './viewport-fit.js';

describe('viewport-fit', () => {
  it('uses tighter spacing for shorter intervals', () => {
    expect(defaultBarSpacingForInterval('1s')).toBeLessThan(defaultBarSpacingForInterval('1h'));
    expect(defaultBarSpacingForInterval('1h')).toBeLessThan(defaultBarSpacingForInterval('1W'));
  });

  it('allows integrator overrides per interval', () => {
    expect(resolveBarSpacingForInterval('1m', { '1m': 14 })).toBe(14);
    expect(resolveBarSpacingForInterval('1m', { '1m': 0 })).toBe(defaultBarSpacingForInterval('1m'));
    expect(resolveBarSpacingForInterval('1m', { '1m': 99 })).toBe(24);
  });
});