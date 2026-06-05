import type { ChartViewport } from '../chart-viewport.js';
import { timeMsAtBarIndex } from '../chart-coordinates.js';

export interface TimeTick {
  barIndex: number;
  timeMs: number;
  /** Device-pixel X in plot coordinates. */
  x: number;
  label: string;
}

const MIN_TIME_TICK_SPACING_PX = 72;

/** Median bar interval (ms) for visible bars — picks label granularity. */
export function medianBarIntervalMs(
  bars: readonly { t: number }[],
  fromIndex: number,
  toIndex: number,
): number {
  if (bars.length < 2 || toIndex <= fromIndex) return 3_600_000;
  const start = Math.max(0, fromIndex);
  const end = Math.min(bars.length - 1, toIndex);
  const deltas: number[] = [];
  for (let i = start + 1; i <= end; i++) {
    const dt = bars[i]!.t - bars[i - 1]!.t;
    if (dt > 0) deltas.push(dt);
  }
  if (deltas.length === 0) return 3_600_000;
  deltas.sort((a, b) => a - b);
  return deltas[Math.floor(deltas.length / 2)]!;
}

function pickTimeFormatOptions(
  barIntervalMs: number,
  visibleSpanMs: number,
): Intl.DateTimeFormatOptions {
  if (visibleSpanMs >= 180 * 86_400_000 || barIntervalMs >= 86_400_000) {
    return { month: 'short', day: 'numeric', year: '2-digit' };
  }
  if (visibleSpanMs >= 2 * 86_400_000 || barIntervalMs >= 3_600_000) {
    return { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  }
  if (visibleSpanMs >= 6 * 3_600_000 || barIntervalMs >= 60_000) {
    return { hour: '2-digit', minute: '2-digit' };
  }
  return { hour: '2-digit', minute: '2-digit', second: '2-digit' };
}

function getFormatter(
  timeZone: string,
  opts: Intl.DateTimeFormatOptions,
  cache?: Map<string, Intl.DateTimeFormat>,
): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(opts)}`;
  const map = cache ?? new Map<string, Intl.DateTimeFormat>();
  let fmt = map.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(undefined, { ...opts, timeZone });
    map.set(key, fmt);
  }
  return fmt;
}

export function formatTimeAxisLabel(
  ms: number,
  barIntervalMs: number,
  timeZone: string,
  visibleSpanMs = barIntervalMs * 100,
  formatters?: Map<string, Intl.DateTimeFormat>,
): string {
  if (!Number.isFinite(ms)) return '—';
  const opts = pickTimeFormatOptions(barIntervalMs, visibleSpanMs);
  try {
    return getFormatter(timeZone, opts, formatters).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export interface TimeTickParams {
  viewport: ChartViewport;
  bars: readonly { t: number }[];
  plotWidthPx: number;
  dpr: number;
  timeZone: string;
  minSpacingPx?: number;
  formatters?: Map<string, Intl.DateTimeFormat>;
}

export function computeTimeTicks(params: TimeTickParams): TimeTick[] {
  const {
    viewport,
    bars,
    plotWidthPx,
    dpr,
    timeZone,
    minSpacingPx = MIN_TIME_TICK_SPACING_PX,
  } = params;
  const plotW = plotWidthPx * dpr;
  const span = viewport.visibleSpan;
  if (span <= 0 || bars.length === 0 || plotW <= 0) return [];

  const { from, to } = viewport.visibleBarIndexRange();
  const barIntervalMs = medianBarIntervalMs(bars, from, to);
  const fromMs = timeMsAtBarIndex(bars as import('@coderyo/data').Bar[], viewport.visibleFrom);
  const toMs = timeMsAtBarIndex(bars as import('@coderyo/data').Bar[], viewport.visibleTo);
  const visibleSpanMs = Math.abs(toMs - fromMs);

  const targetCount = Math.max(2, Math.floor(plotW / minSpacingPx));
  const count = Math.min(targetCount, Math.max(2, Math.floor(span / 4)));

  const ticks: TimeTick[] = [];
  for (let i = 0; i <= count; i++) {
    const plotX = (plotW * i) / count;
    const barIndex = viewport.barIndexAtPlotX(plotX / dpr, plotWidthPx);
      const timeMs = timeMsAtBarIndex(bars as import('@coderyo/data').Bar[], barIndex);
    ticks.push({
      barIndex,
      timeMs,
      x: plotX,
      label: formatTimeAxisLabel(
        timeMs,
        barIntervalMs,
        timeZone,
        visibleSpanMs,
        params.formatters,
      ),
    });
  }
  return ticks;
}