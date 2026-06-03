import type { PineCompileResult } from './index.js';

export interface PineVmResult {
  plots: number[];
}

/** Minimal stack VM stub (PR-18b) — no user scripts executed by default. */
export function runPineVm(ir: NonNullable<PineCompileResult['ir']>, length: number): PineVmResult {
  const plots = Array.from({ length }, (_, i) => Math.sin(i * 0.05));
  void ir;
  return { plots };
}