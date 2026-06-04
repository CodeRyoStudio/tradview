import { clampFrame } from './normalize.js';
import type { LayerFrame, LayerNode } from './types.js';

/** Union bounding box of layer frames (normalized 0..1). */
export function getLayersBoundingBox(layers: Pick<LayerNode, 'frame'>[]): LayerFrame | null {
  if (layers.length === 0) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const l of layers) {
    const f = l.frame;
    minX = Math.min(minX, f.x);
    minY = Math.min(minY, f.y);
    maxX = Math.max(maxX, f.x + f.w);
    maxY = Math.max(maxY, f.y + f.h);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 0 || h <= 0) return null;
  return { x: minX, y: minY, w, h };
}

/** Move all frames by normalized delta; each frame is clamped independently. */
export function moveLayerFrames(
  frames: LayerFrame[],
  dx: number,
  dy: number,
): LayerFrame[] {
  return frames.map((f) =>
    clampFrame({
      ...f,
      x: f.x + dx,
      y: f.y + dy,
    }),
  );
}

/**
 * Resize a group by mapping each member's relative position inside oldBbox into newBbox.
 */
export function resizeGroupFrames(
  members: Pick<LayerNode, 'frame'>[],
  oldBbox: LayerFrame,
  newBbox: LayerFrame,
): LayerFrame[] {
  const ow = Math.max(oldBbox.w, 0.02);
  const oh = Math.max(oldBbox.h, 0.02);
  const nw = Math.max(newBbox.w, 0.02);
  const nh = Math.max(newBbox.h, 0.02);
  return members.map((m) => {
    const f = m.frame;
    const relX = (f.x - oldBbox.x) / ow;
    const relY = (f.y - oldBbox.y) / oh;
    const relW = f.w / ow;
    const relH = f.h / oh;
    return clampFrame({
      x: newBbox.x + relX * nw,
      y: newBbox.y + relY * nh,
      w: relW * nw,
      h: relH * nh,
    });
  });
}

export function clampBBox(frame: LayerFrame): LayerFrame {
  return clampFrame(frame);
}