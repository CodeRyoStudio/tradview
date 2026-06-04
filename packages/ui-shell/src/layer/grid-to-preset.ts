import type { LayoutSchema, LayoutWidgetId } from '../layout-schema.js';
import { DEFAULT_LAYOUT_SCHEMA } from '../layout-schema.js';
import type { LayerNode, LayerType, LayoutPreset } from './types.js';
import { LAYER_PRESET_VERSION } from './types.js';
import { normalizeLayoutPreset } from './normalize.js';

const WIDGET_META: Partial<
  Record<LayoutWidgetId, { layerId: string; type: LayerType; widgetKey: string; z: number }>
> = {
  topBar: { layerId: 'layer-topBar', type: 'shell.topBar', widgetKey: 'topBar', z: 10 },
  leftToolbar: { layerId: 'layer-leftToolbar', type: 'shell.leftToolbar', widgetKey: 'leftToolbar', z: 20 },
  indicatorHost: {
    layerId: 'layer-chartIndicator',
    type: 'chart.indicator',
    widgetKey: 'chartIndicator',
    z: 45,
  },
  statusBar: { layerId: 'layer-statusBar', type: 'shell.statusBar', widgetKey: 'statusBar', z: 50 },
  propertiesPanel: {
    layerId: 'layer-propertiesPanel',
    type: 'shell.propertiesPanel',
    widgetKey: 'propertiesPanel',
    z: 60,
  },
  bottomToolbar: { layerId: 'layer-bottomToolbar', type: 'shell.bottomToolbar', widgetKey: 'bottomToolbar', z: 70 },
};

const MAIN_VOLUME_RATIO = 0.65;

function chartHostLayers(
  w: LayoutSchema['widgets'][number],
  columns: number,
  rows: number,
  pageId: string,
): LayerNode[] {
  const frame = {
    x: w.col / columns,
    y: w.row / rows,
    w: w.colSpan / columns,
    h: w.rowSpan / rows,
  };
  const mainH = frame.h * MAIN_VOLUME_RATIO;
  return [
    {
      id: 'layer-chartMain',
      pageId,
      type: 'chart.main',
      widgetKey: 'chartMain',
      frame: { x: frame.x, y: frame.y, w: frame.w, h: mainH },
      zIndex: 30,
      visible: true,
      locked: false,
    },
    {
      id: 'layer-chartVolume',
      pageId,
      type: 'chart.volume',
      widgetKey: 'chartVolume',
      frame: { x: frame.x, y: frame.y + mainH, w: frame.w, h: frame.h - mainH },
      zIndex: 35,
      visible: true,
      locked: false,
    },
  ];
}

/**
 * Convert legacy 12×12 grid schema to normalized layer preset (single page).
 * @deprecated Public export moves to `@coderyo/ui-shell/migrate` @ 2.0.0-rc.2; prefer compositor builtins / presets. See docs/MIGRATION-2.0.md §5.
 */
export function layoutSchemaToPreset(
  schema: LayoutSchema = DEFAULT_LAYOUT_SCHEMA,
  opts: { id?: string; name?: string } = {},
): LayoutPreset {
  const columns = schema.columns || 12;
  const rows = schema.rows || 12;
  const pageId = 'page-1';

  const layers: LayerNode[] = [];
  for (const w of schema.widgets) {
    if (w.id === 'chartHost') {
      layers.push(...chartHostLayers(w, columns, rows, pageId));
      continue;
    }
    const meta = WIDGET_META[w.id];
    if (!meta) continue;
    layers.push({
      id: meta.layerId,
      pageId,
      type: meta.type,
      widgetKey: meta.widgetKey,
      frame: {
        x: w.col / columns,
        y: w.row / rows,
        w: w.colSpan / columns,
        h: w.rowSpan / rows,
      },
      zIndex: meta.z,
      visible: true,
      locked: false,

    });
  }

  const chartMain = layers.find((l) => l.widgetKey === 'chartMain');
  if (chartMain) {
    layers.push({
      id: 'layer-crosshairLegend',
      pageId,
      type: 'overlay.crosshairLegend',
      widgetKey: 'crosshairLegend',
      frame: {
        x: chartMain.frame.x,
        y: chartMain.frame.y,
        w: Math.min(0.35, chartMain.frame.w),
        h: Math.min(0.1, chartMain.frame.h),
      },
      zIndex: chartMain.zIndex + 5,
      visible: true,
      locked: false,
    });
    layers.push({
      id: 'layer-drawingOverlay',
      pageId,
      type: 'overlay.drawing',
      widgetKey: 'drawingOverlay',
      frame: { ...chartMain.frame },
      zIndex: chartMain.zIndex + 3,
      visible: true,
      locked: false,
    });
  }

  return normalizeLayoutPreset({
    version: LAYER_PRESET_VERSION,
    id: opts.id ?? 'vendor-default',
    name: opts.name ?? 'TradView 預設',
    author: 'integrator',
    readonly: false,
    pages: [{ id: pageId, title: '圖表' }],
    layers,
    groups: [],
  });
}