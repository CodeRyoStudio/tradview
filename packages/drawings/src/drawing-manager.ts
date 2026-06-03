import { getDrawingStyle, setDrawingStyle, type DrawingStyleMeta } from './drawing-style.js';
import type { DrawingRecord } from './storage.js';
import { loadDrawings, saveDrawings, storageKey } from './storage.js';

export type { DrawingRecord, DrawingStyleMeta };

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
  /** Main chart pane (overlay parent); cursor-mode hit tests use capture here while overlay is pass-through. */
  interactionHost?: HTMLElement;
  chartId: string;
  symbol: string;
  interval: string;
  priceToY: (price: number) => number | null;
  timeToX: (tMs: number) => number | null;
  xToTime?: (x: number) => number | null;
  yToPrice?: (y: number) => number | null;
  returnToCursorAfterDraw?: boolean;
  onSelectionChange?: (id: string | null, record: DrawingRecord | null) => void;
  onRequestCursorTool?: () => void;
  onContextMenu?: (payload: {
    clientX: number;
    clientY: number;
    drawing: DrawingRecord | null;
  }) => void;
}

interface DrawingContext {
  chartId: string;
  symbol: string;
  interval: string;
}

type DragState =
  | { kind: 'anchor'; drawingId: string; pointIndex: number }
  | {
      kind: 'body';
      drawingId: string;
      startPoints: Array<{ t: number; price: number }>;
      startT: number;
      startPrice: number;
    };

export class DrawingManager {
  private tool: DrawingTool = 'cursor';
  private drawings: DrawingRecord[] = [];
  private draft: DrawingRecord | null = null;
  private selectedId: string | null = null;
  private drag: DragState | null = null;
  private activePointerId: number | null = null;
  private key: string;
  private readonly ctx: DrawingContext;
  private readonly handleRadius: number;
  private labelDragIndex: number | null = null;
  private readonly interactionHost: HTMLElement | null;
  private hostListenersAttached = false;
  private moveListenerTarget: HTMLElement | null = null;

  constructor(private readonly opts: DrawingManagerOptions) {
    this.interactionHost = opts.interactionHost ?? opts.canvas.parentElement;
    this.ctx = {
      chartId: opts.chartId,
      symbol: opts.symbol,
      interval: opts.interval,
    };
    this.key = storageKey(this.ctx.chartId, this.ctx.symbol, this.ctx.interval);
    this.drawings = loadDrawings(this.key).drawings;
    this.handleRadius = 6 * devicePixelRatio;
    opts.canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('keydown', this.onKeyDown);
    opts.canvas.addEventListener('contextmenu', this.onContextMenu);
    opts.canvas.style.touchAction = 'none';
    if (this.interactionHost) this.interactionHost.style.touchAction = 'none';
    this.applyPointerMode();
  }

