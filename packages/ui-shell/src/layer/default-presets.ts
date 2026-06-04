import { layoutSchemaToPreset } from './grid-to-preset.js';
import type { LayoutPreset } from './types.js';
import { normalizeLayoutPreset } from './normalize.js';

/** Built-in integrator preset — matches legacy DEFAULT_LAYOUT_SCHEMA proportions. */
export const VENDOR_DEFAULT_PRESET: LayoutPreset = layoutSchemaToPreset(undefined, {
  id: 'vendor-default',
  name: 'TradView 預設',
});

/** Compact: chart-focused, smaller chrome. */
export const VENDOR_COMPACT_PRESET: LayoutPreset = normalizeLayoutPreset({
  ...layoutSchemaToPreset(undefined, { id: 'vendor-compact', name: '精簡圖表' }),
  layers: layoutSchemaToPreset(undefined).layers.map((l) => {
    if (l.widgetKey === 'propertiesPanel') {
      return { ...l, visible: false, frame: { ...l.frame, w: 0.001, h: 0.001 } };
    }
    if (l.widgetKey === 'leftToolbar') {
      return { ...l, frame: { x: 0, y: 0.06, w: 0.04, h: 0.88 } };
    }
    if (l.widgetKey === 'chartMain') {
      return { ...l, frame: { x: 0.04, y: 0.06, w: 0.96, h: 0.4 } };
    }
    if (l.widgetKey === 'chartVolume') {
      return { ...l, frame: { x: 0.04, y: 0.46, w: 0.96, h: 0.16 } };
    }
    if (l.widgetKey === 'chartIndicator') {
      return { ...l, frame: { x: 0.04, y: 0.68, w: 0.96, h: 0.22 } };
    }
    return l;
  }),
});

/** Demo: main+volume share `prices`; indicator pane uses separate `osc` group. */
export const VENDOR_DUAL_SYNC_PRESET: LayoutPreset = normalizeLayoutPreset({
  ...layoutSchemaToPreset(undefined, { id: 'vendor-dual-sync', name: '雙時間軸分組' }),
  layers: layoutSchemaToPreset(undefined).layers.map((l) => {
    if (l.type === 'chart.main' || l.type === 'chart.volume') {
      return { ...l, syncTimeScaleGroupId: 'prices' };
    }
    if (l.type === 'chart.indicator') {
      return { ...l, syncTimeScaleGroupId: 'osc' };
    }
    return l;
  }),
});

export const BUILTIN_PRESETS: LayoutPreset[] = [
  VENDOR_DEFAULT_PRESET,
  VENDOR_COMPACT_PRESET,
  VENDOR_DUAL_SYNC_PRESET,
];

export function getBuiltinPreset(id: string): LayoutPreset | undefined {
  return BUILTIN_PRESETS.find((p) => p.id === id);
}