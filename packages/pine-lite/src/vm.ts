import type { Bar } from '@coderyo/data';
import { boll, ema, macd, rsi, sma } from '@coderyo/indicators';
import type { IndicatorBuiltin } from './builtins.js';
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

function wmaAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < p; i++) {
    const w = i + 1;
    const v = seriesAt(bars, series, index - p + 1 + i);
    sum += v * w;
    wSum += w;
  }
  return wSum > 0 ? sum / wSum : null;
}

function stdevAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let sum = 0;
  for (let i = index - p + 1; i <= index; i++) sum += seriesAt(bars, series, i);
  const mean = sum / p;
  let sq = 0;
  for (let i = index - p + 1; i <= index; i++) {
    const d = seriesAt(bars, series, i) - mean;
    sq += d * d;
  }
  return Math.sqrt(sq / p);
}

function changeAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p) return null;
  return seriesAt(bars, series, index) - seriesAt(bars, series, index - p);
}

function rocAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p) return null;
  const prev = seriesAt(bars, series, index - p);
  if (prev === 0) return null;
  return ((seriesAt(bars, series, index) - prev) / prev) * 100;
}

function trueRangeAt(bars: Bar[], index: number): number {
  const b = bars[index]!;
  if (index === 0) return b.h - b.l;
  const prev = bars[index - 1]!;
  return Math.max(b.h - b.l, Math.abs(b.h - prev.c), Math.abs(b.l - prev.c));
}

function atrAt(bars: Bar[], index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let sum = 0;
  for (let i = index - p + 1; i <= index; i++) sum += trueRangeAt(bars, i);
  return sum / p;
}

function cciAt(bars: Bar[], index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  const tps: number[] = [];
  for (let i = index - p + 1; i <= index; i++) {
    const b = bars[i]!;
    tps.push((b.h + b.l + b.c) / 3);
  }
  const tp = tps[tps.length - 1]!;
  const mean = tps.reduce((a, v) => a + v, 0) / p;
  const dev =
    tps.reduce((a, v) => a + Math.abs(v - mean), 0) / p || Number.EPSILON;
  return (tp - mean) / (0.015 * dev);
}

function mfiAt(bars: Bar[], index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p) return null;
  let pos = 0;
  let neg = 0;
  for (let i = index - p + 1; i <= index; i++) {
    const b = bars[i]!;
    const tp = (b.h + b.l + b.c) / 3;
    const raw = (b.v ?? 0) * tp;
    const prev = bars[i - 1];
    if (!prev) continue;
    const prevTp = (prev.h + prev.l + prev.c) / 3;
    if (tp > prevTp) pos += raw;
    else if (tp < prevTp) neg += raw;
  }
  if (pos + neg === 0) return 50;
  const ratio = pos / (pos + neg);
  return 100 - 100 / (1 + ratio);
}

function stochAt(bars: Bar[], index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = index - p + 1; i <= index; i++) {
    lo = Math.min(lo, bars[i]!.l);
    hi = Math.max(hi, bars[i]!.h);
  }
  const span = hi - lo;
  if (span === 0) return 50;
  return ((bars[index]!.c - lo) / span) * 100;
}

function sumAt(bars: Bar[], series: string, index: number, period: number): number | null {
  const p = Math.max(1, Math.floor(period));
  if (index < p - 1) return null;
  let sum = 0;
  for (let i = index - p + 1; i <= index; i++) sum += seriesAt(bars, series, i);
  return sum;
}

function indicatorAt(
  fn: IndicatorBuiltin,
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
  if (fn === 'rsi') return rsi(slice, p)[index] ?? null;
  if (fn === 'wma') return wmaAt(bars, series, index, p);
  if (fn === 'stdev') return stdevAt(bars, series, index, p);
  if (fn === 'change') return changeAt(bars, series, index, p);
  if (fn === 'roc') return rocAt(bars, series, index, p);
  if (fn === 'atr') return atrAt(bars, index, p);
  if (fn === 'cci') return cciAt(bars, index, p);
  if (fn === 'mfi') return mfiAt(bars, index, p);
  if (fn === 'stoch') return stochAt(bars, index, p);
  if (fn === 'sum') return sumAt(bars, series, index, p);
  if (fn === 'bb') return boll(src, p).middle[index] ?? null;
  if (fn === 'macd') {
    const fast = Math.max(2, Math.floor(p));
    const slow = fast * 2;
    const sig = Math.max(2, Math.floor(fast / 2));
    return macd(src, fast, slow, sig).macd[index] ?? null;
  }
  return null;
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