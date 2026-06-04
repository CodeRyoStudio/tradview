import { describe, expect, it } from 'vitest';
import type { Bar } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { buildMainOverlayLineSpecs } from './main-chart-overlays.js';

function bars(n: number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const c = 100 + i * 0.1;
    out.push({ t: i * 60_000, o: c, h: c + 1, l: c - 1, c, v: 10 });
  }
  return out;
}

describe('buildMainOverlayLineSpecs (V2-R6)', () => {
  it('returns MA line when showMa', () => {
    const specs = buildMainOverlayLineSpecs(bars(40), {
      ...DEFAULT_INDICATOR_CONFIG,
      showBoll: false,
      showEma: false,
      showMa: true,
    });
    expect(specs).toHaveLength(1);
    expect(specs[0]!.values).toHaveLength(40);
  });

  it('returns three BOLL lines when showBoll', () => {
    const specs = buildMainOverlayLineSpecs(bars(30), {
      ...DEFAULT_INDICATOR_CONFIG,
      showMa: false,
      showEma: false,
      showBoll: true,
    });
    expect(specs).toHaveLength(3);
    for (const s of specs) {
      expect(s.values).toHaveLength(30);
    }
  });
});