import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SYNC_TIME_SCALE_GROUP,
  expandLegacyChartHostLayers,
  isChartPaneLayerType,
  paneIdFromWidgetKey,
  upgradeIndicatorHostType,
  widgetKeyForChartPaneType,
} from '../src/layer/chart-pane-mount.js';
import { layoutSchemaToPreset } from '../src/layer/grid-to-preset.js';
import { LayerController } from '../src/layer/layer-controller.js';
import { cloneLayoutPreset, normalizeLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import { LAYER_PRESET_VERSION } from '../src/layer/types.js';

describe('chart pane mount helpers', () => {
  it('grid preset includes main, volume, indicator chart layers', () => {
    const preset = layoutSchemaToPreset();
    const main = preset.layers.find((l) => l.type === 'chart.main');
    const vol = preset.layers.find((l) => l.type === 'chart.volume');
    const ind = preset.layers.find((l) => l.type === 'chart.indicator');
    expect(main?.widgetKey).toBe('chartMain');
    expect(vol?.widgetKey).toBe('chartVolume');
    expect(ind?.widgetKey).toBe('chartIndicator');
    expect(main?.syncTimeScaleGroupId).toBeUndefined();
    expect(vol?.syncTimeScaleGroupId).toBeUndefined();
  });

  it('expands legacy chart.host into main + volume', () => {
    const host = {
      id: 'layer-chartHost',
      pageId: 'page-1',
      type: 'chart.host' as const,
      widgetKey: 'chartHost',
      frame: { x: 0.1, y: 0.1, w: 0.5, h: 0.4 },
      zIndex: 3,
      visible: true,
      locked: false,
    };
    const out = expandLegacyChartHostLayers([host]);
    expect(out).toHaveLength(2);
    expect(out.find((l) => l.type === 'chart.main')?.frame.h).toBeCloseTo(0.26, 3);
    expect(out.find((l) => l.type === 'chart.volume')?.frame.y).toBeGreaterThan(0.1);
  });

  it('maps widget keys to pane ids', () => {
    expect(widgetKeyForChartPaneType('chart.volume')).toBe('chartVolume');
    expect(paneIdFromWidgetKey('chartMain')).toBe('main');
    expect(paneIdFromWidgetKey('chartVolume')).toBe('volume');
    expect(isChartPaneLayerType('chart.main')).toBe(true);
    expect(isChartPaneLayerType('shell.topBar')).toBe(false);
  });

  it('controller focusChartPane raises z-index', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const main = ctrl.getLayersForActivePage().find((l) => l.type === 'chart.main')!;
    const vol = ctrl.getLayersForActivePage().find((l) => l.type === 'chart.volume')!;
    const zMainBefore = main.zIndex;
    ctrl.focusChartPane(main.id);
    expect(ctrl.getFocusedPaneLayerId()).toBe(main.id);
    expect(ctrl.getLayer(main.id)!.zIndex).toBeGreaterThanOrEqual(zMainBefore);
    ctrl.focusChartPane(vol.id);
    expect(ctrl.getFocusedPaneLayerId()).toBe(vol.id);
    expect(ctrl.getLayer(vol.id)!.zIndex).toBeGreaterThan(ctrl.getLayer(main.id)!.zIndex);
  });

  it('normalize remaps bind group ids after chart.host split', () => {
    const preset = normalizeLayoutPreset({
      version: LAYER_PRESET_VERSION,
      id: 'g-test',
      name: 'test',
      author: 'integrator',
      pages: [{ id: 'page-1', title: '圖表' }],
      layers: [
        {
          id: 'layer-chartHost',
          pageId: 'page-1',
          type: 'chart.host',
          widgetKey: 'chartHost',
          frame: { x: 0.1, y: 0.1, w: 0.5, h: 0.4 },
          zIndex: 2,
          visible: true,
          locked: false,
        },
      ],
      groups: [{ id: 'grp-1', layerIds: ['layer-chartHost'] }],
    });
    const grp = preset.groups[0]!;
    expect(grp.layerIds).toContain('layer-chartHost-main');
    expect(grp.layerIds).toContain('layer-chartHost-volume');
    expect(grp.layerIds).not.toContain('layer-chartHost');
  });

  it('upgradeIndicatorHostType rewrites type and widgetKey', () => {
    const layers = upgradeIndicatorHostType([
      {
        id: 'x',
        pageId: 'p',
        type: 'chart.indicatorHost',
        widgetKey: 'indicatorHost',
        frame: { x: 0, y: 0, w: 0.5, h: 0.2 },
        zIndex: 1,
        visible: true,
        locked: false,
      },
    ]);
    expect(layers[0]!.type).toBe('chart.indicator');
    expect(layers[0]!.widgetKey).toBe('chartIndicator');
  });
});