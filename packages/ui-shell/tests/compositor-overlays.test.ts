import { describe, expect, it, vi } from 'vitest';
import { mountLayerCompositor } from '../src/layer/compositor.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import type { LayerWidgetKey } from '../src/layer/types.js';

function mountTestCompositor() {
  const parent = document.createElement('div');
  parent.style.cssText = 'position:relative;width:800px;height:600px;';
  document.body.appendChild(parent);

  const preset = cloneLayoutPreset(VENDOR_DEFAULT_PRESET);
  const widgets: Partial<Record<LayerWidgetKey, HTMLElement>> = {};
  for (const layer of preset.layers) {
    if (!widgets[layer.widgetKey as LayerWidgetKey]) {
      widgets[layer.widgetKey as LayerWidgetKey] = document.createElement('div');
    }
  }

  const compositor = mountLayerCompositor(parent, { preset, widgets });
  return { parent, compositor };
}

describe('mountLayerCompositor overlays & pages', () => {
  it('mounts legend wrap but not drawing wrap', () => {
    const { compositor } = mountTestCompositor();
    expect(
      compositor.root.querySelector('[data-layer-type="overlay.crosshairLegend"]'),
    ).toBeTruthy();
    expect(
      compositor.root.querySelector('[data-layer-type="overlay.drawing"]'),
    ).toBeFalsy();
  });

  it('enables root pointer-events in layer edit mode', () => {
    const { compositor } = mountTestCompositor();
    expect(compositor.root.style.pointerEvents).toBe('none');
    compositor.enableLayerEditor(true);
    expect(compositor.root.style.pointerEvents).toBe('auto');
  });

  it('filters mounted layers by active page', () => {
    const { compositor } = mountTestCompositor();
    const page2 = compositor.controller.addPage('Page 2');
    const countPage1 = compositor.root.querySelectorAll('.tv-layer-wrap').length;
    compositor.controller.setActivePage(page2);
    compositor.apply();
    const countPage2 = compositor.root.querySelectorAll('.tv-layer-wrap').length;
    expect(countPage2).toBeGreaterThan(0);
    compositor.controller.setActivePage('page-1');
    compositor.apply();
    expect(compositor.root.querySelectorAll('.tv-layer-wrap').length).toBe(countPage1);
  });

  it('rebuilds when legend visibility toggles', () => {
    const onPresetChange = vi.fn();
    const parent = document.createElement('div');
    parent.style.cssText = 'position:relative;width:400px;height:300px;';
    const preset = cloneLayoutPreset(VENDOR_DEFAULT_PRESET);
    const widgets: Partial<Record<LayerWidgetKey, HTMLElement>> = {
      crosshairLegend: document.createElement('div'),
      chartMain: document.createElement('div'),
      chartVolume: document.createElement('div'),
      topBar: document.createElement('div'),
    };
    const compositor = mountLayerCompositor(parent, {
      preset,
      widgets,
      onPresetChange,
    });
    const legend = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.type === 'overlay.crosshairLegend')!;
    compositor.controller.setLayerVisible(legend.id, false);
    expect(
      compositor.root.querySelector('[data-layer-type="overlay.crosshairLegend"]'),
    ).toBeFalsy();
  });
});