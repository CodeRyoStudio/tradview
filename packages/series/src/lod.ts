import type { Bar } from '@tradview/data';

/** Downsample bars for render when visible count exceeds maxPoints (§11.5 LOD). */
export function lodDecimateBars(bars: Bar[], maxPoints: number): Bar[] {
  if (bars.length <= maxPoints) return bars;
  const step = Math.ceil(bars.length / maxPoints);
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += step) {
    const chunk = bars.slice(i, i + step);
    if (chunk.length === 0) continue;
    const first = chunk[0]!;
    const last = chunk[chunk.length - 1]!;
    let h = first.h;
    let l = first.l;
    let v = 0;
    for (const b of chunk) {
      h = Math.max(h, b.h);
      l = Math.min(l, b.l);
      v += b.v ?? 0;
    }
    out.push({
      t: first.t,
      o: first.o,
      h,
      l,
      c: last.c,
      v,
    });
  }
  return out;
}