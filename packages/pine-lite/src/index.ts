/** Pine-lite compile-only skeleton (PR-18a) */
export interface PineCompileResult {
  ok: boolean;
  errors: string[];
  ir?: unknown;
}

export function compilePineLite(_source: string): PineCompileResult {
  return { ok: true, errors: [], ir: { version: 0, plots: [] } };
}