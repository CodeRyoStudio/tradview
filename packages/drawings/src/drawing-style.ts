import type { DrawingRecord } from './storage.js';

export interface DrawingStyleMeta {
  color?: string;
  lineWidth?: number;
  locked?: boolean;
  text?: string;
}

export const DEFAULT_DRAWING_STYLE: Required<Pick<DrawingStyleMeta, 'color' | 'lineWidth'>> = {
  color: '#58a6ff',
  lineWidth: 2,
};

export function getDrawingStyle(d: DrawingRecord): DrawingStyleMeta & {
  color: string;
  lineWidth: number;
  locked: boolean;
} {
  const m = (d.meta ?? {}) as DrawingStyleMeta;
  return {
    color: m.color ?? DEFAULT_DRAWING_STYLE.color,
    lineWidth: m.lineWidth ?? DEFAULT_DRAWING_STYLE.lineWidth,
    locked: Boolean(m.locked),
    text: m.text,
  };
}

export function setDrawingStyle(d: DrawingRecord, patch: DrawingStyleMeta): void {
  d.meta = { ...(d.meta ?? {}), ...patch };
}