import { intervalMs, type Interval } from '@coderyo/data';
import type { Bar } from '@coderyo/data';

export interface Tick {
  t: number;
  price: number;
  size?: number;
}

export function barOpenTime(eventMs: number, interval: Interval): number {
  const ms = intervalMs(interval);
  return Math.floor(eventMs / ms) * ms;
}

/** Client-side tick → bar aggregation when streamMode is tick-only. */
export class TickAggregator {
  private current: Bar | null = null;

  constructor(
    private readonly interval: Interval,
    private readonly onBar: (bar: Bar, partial: boolean) => void,
  ) {}

  ingest(tick: Tick): void {
    const open = barOpenTime(tick.t, this.interval);

    if (!this.current || this.current.t !== open) {
      if (this.current) {
        this.onBar({ ...this.current }, false);
      }
      this.current = {
        t: open,
        o: tick.price,
        h: tick.price,
        l: tick.price,
        c: tick.price,
        v: tick.size ?? 0,
      };
      this.onBar({ ...this.current }, true);
      return;
    }

    this.current = {
      ...this.current,
      h: Math.max(this.current.h, tick.price),
      l: Math.min(this.current.l, tick.price),
      c: tick.price,
      v: (this.current.v ?? 0) + (tick.size ?? 0),
    };
    this.onBar({ ...this.current }, true);
  }

  flush(): void {
    if (this.current) {
      this.onBar({ ...this.current }, false);
      this.current = null;
    }
  }
}