  setTool(tool: DrawingTool): void {
    this.tool = tool;
    if (tool !== 'cursor') {
      this.selectedId = null;
      this.drag = null;
    }
    this.applyPointerMode();
    this.redraw();
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  deleteSelected(): boolean {
    if (!this.selectedId) return false;
    this.drawings = this.drawings.filter((d) => d.id !== this.selectedId);
    this.selectedId = null;
    this.drag = null;
    this.persist();
    this.redraw();
    this.emitSelection();
    return true;
  }

  deselect(): void {
    this.selectedId = null;
    this.drag = null;
    this.redraw();
    this.emitSelection();
  }

  getSelected(): DrawingRecord | null {
    return this.selectedId ? (this.getDrawing(this.selectedId) ?? null) : null;
  }

  copySelected(): DrawingRecord | null {
    const src = this.getSelected();
    if (!src) return null;
    const intervalMs = 3_600_000;
    const copy: DrawingRecord = {
      ...src,
      id: `d-${Date.now()}`,
      points: src.points.map((p) => ({ t: p.t + intervalMs * 0.02, price: p.price * 1.001 })),
      meta: { ...(src.meta ?? {}) },
    };
    this.drawings.push(copy);
    this.selectedId = copy.id;
    this.persist();
    this.redraw();
    this.emitSelection();
    return copy;
  }

  toggleLockSelected(): boolean {
    const d = this.getSelected();
    if (!d) return false;
    const style = getDrawingStyle(d);
    setDrawingStyle(d, { locked: !style.locked });
    this.persist();
    this.redraw();
    this.emitSelection();
    return !style.locked;
  }

  updateSelectedStyle(patch: DrawingStyleMeta): void {
    const d = this.getSelected();
    if (!d) return;
    setDrawingStyle(d, patch);
    this.persist();
    this.redraw();
    this.emitSelection();
  }

  setReturnToCursorAfterDraw(v: boolean): void {
    (this.opts as { returnToCursorAfterDraw?: boolean }).returnToCursorAfterDraw = v;
  }

  private applyPointerMode(): void {
    const cursor = this.tool === 'cursor';
    this.opts.canvas.style.pointerEvents = cursor ? 'none' : 'auto';
    const moveTarget = cursor && this.interactionHost ? this.interactionHost : this.opts.canvas;
    this.setMoveListeners(moveTarget);

    if (!this.interactionHost) return;
    if (cursor && !this.hostListenersAttached) {
      this.interactionHost.addEventListener('pointerdown', this.onHostPointerDown, true);
      this.interactionHost.addEventListener('contextmenu', this.onHostContextMenu, true);
      this.hostListenersAttached = true;
    } else if (!cursor && this.hostListenersAttached) {
      this.interactionHost.removeEventListener('pointerdown', this.onHostPointerDown, true);
      this.interactionHost.removeEventListener('contextmenu', this.onHostContextMenu, true);
      this.hostListenersAttached = false;
    }
  }

  private setMoveListeners(target: HTMLElement): void {
    if (this.moveListenerTarget === target) return;
    if (this.moveListenerTarget) {
      this.moveListenerTarget.removeEventListener('pointermove', this.onMove);
      this.moveListenerTarget.removeEventListener('pointerup', this.onUp);
      this.moveListenerTarget.removeEventListener('pointercancel', this.onUp);
    }
    this.moveListenerTarget = target;
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerup', this.onUp);
    target.addEventListener('pointercancel', this.onUp);
  }

  setContext(symbol: string, interval: string): void {
    this.ctx.symbol = symbol;
    this.ctx.interval = interval;
    this.key = storageKey(this.ctx.chartId, symbol, interval);
    this.drawings = loadDrawings(this.key).drawings;
    this.selectedId = null;
    this.draft = null;
    this.drag = null;
    this.redraw();
  }

  redraw(): void {
    const canvas = this.opts.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const d of [...this.drawings, ...(this.draft ? [this.draft] : [])]) {
      const selected = d.id === this.selectedId;
      const style = getDrawingStyle(d);
      ctx.strokeStyle = selected ? '#f78166' : style.color;
      ctx.fillStyle = selected ? '#f7816688' : `${style.color}44`;
      ctx.lineWidth = (selected ? style.lineWidth + 1 : style.lineWidth) * devicePixelRatio;
      ctx.font = `${12 * devicePixelRatio}px sans-serif`;
      this.paint(ctx, d);
      if (selected && !this.draft && this.tool === 'cursor') this.paintHandles(ctx, d);
    }

    if (
      this.labelDragIndex != null &&
      this.selectedId &&
      this.drag?.kind === 'anchor'
    ) {
      const d = this.getDrawing(this.selectedId);
      const p = d?.points[this.labelDragIndex];
      if (d && p) this.paintAnchorLabel(ctx, p.t, p.price);
    }
  }

