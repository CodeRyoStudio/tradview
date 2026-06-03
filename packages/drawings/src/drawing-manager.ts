import type { DrawingRecord } from './storage.js';
import { loadDrawings, saveDrawings, storageKey } from './storage.js';

export type DrawingTool =
  | 'cursor'
  | 'trendline'
  | 'hline'
  | 'vline'
  | 'rectangle'
  | 'fibonacci'
  | 'text';

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1];

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
  private selectedId: string | null = null;
  private key: string;
  private readonly ctx: DrawingContext;

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
    if (tool !== 'cursor') this.selectedId = null;
    this.redraw();
  }

  setContext(symbol: string, interval: string): void {
    this.ctx.symbol = symbol;
    this.ctx.interval = interval;
    this.key = storageKey(this.ctx.chartId, symbol, interval);
    this.drawings = loadDrawings(this.key).drawings;
    this.selectedId = null;
    this.draft = null;
    this.redraw();
  }

  redraw(): void {
    const canvas = this.opts.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of [...this.drawings, ...(this.draft ? [this.draft] : [])]) {
      const selected = d.id === this.selectedId;
      ctx.strokeStyle = selected ? '#f78166' : '#58a6ff';
      ctx.fillStyle = selected ? '#f7816688' : '#58a6ff44';
      ctx.lineWidth = selected ? 3 : 2;
      ctx.font = `${12 * devicePixelRatio}px sans-serif`;
      this.paint(ctx, d);
    }
  }

  destroy(): void {
    this.opts.canvas.removeEventListener('pointerdown', this.onDown);
    this.opts.canvas.removeEventListener('pointermove', this.onMove);
    this.opts.canvas.removeEventListener('pointerup', this.onUp);
  }

  private paint(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    switch (d.type) {
      case 'hline':
        this.paintHLine(ctx, d);
        break;
      case 'vline':
        this.paintVLine(ctx, d);
        break;
      case 'trendline':
        this.paintTrendline(ctx, d);
        break;
      case 'rectangle':
        this.paintRectangle(ctx, d);
        break;
      case 'fibonacci':
        this.paintFibonacci(ctx, d);
        break;
      case 'text':
        this.paintText(ctx, d);
        break;
    }
  }

  private paintHLine(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    const p = d.points[0];
    if (!p) return;
    const y = this.opts.priceToY(p.price);
    if (y == null) return;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.opts.canvas.width, y);
    ctx.stroke();
  }

  private paintVLine(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    const p = d.points[0];
    if (!p) return;
    const x = this.opts.timeToX(p.t);
    if (x == null) return;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, this.opts.canvas.height);
    ctx.stroke();
  }

  private paintTrendline(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    if (d.points.length < 2) return;
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

  private paintRectangle(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    if (d.points.length < 2) return;
    const x1 = this.opts.timeToX(d.points[0]!.t);
    const y1 = this.opts.priceToY(d.points[0]!.price);
    const x2 = this.opts.timeToX(d.points[1]!.t);
    const y2 = this.opts.priceToY(d.points[1]!.price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.fillRect(left, top, w, h);
    ctx.strokeRect(left, top, w, h);
  }

  private paintFibonacci(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    if (d.points.length < 2) return;
    const p0 = d.points[0]!;
    const p1 = d.points[1]!;
    const y0 = this.opts.priceToY(p0.price);
    const y1 = this.opts.priceToY(p1.price);
    if (y0 == null || y1 == null) return;
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    const range = maxY - minY;
    ctx.setLineDash([4 * devicePixelRatio, 4 * devicePixelRatio]);
    for (const lvl of FIB_LEVELS) {
      const y = maxY - range * lvl;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.opts.canvas.width, y);
      ctx.stroke();
      ctx.fillStyle = '#8b949e';
      ctx.fillText(`${(lvl * 100).toFixed(1)}%`, 4, y - 2);
      ctx.fillStyle = '#58a6ff44';
    }
    ctx.setLineDash([]);
  }

  private paintText(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    const p = d.points[0];
    if (!p) return;
    const x = this.opts.timeToX(p.t);
    const y = this.opts.priceToY(p.price);
    if (x == null || y == null) return;
    const label = String(d.meta?.text ?? 'Text');
    ctx.fillStyle = '#e6edf3';
    ctx.fillText(label, x + 4, y - 4);
  }

  private persist(): void {
    saveDrawings(this.key, { version: 1, drawings: this.drawings });
  }

  private onDown = (e: PointerEvent) => {
    const pt = this.hitPoint(e);
    if (!pt) return;

    if (this.tool === 'cursor') {
      this.selectedId = this.hitTestDrawing(pt.x, pt.y);
      this.redraw();
      return;
    }

    const type = this.tool === 'hline' ? 'hline' : this.tool;
    this.draft = {
      id: `d-${Date.now()}`,
      type,
      symbol: this.ctx.symbol,
      interval: this.ctx.interval,
      points: [pt],
      meta: type === 'text' ? { text: 'Note' } : undefined,
    };
  };

  private onMove = (e: PointerEvent) => {
    if (!this.draft) return;
    const pt = this.hitPoint(e);
    if (!pt) return;

    if (this.draft.type === 'hline') {
      this.draft.points = [{ t: pt.t, price: pt.price }];
    } else if (this.draft.type === 'vline' || this.draft.type === 'text') {
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
    const needsTwo = ['trendline', 'rectangle', 'fibonacci'].includes(this.draft.type);
    if (needsTwo && this.draft.points.length < 2) {
      this.draft = null;
      return;
    }
    this.drawings.push(this.draft);
    this.draft = null;
    this.persist();
    this.redraw();
  };

  private hitPoint(e: PointerEvent): { t: number; price: number; x: number; y: number } | null {
    const rect = this.opts.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.opts.canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * this.opts.canvas.height;
    const t = this.opts.xToTime?.(x) ?? null;
    const price = this.opts.yToPrice?.(y) ?? null;
    if (t == null || price == null) return null;
    return { t, price, x, y };
  }

  private hitTestDrawing(x: number, y: number): string | null {
    const tol = 8 * devicePixelRatio;
    let best: { id: string; dist: number } | null = null;

    for (const d of this.drawings) {
      const dist = this.distanceToDrawing(d, x, y);
      if (dist == null || dist > tol) continue;
      if (!best || dist < best.dist) best = { id: d.id, dist };
    }
    return best?.id ?? null;
  }

  private distanceToDrawing(d: DrawingRecord, x: number, y: number): number | null {
    if (d.type === 'hline' && d.points[0]) {
      const py = this.opts.priceToY(d.points[0].price);
      return py == null ? null : Math.abs(y - py);
    }
    if (d.type === 'vline' && d.points[0]) {
      const px = this.opts.timeToX(d.points[0].t);
      return px == null ? null : Math.abs(x - px);
    }
    if (d.type === 'trendline' && d.points.length >= 2) {
      return this.distToSegment(d, x, y);
    }
    if ((d.type === 'rectangle' || d.type === 'fibonacci') && d.points.length >= 2) {
      const x1 = this.opts.timeToX(d.points[0]!.t);
      const y1 = this.opts.priceToY(d.points[0]!.price);
      const x2 = this.opts.timeToX(d.points[1]!.t);
      const y2 = this.opts.priceToY(d.points[1]!.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      const inside = x >= left && x <= right && y >= top && y <= bottom;
      const edge = Math.min(
        Math.abs(x - left),
        Math.abs(x - right),
        Math.abs(y - top),
        Math.abs(y - bottom),
      );
      return inside ? 0 : edge;
    }
    if (d.type === 'text' && d.points[0]) {
      const px = this.opts.timeToX(d.points[0].t);
      const py = this.opts.priceToY(d.points[0].price);
      if (px == null || py == null) return null;
      return Math.hypot(x - px, y - py);
    }
    return null;
  }

  private distToSegment(d: DrawingRecord, x: number, y: number): number | null {
    const x1 = this.opts.timeToX(d.points[0]!.t);
    const y1 = this.opts.priceToY(d.points[0]!.price);
    const x2 = this.opts.timeToX(d.points[1]!.t);
    const y2 = this.opts.priceToY(d.points[1]!.price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(x - x1, y - y1);
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    return Math.hypot(x - px, y - py);
  }
}