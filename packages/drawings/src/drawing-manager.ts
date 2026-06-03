import type { DrawingRecord } from './storage.js';
import { loadDrawings, saveDrawings, storageKey } from './storage.js';

export type DrawingTool = 'cursor' | 'trendline' | 'hline';

export interface DrawingManagerOptions {
  canvas: HTMLCanvasElement;
  chartId: string;
  symbol: string;
  interval: string;
  priceToY: (price: number) => number | null;
  timeToX: (tMs: number) => number | null;
  xToTime?: (x: number) => number | null;
  yToPrice?: (y: number) => number | null;
}

interface DrawingContext {
  chartId: string;
  symbol: string;
  interval: string;
}

export class DrawingManager {
  private tool: DrawingTool = 'cursor';
  private drawings: DrawingRecord[] = [];
  private draft: DrawingRecord | null = null;
  private key: string;

  private ctx: DrawingContext;

  constructor(private readonly opts: DrawingManagerOptions) {
    this.ctx = {
      chartId: opts.chartId,
      symbol: opts.symbol,
      interval: opts.interval,
    };
    this.key = storageKey(this.ctx.chartId, this.ctx.symbol, this.ctx.interval);
    this.drawings = loadDrawings(this.key).drawings;
    opts.canvas.style.pointerEvents = 'auto';
    opts.canvas.addEventListener('pointerdown', this.onDown);
    opts.canvas.addEventListener('pointermove', this.onMove);
    opts.canvas.addEventListener('pointerup', this.onUp);
  }

  setTool(tool: DrawingTool): void {
    this.tool = tool;
  }

  setContext(symbol: string, interval: string): void {
    this.ctx.symbol = symbol;
    this.ctx.interval = interval;
    this.key = storageKey(this.ctx.chartId, symbol, interval);
    this.drawings = loadDrawings(this.key).drawings;
  }

  redraw(): void {
    const canvas = this.opts.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    for (const d of [...this.drawings, ...(this.draft ? [this.draft] : [])]) {
      this.paint(ctx, d);
    }
  }

  destroy(): void {
    this.opts.canvas.removeEventListener('pointerdown', this.onDown);
    this.opts.canvas.removeEventListener('pointermove', this.onMove);
    this.opts.canvas.removeEventListener('pointerup', this.onUp);
  }

  private paint(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    if (d.type === 'hline' && d.points[0]) {
      const y = this.opts.priceToY(d.points[0].price);
      if (y == null) return;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.opts.canvas.width, y);
      ctx.stroke();
      return;
    }
    if (d.type === 'trendline' && d.points.length >= 2) {
      const x1 = this.opts.timeToX(d.points[0]!.t);
      const y1 = this.opts.priceToY(d.points[0]!.price);
      const x2 = this.opts.timeToX(d.points[1]!.t);
      const y2 = this.opts.priceToY(d.points[1]!.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  private persist(): void {
    saveDrawings(this.key, { version: 1, drawings: this.drawings });
  }

  private onDown = (e: PointerEvent) => {
    if (this.tool === 'cursor') return;
    const pt = this.hitPoint(e);
    if (!pt) return;
    const type = this.tool === 'hline' ? 'hline' : 'trendline';
    this.draft = {
      id: `d-${Date.now()}`,
      type,
      symbol: this.ctx.symbol,
      interval: this.ctx.interval,
      points: [pt],
    };
  };

  private onMove = (e: PointerEvent) => {
    if (!this.draft) return;
    const pt = this.hitPoint(e);
    if (!pt) return;
    if (this.draft.type === 'hline') {
      this.draft.points = [{ t: pt.t, price: pt.price }];
    } else if (this.draft.points.length === 1) {
      this.draft.points = [this.draft.points[0]!, pt];
    } else {
      this.draft.points[1] = pt;
    }
    this.redraw();
  };

  private onUp = () => {
    if (!this.draft) return;
    if (this.draft.type === 'trendline' && this.draft.points.length < 2) {
      this.draft = null;
      return;
    }
    this.drawings.push(this.draft);
    this.draft = null;
    this.persist();
    this.redraw();
  };

  private hitPoint(e: PointerEvent): { t: number; price: number } | null {
    const rect = this.opts.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.opts.canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * this.opts.canvas.height;
    const t = this.opts.xToTime?.(x) ?? null;
    const price = this.opts.yToPrice?.(y) ?? null;
    if (t == null || price == null) return null;
    return { t, price };
  }
}