  private paintAnchorLabel(ctx: CanvasRenderingContext2D, t: number, price: number): void {
    const x = this.opts.timeToX(t);
    const y = this.opts.priceToY(price);
    if (x == null || y == null) return;
    const label = `${new Date(t).toLocaleString()}  ${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
    ctx.font = `${11 * devicePixelRatio}px sans-serif`;
    ctx.fillStyle = '#0d1117';
    const pad = 4 * devicePixelRatio;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(x + 8, y - 20, tw + pad * 2, 16 * devicePixelRatio);
    ctx.fillStyle = '#e6edf3';
    ctx.fillText(label, x + 8 + pad, y - 8);
  }

  destroy(): void {
    this.opts.canvas.removeEventListener('pointerdown', this.onDown);
    if (this.moveListenerTarget) {
      this.moveListenerTarget.removeEventListener('pointermove', this.onMove);
      this.moveListenerTarget.removeEventListener('pointerup', this.onUp);
      this.moveListenerTarget.removeEventListener('pointercancel', this.onUp);
      this.moveListenerTarget = null;
    }
    this.opts.canvas.removeEventListener('contextmenu', this.onContextMenu);
    if (this.interactionHost && this.hostListenersAttached) {
      this.interactionHost.removeEventListener('pointerdown', this.onHostPointerDown, true);
      this.interactionHost.removeEventListener('contextmenu', this.onHostContextMenu, true);
      this.hostListenersAttached = false;
    }
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private emitSelection(): void {
    this.opts.onSelectionChange?.(this.selectedId, this.getSelected());
  }

  private onContextMenu = (e: MouseEvent) => {
    if (this.tool !== 'cursor') return;
    this.openDrawingContextMenu(e);
  };

  private onHostContextMenu = (e: MouseEvent) => {
    if (this.tool !== 'cursor') return;
    const pt = this.hitPointFromClient(e.clientX, e.clientY);
    if (!pt) return;
    const onDrawing =
      this.hitTestAnchorAny(pt.x, pt.y) != null || this.hitTestDrawing(pt.x, pt.y) != null;
    if (!onDrawing) return;
    e.preventDefault();
    e.stopPropagation();
    this.openDrawingContextMenu(e);
  };

  private openDrawingContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const pt = this.hitPointFromClient(e.clientX, e.clientY);
    if (pt) {
      const hit = this.hitTestDrawing(pt.x, pt.y);
      if (hit) this.selectedId = hit;
      this.redraw();
      this.emitSelection();
    }
    this.opts.onContextMenu?.({
      clientX: e.clientX,
      clientY: e.clientY,
      drawing: this.getSelected(),
    });
  };

  private onHostPointerDown = (e: PointerEvent) => {
    if (this.tool !== 'cursor') return;
    if (this.handleCursorPointerDown(e)) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

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

  private paintHandles(ctx: CanvasRenderingContext2D, d: DrawingRecord): void {
    for (const p of d.points) {
      const x = this.opts.timeToX(p.t);
      const y = this.opts.priceToY(p.price);
      if (x == null || y == null) continue;
      ctx.beginPath();
      ctx.fillStyle = '#f78166';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.arc(x, y, this.handleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
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

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.tool !== 'cursor' || !this.selectedId) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      this.deleteSelected();
      e.preventDefault();
    }
  };

  private handleCursorPointerDown(e: PointerEvent): boolean {
    const pt = this.hitPoint(e);
    if (!pt) return false;

    const anchor = this.hitTestAnchorAny(pt.x, pt.y);
    if (anchor) {
      const d = this.getDrawing(anchor.drawingId);
      if (d && getDrawingStyle(d).locked) return true;
      this.selectedId = anchor.drawingId;
      this.drag = { kind: 'anchor', drawingId: anchor.drawingId, pointIndex: anchor.pointIndex };
      this.labelDragIndex = anchor.pointIndex;
      this.capturePointer(e);
      this.redraw();
      this.emitSelection();
      return true;
    }

    const id = this.hitTestDrawing(pt.x, pt.y);
    this.selectedId = id;
    if (id) {
      const d = this.getDrawing(id);
      if (d && !getDrawingStyle(d).locked) {
        this.drag = {
          kind: 'body',
          drawingId: id,
          startPoints: d.points.map((p) => ({ ...p })),
          startT: pt.t,
          startPrice: pt.price,
        };
        this.capturePointer(e);
      }
      this.redraw();
      this.emitSelection();
      return true;
    }

    if (this.selectedId) {
      this.selectedId = null;
      this.drag = null;
      this.redraw();
      this.emitSelection();
    }
    return false;
  }

  private onDown = (e: PointerEvent) => {
    if (this.tool === 'cursor') return;

    const pt = this.hitPoint(e);
    if (!pt) return;

    const type = this.tool === 'hline' ? 'hline' : this.tool;
    this.draft = {
      id: `d-${Date.now()}`,
      type,
      symbol: this.ctx.symbol,
      interval: this.ctx.interval,
      points: [pt],
      meta: type === 'text' ? { text: 'Note' } : undefined,
    };
    this.capturePointer(e);
  };

  private onMove = (e: PointerEvent) => {
    if (this.drag && this.activePointerId === e.pointerId) {
      const pt = this.hitPoint(e);
      if (!pt) return;
      const d = this.getDrawing(this.drag.drawingId);
      if (!d || getDrawingStyle(d).locked) return;

      if (this.drag.kind === 'anchor') {
        this.labelDragIndex = this.drag.pointIndex;
        d.points[this.drag.pointIndex] = { t: pt.t, price: pt.price };
      } else {
        const dt = pt.t - this.drag.startT;
        const dp = pt.price - this.drag.startPrice;
        d.points = this.drag.startPoints.map((p) => ({
          t: p.t + dt,
          price: p.price + dp,
        }));
      }
      this.redraw();
      return;
    }

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

  private onUp = (e: PointerEvent) => {
    if (this.activePointerId === e.pointerId) {
      this.releasePointer(e);
    }

    if (this.drag) {
      const changed = this.drag.kind === 'anchor' || this.drag.kind === 'body';
      this.drag = null;
      this.labelDragIndex = null;
      if (changed) this.persist();
      this.redraw();
      return;
    }

    if (!this.draft) return;
    const needsTwo = ['trendline', 'rectangle', 'fibonacci'].includes(this.draft.type);
    if (needsTwo && this.draft.points.length < 2) {
      this.draft = null;
      return;
    }
    const finishedTool = this.tool;
    this.drawings.push(this.draft);
    this.selectedId = this.draft.id;
    this.draft = null;
    this.persist();
    this.redraw();
    this.emitSelection();
    if (this.opts.returnToCursorAfterDraw && finishedTool !== 'cursor') {
      this.setTool('cursor');
      this.opts.onRequestCursorTool?.();
    }
  };

  private capturePointer(e: PointerEvent): void {
    this.activePointerId = e.pointerId;
    const target =
      this.tool === 'cursor' && this.interactionHost ? this.interactionHost : this.opts.canvas;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private releasePointer(e: PointerEvent): void {
    this.activePointerId = null;
    const target =
      this.tool === 'cursor' && this.interactionHost ? this.interactionHost : this.opts.canvas;
    try {
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  }

  private getDrawing(id: string): DrawingRecord | undefined {
    return this.drawings.find((d) => d.id === id);
  }

  private hitPoint(e: PointerEvent): { t: number; price: number; x: number; y: number } | null {
    return this.hitPointFromClient(e.clientX, e.clientY);
  }

  private hitPointFromClient(
    clientX: number,
    clientY: number,
  ): { t: number; price: number; x: number; y: number } | null {
    const rect = this.opts.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * this.opts.canvas.width;
    const y = ((clientY - rect.top) / rect.height) * this.opts.canvas.height;
    const t = this.opts.xToTime?.(x) ?? null;
    const price = this.opts.yToPrice?.(y) ?? null;
    if (t == null || price == null) return null;
    return { t, price, x, y };
  }

  private hitTestAnchorAny(x: number, y: number): { drawingId: string; pointIndex: number } | null {
    const r = this.handleRadius + 4 * devicePixelRatio;
    let best: { drawingId: string; pointIndex: number; dist: number } | null = null;

    for (const d of this.drawings) {
      for (let i = 0; i < d.points.length; i++) {
        const p = d.points[i]!;
        const px = this.opts.timeToX(p.t);
        const py = this.opts.priceToY(p.price);
        if (px == null || py == null) continue;
        const dist = Math.hypot(x - px, y - py);
        if (dist > r) continue;
        if (!best || dist < best.dist) {
          best = { drawingId: d.id, pointIndex: i, dist };
        }
      }
    }
    return best ? { drawingId: best.drawingId, pointIndex: best.pointIndex } : null;
  }

  private hitTestDrawing(x: number, y: number): string | null {
    const tol = 10 * devicePixelRatio;
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