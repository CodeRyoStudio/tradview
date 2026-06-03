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
      const period = pop();
      const v = indicatorAt(op.fn, bars, op.series, barIndex, period);
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