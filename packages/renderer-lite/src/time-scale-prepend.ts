import type { LogicalRange } from 'lightweight-charts';
import type { TimeScaleBus } from './time-scale-bus.js';
import type { TimeScaleBusRegistry } from './time-scale-bus-registry.js';

/** Slice of loaded bar open times for the current render window (DESIGN §10.4.1). */
export function buildSliceTimes(
  sortedTimes: readonly number[],
  renderFromMs: number,
  renderToMs: number,
): number[] {
  return sortedTimes.filter((t) => t >= renderFromMs && t <= renderToMs);
}

/** Count bars newly present in slice after prepend merge. */
export function countPrependSliceDelta(beforeSlice: readonly number[], afterSlice: readonly number[]): number {
  const before = new Set(beforeSlice);
  let delta = 0;
  for (const t of afterSlice) {
    if (!before.has(t)) delta += 1;
  }
  return delta;
}

/** Map LWC logical index (position in slice) to canonical bar time `t` (ms). */
export function logicalIndexToBarTimeMs(sliceTimes: readonly number[], logicalIndex: number): number | null {
  if (sliceTimes.length === 0) return null;
  const idx = Math.min(Math.max(0, Math.floor(logicalIndex)), sliceTimes.length - 1);
  return sliceTimes[idx] ?? null;
}

/** Mirrors {@link VirtualWindow.getRenderRange} for prepend slice math. */
export function deriveRenderRange(
  visibleFromMs: number,
  visibleToMs: number,
  sortedTimes: readonly number[],
  intervalMs: number,
): { renderFromMs: number; renderToMs: number } {
  if (visibleToMs <= visibleFromMs && sortedTimes.length > 0) {
    const fromMs = sortedTimes[0]!;
    const toMs = sortedTimes[sortedTimes.length - 1]!;
    const bufferMs = intervalMs * 20;
    return { renderFromMs: fromMs - bufferMs, renderToMs: toMs + bufferMs };
  }
  const span = visibleToMs - visibleFromMs;
  const bufferMs = Math.max(span * 0.1, intervalMs * 50);
  return {
    renderFromMs: visibleFromMs - bufferMs,
    renderToMs: visibleToMs + bufferMs,
  };
}

/** Logical range covering canonical visible ms within a slice (DESIGN §10.4.1 fallback). */
export function logicalRangeForVisibleWindow(
  sliceTimes: readonly number[],
  visibleFromMs: number,
  visibleToMs: number,
): LogicalRange | null {
  if (sliceTimes.length === 0 || visibleToMs <= visibleFromMs) return null;
  let fromIdx = 0;
  let toIdx = sliceTimes.length - 1;
  for (let i = 0; i < sliceTimes.length; i++) {
    if (sliceTimes[i]! >= visibleFromMs) {
      fromIdx = i;
      break;
    }
  }
  for (let i = sliceTimes.length - 1; i >= 0; i--) {
    if (sliceTimes[i]! <= visibleToMs) {
      toIdx = i;
      break;
    }
  }
  if (toIdx < fromIdx) return null;
  return { from: fromIdx, to: toIdx } as LogicalRange;
}

export interface PrependSliceDeltaInput {
  sortedTimesBefore: readonly number[];
  sortedTimesAfter: readonly number[];
  visibleFromMs: number;
  visibleToMs: number;
  intervalMs: number;
}

/** Δ new bars in render slice after historical prepend (canonical ms window unchanged). */
export function computePrependSliceDeltaForViewport(input: PrependSliceDeltaInput): number {
  const { visibleFromMs, visibleToMs, intervalMs, sortedTimesBefore, sortedTimesAfter } = input;
  const renderBefore = deriveRenderRange(visibleFromMs, visibleToMs, sortedTimesBefore, intervalMs);
  const renderAfter = deriveRenderRange(visibleFromMs, visibleToMs, sortedTimesAfter, intervalMs);
  const beforeSlice = buildSliceTimes(
    sortedTimesBefore,
    renderBefore.renderFromMs,
    renderBefore.renderToMs,
  );
  const afterSlice = buildSliceTimes(
    sortedTimesAfter,
    renderAfter.renderFromMs,
    renderAfter.renderToMs,
  );
  return countPrependSliceDelta(beforeSlice, afterSlice);
}

export interface CompensatePrependOnRegistryOptions {
  registry: TimeScaleBusRegistry;
  sortedTimesBefore: readonly number[];
  sortedTimesAfter: readonly number[];
  intervalMs: number;
  /** Reference chart for logical range read (e.g. main pane). */
  referenceChart?: import('lightweight-charts').IChartApi;
}

/** Apply §10.4.1 logicalRange offset on every bus with an initialized visible window. */
export function compensatePrependOnRegistry(opts: CompensatePrependOnRegistryOptions): void {
  const { registry, sortedTimesBefore, sortedTimesAfter, intervalMs, referenceChart } = opts;
  registry.forEachBus((_, bus) => {
    compensatePrependOnBus(bus, {
      sortedTimesBefore,
      sortedTimesAfter,
      intervalMs,
      referenceChart,
    });
  });
}

export interface CompensatePrependOnBusOptions {
  sortedTimesBefore: readonly number[];
  sortedTimesAfter: readonly number[];
  intervalMs: number;
  referenceChart?: import('lightweight-charts').IChartApi;
}

export function compensatePrependOnBus(bus: TimeScaleBus, opts: CompensatePrependOnBusOptions): void {
  const range = bus.getVisibleRange();
  if (!range) return;
  const delta = computePrependSliceDeltaForViewport({
    sortedTimesBefore: opts.sortedTimesBefore,
    sortedTimesAfter: opts.sortedTimesAfter,
    visibleFromMs: range.fromMs,
    visibleToMs: range.toMs,
    intervalMs: opts.intervalMs,
  });
  if (delta <= 0) return;
  const { renderFromMs, renderToMs } = deriveRenderRange(
    range.fromMs,
    range.toMs,
    opts.sortedTimesAfter,
    opts.intervalMs,
  );
  const sliceAfter = buildSliceTimes(opts.sortedTimesAfter, renderFromMs, renderToMs);
  bus.compensatePrependLogicalRange(delta, opts.referenceChart, sliceAfter);
}