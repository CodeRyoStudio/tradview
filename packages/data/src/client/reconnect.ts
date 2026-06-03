export interface BackoffOptions {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier?: number;
}

export function computeBackoffDelay(attempt: number, opts: BackoffOptions): number {
  const mult = opts.multiplier ?? 2;
  const exp = Math.min(opts.maxDelayMs, opts.initialDelayMs * mult ** attempt);
  const jitter = Math.random() * exp;
  return Math.floor(jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}