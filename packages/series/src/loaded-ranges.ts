export interface TimeRange {
  fromMs: number;
  toMs: number;
}

export function mergeLoadedRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.fromMs - b.fromMs);
  const out: TimeRange[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.fromMs <= last.toMs + 1) {
      last.toMs = Math.max(last.toMs, cur.toMs);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function rangeFromBars(times: number[]): TimeRange | null {
  if (times.length === 0) return null;
  return { fromMs: times[0]!, toMs: times[times.length - 1]! };
}

/** Contiguous loaded segments; gaps larger than ~1.5× bar step become holes. */
export function rangesFromSortedTimes(times: number[], stepMs: number): TimeRange[] {
  if (times.length === 0) return [];
  const gapThreshold = stepMs * 1.5;
  const out: TimeRange[] = [];
  let segStart = times[0]!;
  let segEnd = times[0]!;

  for (let i = 1; i < times.length; i++) {
    const t = times[i]!;
    if (t - segEnd > gapThreshold) {
      out.push({ fromMs: segStart, toMs: segEnd });
      segStart = t;
      segEnd = t;
    } else {
      segEnd = t;
    }
  }
  out.push({ fromMs: segStart, toMs: segEnd });
  return mergeLoadedRanges(out);
}