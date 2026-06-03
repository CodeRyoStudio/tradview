import { compileAst } from './compile.js';
import { tokenize } from './lexer.js';
import { parseProgram } from './parser.js';
import type { PineIrProgram } from './ir.js';
import { runPineIr, type PinePlotSeries, type PineRunResult } from './vm.js';

export type { PinePlotSeries, PineRunResult };
export type { PineIrProgram } from './ir.js';
export type { PineProgram } from './ast.js';

export interface PineCompileResult {
  ok: boolean;
  errors: string[];
  ir?: PineIrProgram;
}

const MAX_SOURCE_LEN = 32 * 1024;

export function compilePineLite(source: string): PineCompileResult {
  if (source.length > MAX_SOURCE_LEN) {
    return { ok: false, errors: [`Source exceeds ${MAX_SOURCE_LEN} bytes`] };
  }
  const { tokens, errors: lexErr } = tokenize(source);
  if (lexErr.length) return { ok: false, errors: lexErr };
  const { program, errors: parseErr } = parseProgram(tokens);
  if (parseErr.length || !program) return { ok: false, errors: parseErr };
  const { ir, errors: compileErr } = compileAst(program);
  if (compileErr.length || !ir) return { ok: false, errors: compileErr };
  if (ir.plots.length > 16) return { ok: false, errors: ['Too many plot() calls (max 16)'] };
  if (ir.vars.length > 256) return { ok: false, errors: ['Too many variables (max 256)'] };
  return { ok: true, errors: [], ir };
}

export function runPineLite(ir: PineIrProgram, bars: import('@coderyo/data').Bar[]): PineRunResult {
  return runPineIr(ir, bars);
}

/** @deprecated Use runPineLite(ir, bars) */
export function runPineVm(ir: PineIrProgram, barCount: number): { plots: number[] } {
  const empty = Array.from({ length: barCount }, () => null as number | null);
  const result = runPineIr(ir, empty.map((_, i) => ({ t: i, o: 0, h: 0, l: 0, c: 0, v: 0 })));
  return { plots: result.plots[0]?.values.map((v) => v ?? NaN) ?? [] };
}

export const PINE_SAMPLE_SCRIPT = `// Pine-lite demo: SMA + RSI
plot(sma(close, 20))
plot(rsi(close, 14))
`;