import type { LayerNode, LayerType } from './types.js';

export const OVERLAY_LAYER_TYPES: readonly LayerType[] = [
  'overlay.crosshairLegend',
  'overlay.drawing',
] as const;

export function isOverlayLayerType(type: string): type is LayerType {
  return (OVERLAY_LAYER_TYPES as readonly string[]).includes(type);
}

/** Anchor crosshair legend + drawing overlay frames to chart.main on one page (P3). */
export function syncOverlayLayersToMain(layers: LayerNode[], pageId: string): void {
  const main = layers.find((l) => l.type === 'chart.main' && l.pageId === pageId);
  if (!main) return;

  const legend = layers.find(
    (l) => l.type === 'overlay.crosshairLegend' && l.pageId === pageId,
  );
  if (legend) {
    legend.frame = {
      x: main.frame.x,
      y: main.frame.y,
      w: Math.min(0.35, main.frame.w),
      h: Math.min(0.1, main.frame.h),
    };
  }

  const drawing = layers.find((l) => l.type === 'overlay.drawing' && l.pageId === pageId);
  if (drawing) {
    drawing.frame = {
      x: main.frame.x,
      y: main.frame.y,
      w: main.frame.w,
      h: main.frame.h,
    };
    if (drawing.zIndex <= main.zIndex) {
      drawing.zIndex = main.zIndex + 2;
    }
  }
}

/** Sync overlays for every page (normalize / bulk migrate). */
export function syncAllOverlayLayersToMain(layers: LayerNode[]): void {
  const pageIds = [...new Set(layers.map((l) => l.pageId))];
  for (const pageId of pageIds) {
    syncOverlayLayersToMain(layers, pageId);
  }
}

/** Active-page drawing overlay visibility (wire to `IChart.setFeatures({ drawings: { layer } })`). */
export function getDrawingOverlayVisible(
  controller: { getLayersForActivePage(): LayerNode[] },
): boolean {
  const drawing = controller
    .getLayersForActivePage()
    .find((l) => l.type === 'overlay.drawing');
  return drawing?.visible ?? true;
}

/** Insert default overlay layers when chart.main exists (normalize). */
export function ensureOverlayLayers(
  layers: LayerNode[],
  pageId: string,
): LayerNode[] {
  const main = layers.find((l) => l.type === 'chart.main' && l.pageId === pageId);
  if (!main) return layers;

  const out = [...layers];
  if (!out.some((l) => l.type === 'overlay.crosshairLegend' && l.pageId === pageId)) {
    out.push({
      id: `layer-crosshairLegend-${pageId}`,
      pageId,
      type: 'overlay.crosshairLegend',
      widgetKey: 'crosshairLegend',
      frame: { x: main.frame.x, y: main.frame.y, w: 0.2, h: 0.08 },
      zIndex: main.zIndex + 5,
      visible: true,
      locked: false,
    });
  }
  if (!out.some((l) => l.type === 'overlay.drawing' && l.pageId === pageId)) {
    out.push({
      id: `layer-drawingOverlay-${pageId}`,
      pageId,
      type: 'overlay.drawing',
      widgetKey: 'drawingOverlay',
      frame: { ...main.frame },
      zIndex: main.zIndex + 3,
      visible: true,
      locked: false,
    });
  }
  syncOverlayLayersToMain(out, pageId);
  return out;
}