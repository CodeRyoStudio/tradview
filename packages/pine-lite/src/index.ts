import { compileAst } from './compile.js';
import { diagnosticFromMessage, type PineDiagnostic } from './diagnostics.js';
import { tokenize } from './lexer.js';
import { parseProgram } from './parser.js';
import type { PineIrProgram } from './ir.js';
import { runPineIr, type PinePlotSeries, type PineRunResult } from './vm.js';

export type { PinePlotSeries, PineRunResult, PineDiagnostic };
export type { PineIrProgram } from './ir.js';
export type { PineProgram } from './ast.js';
export { diagnosticFromMessage, diagnosticsFromMessages, offsetToLineCol } from './diagnostics.js';

export interface PineCompileResult {
  ok: boolean;
  errors: string[];
  diagnostics: PineDiagnostic[];
  ir?: PineIrProgram;
}

const MAX_SOURCE_LEN = 32 * 1024;

export function compilePineLite(source: string): PineCompileResult {
  const diagnostics: PineDiagnostic[] = [];
  const pushDiag = (line: number, col: number, message: string) => {
    diagnostics.push({ line, col, message, severity: 'error' });
  };

  if (source.length > MAX_SOURCE_LEN) {
    const msg = `Source exceeds ${MAX_SOURCE_LEN} bytes`;
    pushDiag(1, 1, msg);
    return { ok: false, errors: [msg], diagnostics };
  }

  const { tokens, errors: lexErr } = tokenize(source);
  for (const m of lexErr) diagnostics.push(diagnosticFromMessage(source, m));
  if (lexErr.length) {
    return { ok: false, errors: lexErr, diagnostics };
  }

  const { program, errors: parseErr } = parseProgram(tokens);
  for (const e of parseErr) pushDiag(e.line, e.col, e.message);
  if (parseErr.length || !program) {
    return { ok: false, errors: parseErr.map((e) => e.message), diagnostics };
  }

  const { ir, errors: compileErr } = compileAst(program);
  for (const m of compileErr) diagnostics.push(diagnosticFromMessage(source, m));
  if (compileErr.length || !ir) {
    return { ok: false, errors: compileErr, diagnostics };
  }
  if (ir.plots.length > 16) {
    const msg = 'Too many plot() calls (max 16)';
    pushDiag(1, 1, msg);
    return { ok: false, errors: [msg], diagnostics };
  }
  if (ir.vars.length > 256) {
    const msg = 'Too many variables (max 256)';
    pushDiag(1, 1, msg);
    return { ok: false, errors: [msg], diagnostics };
  }

  return { ok: true, errors: [], diagnostics, ir };
}

export function runPineLite(ir: PineIrProgram, bars: import('@coderyo/data').Bar[]): PineRunResult {
  return runPineIr(ir, bars);
}

export { runPineLiteAsync, terminatePineWorker, type RunPineLiteAsyncOptions } from './worker-client.js';

export const PINE_SAMPLE_SCRIPT = `// Pine-lite — if / while / for、比較、and/or/not
var len = 20
if (close > 0) {
  plot(sma(close, len))
} else {
  plot(open)
}
for i = 1 to 2 {
  plot(rsi(close, 14))
}
`;

export const PINE_EDITOR_DEFAULT = PINE_SAMPLE_SCRIPT;