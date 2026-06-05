import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { sma } from '@coderyo/indicators';
import { buildVolMaLineSpec, computeVolMaValues } from './volume-overlays.js';

function bars(n: number): Bar[] {
  return Array.from({ length: n }, (_, i) => ({
    t: i * 60_000,
    o: 10,
    h: 12,
    l: 8,
    c: 10,
    v: 100 + i * 10,
  }));
}

describe('volume-overlays (vol MA lite parity)', () => {
  it('computeVolMaValues matches SMA on volume field', () => {
    const data = bars(12);
    const volBars = data.map((b) => ({ ...b, c: b.v ?? 0 }));
    const expected = sma(volBars, 5, 'close');
    expect(computeVolMaValues(data, 5)).toEqual(expected);
  });

  it('buildVolMaLineSpec returns null when showVolMa off', () => {
    expect(
      buildVolMaLineSpec(bars(10), { ...DEFAULT_INDICATOR_CONFIG, showVolMa: false }),
    ).toBeNull();
  });

  it('buildVolMaLineSpec returns null when volume pane hidden', () => {
    expect(
      buildVolMaLineSpec(bars(10), {
        ...DEFAULT_INDICATOR_CONFIG,
        showVolMa: true,
        showVolume: false,
      }),
    ).toBeNull();
  });

  it('buildVolMaLineSpec returns line aligned to bars', () => {
    const spec = buildVolMaLineSpec(bars(20), {
      ...DEFAULT_INDICATOR_CONFIG,
      showVolMa: true,
      volMaPeriod: 5,
    });
    expect(spec).not.toBeNull();
    expect(spec!.values).toHaveLength(20);
    expect(spec!.values[4]).not.toBeNull();
    expect(spec!.values[3]).toBeNull();
  });
});