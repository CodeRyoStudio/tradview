import { describe, expect, it } from 'vitest';
import { layoutSchemaToPreset } from '../src/layer/grid-to-preset.js';
import { DEFAULT_SYNC_TIME_SCALE_GROUP } from '../src/layer/chart-pane-mount.js';
import { normalizeLayoutPreset, clampFrame } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET, getBuiltinPreset } from '../src/layer/default-presets.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { LayerController } from '../src/layer/layer-controller.js';

describe('LayoutPreset v2', () => {
  it('migrates grid schema to preset with normalized frames', () => {
    const preset = layoutSchemaToPreset();
    expect(preset.version).toBe(2);
    expect(preset.layers.length).toBeGreaterThanOrEqual(8);
    expect(preset.layers.some((l) => l.type === 'overlay.drawing')).toBe(true);
    const main = preset.layers.find((l) => l.type === 'chart.main');
    const volume = preset.layers.find((l) => l.type === 'chart.volume');
    const legend = preset.layers.find((l) => l.widgetKey === 'crosshairLegend');
    expect(legend?.type).toBe('overlay.crosshairLegend');
    expect(main).toBeDefined();
    expect(volume).toBeDefined();
    expect(main!.frame.w).toBeGreaterThan(0);
    expect(main!.frame.x).toBeCloseTo(1 / 12, 3);
    expect(main!.syncTimeScaleGroupId).toBeUndefined();
  });

  it('normalize preserves explicit syncTimeScaleGroupId', () => {
    const preset = normalizeLayoutPreset({
      version: 2,
      id: 'test-sync',
      name: 'Sync',
      author: 'user',
      pages: [{ id: 'p1', title: 'P1' }],
      layers: [
        {
          id: 'm',
          pageId: 'p1',
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0, y: 0, w: 0.5, h: 0.5 },
          zIndex: 0,
          visible: true,
          locked: false,
          syncTimeScaleGroupId: 'my-group',
        },
      ],
      groups: [],
    });
    expect(preset.layers.find((l) => l.type === 'chart.main')?.syncTimeScaleGroupId).toBe(
      'my-group',
    );
  });

  it('normalize never auto-fills DEFAULT_SYNC_TIME_SCALE_GROUP (empty = independent)', () => {
    const preset = normalizeLayoutPreset({
      version: 2,
      id: 'test',
      name: 'Test',
      author: 'user',
      pages: [{ id: 'p1', title: 'P1' }],
      layers: [
        {
          id: 'm',
          pageId: 'p1',
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0, y: 0, w: 0.5, h: 0.5 },
          zIndex: 0,
          visible: true,
          locked: false,
        },
      ],
      groups: [],
    });
    expect(DEFAULT_SYNC_TIME_SCALE_GROUP).toBe('chart-timescale');
    for (const l of preset.layers) {
      if (l.type === 'chart.main' || l.type === 'chart.volume' || l.type === 'chart.indicator') {
        expect(l.syncTimeScaleGroupId).toBeUndefined();
      }
    }
  });

  it('clamps frame into 0..1', () => {
    const f = clampFrame({ x: 2, y: -1, w: 0.5, h: 0.5 });
    expect(f.x).toBeLessThanOrEqual(0.5);
    expect(f.y).toBe(0);
  });

  it('layer controller toggles visibility', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const id = ctrl.getLayersForActivePage().find((l) => l.widgetKey === 'topBar')!.id;
    ctrl.setLayerVisible(id, false);
    expect(ctrl.getLayersForActivePage().find((l) => l.id === id)!.visible).toBe(false);
  });

  it('builtin presets resolve', () => {
    expect(getBuiltinPreset('vendor-default')?.id).toBe('vendor-default');
    expect(getBuiltinPreset('missing')).toBeUndefined();
  });

  it('normalize dedupes layer ids', () => {
    const preset = normalizeLayoutPreset({
      ...VENDOR_DEFAULT_PRESET,
      layers: [
        ...VENDOR_DEFAULT_PRESET.layers,
        { ...VENDOR_DEFAULT_PRESET.layers[0]! },
      ],
    });
    const ids = new Set(preset.layers.map((l) => l.id));
    expect(ids.size).toBe(preset.layers.length);
  });
});