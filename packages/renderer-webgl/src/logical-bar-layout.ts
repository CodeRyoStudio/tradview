import type { Bar } from '@coderyo/data';

/**
 * Maps logical viewport indices (with optional gap slots) to bar indices.
 * Gap slots mirror lite/LWC `WhitespaceData` inserted before a bar (§10.5).
 */
export interface LogicalBarLayout {
  readonly logicalCount: number;
  /** `-1` = gap slot (no bar); otherwise index into the source `bars` array. */
  barIndexAtLogical(logical: number): number;
  logicalIndexForBarIndex(barIndex: number): number;
}

/**
 * After LOD decimation, keep only gap markers that still exist on rendered bars.
 */
export function remapGapTimesAfterDecimation(
  renderBars: readonly Bar[],
  gapTimes?: readonly number[],
): readonly number[] | undefined {
  if (!gapTimes?.length) return undefined;
  const gapSet = new Set(gapTimes);
  const out = renderBars.map((b) => b.t).filter((t) => gapSet.has(t));
  return out.length > 0 ? out : undefined;
}

export function buildLogicalBarLayout(
  bars: readonly Bar[],
  gapTimes?: readonly number[],
): LogicalBarLayout {
  const gapSet = new Set(gapTimes ?? []);
  const logicalToBar: number[] = [];
  const barToLogical: number[] = new Array(bars.length);

  for (let i = 0; i < bars.length; i++) {
    if (gapSet.has(bars[i]!.t)) {
      logicalToBar.push(-1);
    }
    barToLogical[i] = logicalToBar.length;
    logicalToBar.push(i);
  }

  return {
    logicalCount: logicalToBar.length,
    barIndexAtLogical(logical) {
      return logicalToBar[logical] ?? -1;
    },
    logicalIndexForBarIndex(barIndex) {
      return barToLogical[barIndex] ?? barIndex;
    },
  };
}

/** Interpolate time at a fractional logical index (gap slots use neighbor bar times). */
export function timeMsAtLogicalIndex(
  bars: readonly Bar[],
  layout: LogicalBarLayout | null,
  logicalIndex: number,
): number {
  if (bars.length === 0) return 0;
  if (!layout || layout.logicalCount === bars.length) {
    return timeMsAtBarIndexPlain(bars, logicalIndex);
  }
  const li = Math.max(0, Math.min(layout.logicalCount - 1, logicalIndex));
  const barIdx = layout.barIndexAtLogical(li);
  if (barIdx >= 0) return bars[barIdx]!.t;
  for (let d = 1; d < layout.logicalCount; d++) {
    const prev = layout.barIndexAtLogical(li - d);
    if (prev >= 0) return bars[prev]!.t;
    const next = layout.barIndexAtLogical(li + d);
    if (next >= 0) return bars[next]!.t;
  }
  return bars[0]!.t;
}

/** Collect bar indices intersecting a logical visible range (skips gap slots). */
export function barIndicesInLogicalRange(
  layout: LogicalBarLayout | null,
  logicalFrom: number,
  logicalTo: number,
): { from: number; to: number } {
  if (!layout || layout.logicalCount === 0) {
    return { from: 0, to: -1 };
  }
  let from = Number.POSITIVE_INFINITY;
  let to = -1;
  const start = Math.max(0, Math.floor(logicalFrom));
  const end = Math.min(layout.logicalCount - 1, Math.ceil(logicalTo) - 1);
  for (let i = start; i <= end; i++) {
    const bi = layout.barIndexAtLogical(i);
    if (bi < 0) continue;
    from = Math.min(from, bi);
    to = Math.max(to, bi);
  }
  if (to < from) return { from: 0, to: -1 };
  return { from, to };
}

function timeMsAtBarIndexPlain(bars: readonly Bar[], index: number): number {
  if (bars.length === 0) return 0;
  if (index <= 0) return bars[0]!.t;
  if (index >= bars.length - 1) return bars[bars.length - 1]!.t;
  const i = Math.floor(index);
  const f = index - i;
  return bars[i]!.t + f * (bars[i + 1]!.t - bars[i]!.t);
}