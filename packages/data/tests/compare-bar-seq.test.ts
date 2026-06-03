import { describe, expect, it } from 'vitest';
import { compareBarSeq } from '../src/compare-bar-seq.js';

describe('compareBarSeq', () => {
  it('compares uint64 decimal strings via bigint', () => {
    expect(compareBarSeq('100', '200')).toBe(-1);
    expect(compareBarSeq('200', '100')).toBe(1);
    expect(compareBarSeq('18446744073709551615', '18446744073709551614')).toBe(1);
  });

  it('compares opaque strings lexicographically', () => {
    expect(compareBarSeq('abc', 'abd')).toBe(-1);
    expect(compareBarSeq('snowflake-2', 'snowflake-10')).toBe(1);
  });

  it('returns 0 for equal values', () => {
    expect(compareBarSeq('42', '42')).toBe(0);
  });
});