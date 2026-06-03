import type { Bar } from '@coderyo/data';
import type { PineIrProgram } from './ir.js';
import { runPineIr, type PineRunResult } from './vm.js';

export interface PineWorkerRequest {
  id: number;
  ir: PineIrProgram;
  bars: Bar[];
}

export interface PineWorkerResponse {
  id: number;
  ok: boolean;
  result?: PineRunResult;
  error?: string;
}

self.onmessage = (ev: MessageEvent<PineWorkerRequest>) => {
  const { id, ir, bars } = ev.data;
  try {
    const result = runPineIr(ir, bars);
    const msg: PineWorkerResponse = { id, ok: true, result };
    self.postMessage(msg);
  } catch (e) {
    const msg: PineWorkerResponse = {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(msg);
  }
};