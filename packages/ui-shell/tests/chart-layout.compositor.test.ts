import { describe, expect, it } from 'vitest';
import { mountChartLayout } from '../src/chart-layout.js';
import { syncCompositorShellVisibilityFromFeatures } from '../src/layer/compositor-shell-sync.js';
import { LayerController } from '../src/layer/layer-controller.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';

describe('mountChartLayout compositor mode (P5)', () => {
  it('uses compositor shell instead of legacy grid', () => {
    const root = document.createElement('div');
    const layout = mountChartLayout(root, {
      layerCompositorManaged: true,
      showTopBar: true,
    });
    expect(root.querySelector('.tv-layout-root--compositor')).toBeTruthy();
    expect(root.querySelector('.tv-compositor-shell-grid')).toBeTruthy();
    expect(root.querySelector('.tv-layout-grid')).toBeFalsy();
    expect(layout.syncCompositorShellVisibility).toBeTypeOf('function');
    expect(layout.bindLayerCompositorController).toBeTypeOf('function');
  });

  it('setLayoutFeatures syncs compositor shell when controller is bound', () => {
    const root = document.createElement('div');
    const layout = mountChartLayout(root, {
      layerCompositorManaged: true,
      showTopBar: true,
      showCrosshairLegend: true,
    });
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    layout.bindLayerCompositorController?.(ctrl);
    const topBarBefore = ctrl
      .getLayersForActivePage()
      .find((l) => l.widgetKey === 'topBar');
    expect(topBarBefore?.visible).toBe(true);

    layout.setLayoutFeatures({ showTopBar: false, showCrosshairLegend: false });
    const layers = ctrl.getLayersForActivePage();
    expect(layers.find((l) => l.widgetKey === 'topBar')?.visible).toBe(false);
    expect(layers.find((l) => l.type === 'overlay.crosshairLegend')?.visible).toBe(false);
  });

  it('syncCompositorShellVisibilityFromFeatures maps layout features', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    syncCompositorShellVisibilityFromFeatures(ctrl, {
      showTopBar: false,
      showLeftToolbar: true,
      showBottomToolbar: false,
      showCrosshairLegend: false,
      showStatusBar: true,
      showPropertiesPanel: false,
      showContextMenu: false,
      showSettings: false,
      showShortcuts: false,
      symbolInput: 'manual',
    });
    const layers = ctrl.getLayersForActivePage();
    const topBar = layers.find((l) => l.widgetKey === 'topBar');
    const legend = layers.find((l) => l.type === 'overlay.crosshairLegend');
    const drawing = layers.find((l) => l.type === 'overlay.drawing');
    expect(topBar?.visible).toBe(false);
    expect(legend?.visible).toBe(false);
    expect(drawing?.visible).toBe(true);
  });
});