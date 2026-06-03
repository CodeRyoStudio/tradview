import type { Bar } from '@coderyo/data';
import { ema, rsi, sma } from '@coderyo/indicators';
import type { PineIrProgram } from './ir.js';

export interface PinePlotSeries {
  title: string;
  values: (number | null)[];
}

export interface PineRunResult {
  plots: PinePlotSeries[];
}

function barsForSeries(bars: Bar[], series: string): Bar[] {
  switch (series) {
    case 'hl2':
      return bars.map((b) => ({ ...b, c: (b.h + b.l) / 2 }));
    case 'hlc3':
      return bars.map((b) => ({ ...b, c: (b.h + b.l + b.c) / 3 }));
    case 'open':
      return bars.map((b) => ({ ...b, c: b.o }));
    case 'high':
      return bars.map((b) => ({ ...b, c: b.h }));
    case 'low':
      return bars.map((b) => ({ ...b, c: b.l }));
    case 'volume':
      return bars.map((b) => ({ ...b, c: b.v ?? 0 }));
    case 'close':
    default:
      return bars;
  }
}

function seriesAt(bars: Bar[], series: string, index: number): number {
  const b = bars[index]!;
  switch (series) {
    case 'open':
      return b.o;
    case 'high':
      return b.h;
    case 'low':
      return b.l;
    case 'volume':
      return b.v ?? 0;
    case 'hl2':
      return (b.h + b.l) / 2;
    case 'hlc3':
      return (b.h + b.l + b.c) / 3;
    case 'close':
    default:
      return b.c;
  }
}

function indicatorAt(
  fn: 'sma' | 'ema' | 'rsi',
  bars: Bar[],
  series: string,
  index: number,
  period: number,
): number | null {
  const src = barsForSeries(bars, series);
  const p = Math.max(1, Math.floor(period));
  const slice = src.slice(0, index + 1);
  if (fn === 'sma') return sma(slice, p)[index] ?? null;
  if (fn === 'ema') return ema(slice, p)[index] ?? null;
  return rsi(slice, p)[index] ?? null;
}

export function runPineIr(ir: PineIrProgram, bars: Bar[]): PineRunResult {
  const n = bars.length;
  const vars = new Map<string, (number | null)[]>();
  for (const name of ir.vars) vars.set(name, Array.from({ length: n }, () => null));

  const plotBuffers = new Map<string, (number | null)[]>();
  for (const title of ir.plots) {
    plotBuffers.set(title, Array.from({ length: n }, () => null));
  }

  for (let i = 0; i < n; i++) {
    const stack: number[] = [];

    const pop = (): number => {
      const v = stack.pop();
      return v ?? NaN;
    };

    for (const op of ir.ops) {
      switch (op.op) {
        case 'push':
          stack.push(op.value);
          break;
        case 'load_series':
          stack.push(seriesAt(bars, op.name, i));
          break;
        case 'load_var': {
          const s = vars.get(op.name);
          stack.push(s?.[i] ?? NaN);
          break;
        }
        case 'store_var': {
          const v = pop();
          const s = vars.get(op.name);
          if (s) s[i] = Number.isFinite(v) ? v : null;
          break;
        }
        case 'call_ind': {
          const period = pop();
          const v = indicatorAt(op.fn, bars, op.series, i, period);
          stack.push(v ?? NaN);
          break;
        }
        case 'add':
          stack.push(pop() + pop());
          break;
        case 'sub':
          stack.push(pop() - pop());
          break;
        case 'mul':
          stack.push(pop() * pop());
          break;
        case 'div': {
          const b = pop();
          const a = pop();
          stack.push(b === 0 ? NaN : a / b);
          break;
        }
        case 'neg':
          stack.push(-pop());
          break;
        case 'plot': {
          const v = pop();
          const buf = plotBuffers.get(op.title);
          if (buf) buf[i] = Number.isFinite(v) ? v : null;
          break;
        }
        default:
          break;
      }
    }
  }

  return {
    plots: ir.plots.map((title) => ({
      title,
      values: plotBuffers.get(title) ?? [],
    })),
  };
}