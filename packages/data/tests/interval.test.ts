import { describe, expect, it } from 'vitest';
import {
  INTERVAL_REGISTRY,
  InvalidIntervalError,
  intervalMs,
  parseInterval,
} from '../src/interval.js';

describe('interval registry', () => {
  it('parses canonical intervals', () => {
    expect(parseInterval('1m')).toBe('1m');
    expect(parseInterval('1D')).toBe('1D');
    expect(intervalMs('1h')).toBe(3_600_000);
  });

  it('rejects invalid intervals', () => {
    expect(() => parseInterval('1H')).toThrow(InvalidIntervalError);
    expect(() => parseInterval('2m')).toThrow(InvalidIntervalError);
  });

  it('parses sub-second intervals', () => {
    expect(parseInterval('1s')).toBe('1s');
    expect(intervalMs('5s')).toBe(5_000);
    expect(intervalMs('30s')).toBe(30_000);
  });

  it('covers all registry entries', () => {
    expect(Object.keys(INTERVAL_REGISTRY)).toHaveLength(11);
  });
});