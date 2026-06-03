import type { Bar } from '@coderyo/data';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Interpolate last candle OHLC toward target over `durationMs` (interrupts on new target). */
export class BarSmoothAnimator {
  private raf = 0;
  private start = 0;
  private from: Bar | null = null;
  private to: Bar | null = null;

  constructor(
    private durationMs: number,
    private readonly onFrame: (bar: Bar) => void,
  ) {}

  setDuration(ms: number): void {
    this.durationMs = ms;
  }

  animateTo(target: Bar, from?: Bar): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    const base = from ?? this.to ?? target;
    this.from = { ...base, t: target.t };
    this.to = { ...target };
    this.start = performance.now();

    const step = (now: number) => {
      const raw = Math.min(1, (now - this.start) / this.durationMs);
      const p = easeOutCubic(raw);
      const f = this.from!;
      const t = this.to!;
      const frame: Bar = {
        t: t.t,
        o: lerp(f.o, t.o, p),
        h: lerp(f.h, t.h, p),
        l: lerp(f.l, t.l, p),
        c: lerp(f.c, t.c, p),
        v: t.v,
      };
      this.onFrame(frame);
      if (raw < 1) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.raf = 0;
        this.onFrame(t);
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  cancel(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}