import type { Bar } from '@coderyo/data';
import type { PineIrProgram } from './ir.js';
import { runPineIr, type PineRunResult } from './vm.js';
import type { PineWorkerRequest, PineWorkerResponse } from './pine.worker.js';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: PineRunResult) => void; reject: (e: Error) => void }>();

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;

  try {
    worker = new Worker(new URL('./pine.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<PineWorkerResponse>) => {
      const msg = ev.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok && msg.result) p.resolve(msg.result);
      else p.reject(new Error(msg.error ?? 'Pine worker failed'));
    };
    worker.onerror = () => {
      for (const [, p] of pending) p.reject(new Error('Pine worker error'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

export interface RunPineLiteAsyncOptions {
  useWorker?: boolean;
}

export function runPineLiteAsync(
  ir: PineIrProgram,
  bars: Bar[],
  opts?: RunPineLiteAsyncOptions,
): Promise<PineRunResult> {
  if (opts?.useWorker === false) {
    return Promise.resolve(runPineIr(ir, bars));
  }

  const w = ensureWorker();
  if (!w) return Promise.resolve(runPineIr(ir, bars));

  const id = ++seq;
  const req: PineWorkerRequest = { id, ir, bars };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(req);
  });
}

export function terminatePineWorker(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}