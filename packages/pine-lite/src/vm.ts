import type { Bar } from '@coderyo/data';
import { ema, rsi, sma } from '@coderyo/indicators';
import type { IrOp, PineIrProgram } from './ir.js';

export interface PinePlotSeries {
  title: string;
  values: (number | null)[];
}

export interface PineRunResult {
  plots: PinePlotSeries[];
}

const MAX_STEPS_PER_BAR = 100_000;

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

function highestAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let max = -Infinity;
  for (let i = index - p + 1; i <= index; i++) {
    const v = seriesAt(bars, series, i);
    if (v > max) max = v;
  }
  return Number.isFinite(max) ? max : null;
}

function lowestAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let min = Infinity;
  for (let i = index - p + 1; i <= index; i++) {
    const v = seriesAt(bars, series, i);
    if (v < min) min = v;
  }
  return Number.isFinite(min) ? min : null;
}

function crossAt(
  bars: Bar[],
  seriesA: string,
  seriesB: string,
  index: number,
  mode: 'over' | 'under',
): number {
  if (index < 1) return 0;
  const a0 = seriesAt(bars, seriesA, index);
  const b0 = seriesAt(bars, seriesB, index);
  const a1 = seriesAt(bars, seriesA, index - 1);
  const b1 = seriesAt(bars, seriesB, index - 1);
  if (mode === 'over') return a1 <= b1 && a0 > b0 ? 1 : 0;
  return a1 >= b1 && a0 < b0 ? 1 : 0;
}

function indicatorAt(
  fn: 'sma' | 'ema' | 'rsi' | 'highest' | 'lowest' | 'crossover' | 'crossunder',
  bars: Bar[],
  series: string,
  index: number,
  period: number,
  series2?: string,
): number | null {
  if (fn === 'crossover' || fn === 'crossunder') {
    if (!series2) return 0;
    return crossAt(bars, series, series2, index, fn === 'crossover' ? 'over' : 'under');
  }
  if (fn === 'highest') return highestAt(bars, series, index, period);
  if (fn === 'lowest') return lowestAt(bars, series, index, period);
  const src = barsForSeries(bars, series);
  const p = Math.max(1, Math.floor(period));
  const slice = src.slice(0, index + 1);
  if (fn === 'sma') return sma(slice, p)[index] ?? null;
  if (fn === 'ema') return ema(slice, p)[index] ?? null;
  return rsi(slice, p)[index] ?? null;
}

function truthy(v: number): boolean {
  return Number.isFinite(v) && v !== 0;
}

function execOp(
  op: IrOp,
  stack: number[],
  bars: Bar[],
  barIndex: number,
  vars: Map<string, (number | null)[]>,
  plotBuffers: Map<string, (number | null)[]>,
): number {
  const pop = () => stack.pop() ?? NaN;
  switch (op.op) {
    case 'push':
      stack.push(op.value);
      break;
    case 'load_series':
      stack.push(seriesAt(bars, op.name, barIndex));
      break;
    case 'load_var': {
      const s = vars.get(op.name);
      stack.push(s?.[barIndex] ?? NaN);
      break;
    }
    case 'store_var': {
      const v = pop();
      const s = vars.get(op.name);
      if (s) s[barIndex] = Number.isFinite(v) ? v : null;
      break;
    }
    case 'call_ind': {
      if (op.fn === 'crossover' || op.fn === 'crossunder') {
        const v = indicatorAt(op.fn, bars, op.series, barIndex, 0, op.series2);
        stack.push(v ?? 0);
        break;
      }
      const period = pop();
      const v = indicatorAt(op.fn, bars, op.series, barIndex, period, op.series2);
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
    case 'not':
      stack.push(truthy(pop()) ? 0 : 1);
      break;
    case 'cmp': {
      const b = pop();
      const a = pop();
      let r = false;
      switch (op.mode) {
        case 'eq':
          r = a === b;
          break;
        case 'ne':
          r = a !== b;
          break;
        case 'lt':
          r = a < b;
          break;
        case 'gt':
          r = a > b;
          break;
        case 'le':
          r = a <= b;
          break;
        case 'ge':
          r = a >= b;
          break;
      }
      stack.push(r ? 1 : 0);
      break;
    }
    case 'and': {
      const b = pop();
      const a = pop();
      stack.push(truthy(a) && truthy(b) ? 1 : 0);
      break;
    }
    case 'or': {
      const b = pop();
      const a = pop();
      stack.push(truthy(a) || truthy(b) ? 1 : 0);
      break;
    }
    case 'pop':
      pop();
      break;
    case 'plot': {
      const v = pop();
      const buf = plotBuffers.get(op.title);
      if (buf) buf[barIndex] = Number.isFinite(v) ? v : null;
      break;
    }
    case 'jump':
      return op.target;
    case 'jump_if_false':
      return truthy(pop()) ? -1 : op.target;
    default:
      break;
  }
  return -1;
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
    let pc = 0;
    let steps = 0;
    while (pc < ir.ops.length && steps < MAX_STEPS_PER_BAR) {
      steps++;
      const jmp = execOp(ir.ops[pc]!, stack, bars, i, vars, plotBuffers);
      if (jmp >= 0) pc = jmp;
      else pc++;
    }
  }

  return {
    plots: ir.plots.map((title) => ({
      title,
      values: plotBuffers.get(title) ?? [],
    })),
  };
}