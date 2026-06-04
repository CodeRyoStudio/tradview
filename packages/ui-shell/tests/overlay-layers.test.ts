import { describe, expect, it } from 'vitest';
import { layoutSchemaToPreset } from '../src/layer/grid-to-preset.js';
import { normalizeLayoutPreset } from '../src/layer/normalize.js';
import {
  ensureOverlayLayers,
  isOverlayLayerType,
  syncAllOverlayLayersToMain,
  syncOverlayLayersToMain,
} from '../src/layer/overlay-mount.js';
import { LayerController } from '../src/layer/layer-controller.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';

describe('overlay layers (P3)', () => {
  it('grid migration includes legend and drawing overlays', () => {
    const preset = layoutSchemaToPreset();
    expect(preset.layers.some((l) => l.type === 'overlay.crosshairLegend')).toBe(true);
    expect(preset.layers.some((l) => l.type === 'overlay.drawing')).toBe(true);
  });

  it('normalize ensures overlays per page', () => {
    const preset = normalizeLayoutPreset({
      ...VENDOR_DEFAULT_PRESET,
      layers: VENDOR_DEFAULT_PRESET.layers.filter(
        (l) => !l.type.startsWith('overlay.'),
      ),
    });
    expect(preset.layers.some((l) => l.type === 'overlay.drawing')).toBe(true);
    expect(preset.layers.some((l) => l.type === 'overlay.crosshairLegend')).toBe(true);
    for (const page of preset.pages) {
      expect(
        preset.layers.some(
          (l) => l.type === 'overlay.drawing' && l.pageId === page.id,
        ),
      ).toBe(true);
      expect(
        preset.layers.some(
          (l) => l.type === 'overlay.crosshairLegend' && l.pageId === page.id,
        ),
      ).toBe(true);
    }
  });

  it('syncOverlayLayersToMain tracks chart.main frame on one page', () => {
    const layers = cloneLayoutPreset(VENDOR_DEFAULT_PRESET).layers;
    const main = layers.find((l) => l.type === 'chart.main' && l.pageId === 'page-1')!;
    main.frame = { x: 0.1, y: 0.2, w: 0.5, h: 0.4 };
    syncOverlayLayersToMain(layers, 'page-1');
    const drawing = layers.find(
      (l) => l.type === 'overlay.drawing' && l.pageId === 'page-1',
    )!;
    const legend = layers.find(
      (l) => l.type === 'overlay.crosshairLegend' && l.pageId === 'page-1',
    )!;
    expect(drawing.frame.x).toBeCloseTo(0.1);
    expect(drawing.frame.w).toBeCloseTo(0.5);
    expect(legend.frame.w).toBeCloseTo(0.35);
    expect(legend.frame.h).toBeCloseTo(0.1);
  });

  it('syncOverlayLayersToMain is scoped per page (no cross-page contamination)', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const main1x = ctrl
      .getLayersForActivePage()
      .find((l) => l.type === 'chart.main')!.frame.x;
    const page2 = ctrl.addPage('Page 2');
    const main2 = ctrl
      .getPreset()
      .layers.find((l) => l.type === 'chart.main' && l.pageId === page2)!;

    ctrl.setLayerFrame(main2.id, { x: 0.5, y: 0.5, w: 0.3, h: 0.25 });

    const preset = ctrl.getPreset();
    const draw2 = preset.layers.find(
      (l) => l.type === 'overlay.drawing' && l.pageId === page2,
    )!;
    const draw1 = preset.layers.find(
      (l) => l.type === 'overlay.drawing' && l.pageId === 'page-1',
    )!;
    expect(draw2.frame.x).toBeCloseTo(0.5);
    expect(draw1.frame.x).toBeCloseTo(main1x);
    expect(draw1.frame.x).not.toBeCloseTo(0.5);
  });

  it('moving chart.main updates overlays on the same page', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const main = ctrl.getLayersForActivePage().find((l) => l.type === 'chart.main')!;
    ctrl.setLayerFrame(main.id, { x: 0.15, y: 0.1, w: 0.55, h: 0.45 });
    const drawing = ctrl.getLayersForActivePage().find((l) => l.type === 'overlay.drawing')!;
    const legend = ctrl
      .getLayersForActivePage()
      .find((l) => l.type === 'overlay.crosshairLegend')!;
    expect(drawing!.frame.x).toBeCloseTo(0.15);
    expect(drawing!.frame.h).toBeCloseTo(0.45);
    expect(legend!.frame.w).toBeCloseTo(0.35);
    expect(legend!.frame.h).toBeCloseTo(0.1);
  });

  it('moveLayers on chart.main updates overlays', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const main = ctrl.getLayersForActivePage().find((l) => l.type === 'chart.main')!;
    const y0 = main.frame.y;
    ctrl.moveLayers([main.id], 0, 0.05);
    const drawing = ctrl.getLayersForActivePage().find((l) => l.type === 'overlay.drawing')!;
    expect(drawing!.frame.y).toBeCloseTo(y0 + 0.05);
  });

  it('moving overlay.drawing updates chart.main', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const drawing = ctrl.getLayersForActivePage().find((l) => l.type === 'overlay.drawing')!;
    ctrl.setLayerFrame(drawing.id, { x: 0.2, y: 0.15, w: 0.6, h: 0.35 });
    const main = ctrl.getLayersForActivePage().find((l) => l.type === 'chart.main')!;
    expect(main!.frame.x).toBeCloseTo(0.2);
    expect(main!.frame.h).toBeCloseTo(0.35);
  });

  it('isOverlayLayerType identifies overlay types', () => {
    expect(isOverlayLayerType('overlay.crosshairLegend')).toBe(true);
    expect(isOverlayLayerType('overlay.drawing')).toBe(true);
    expect(isOverlayLayerType('chart.main')).toBe(false);
  });

  it('ensureOverlayLayers adds both overlays and applies legend caps', () => {
    const pageId = 'page-2';
    const layers = ensureOverlayLayers(
      [
        {
          id: 'm',
          pageId,
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0.1, y: 0.2, w: 0.8, h: 0.5 },
          zIndex: 1,
          visible: true,
          locked: false,
        },
      ],
      pageId,
    );
    const pageLayers = layers.filter((l) => l.pageId === pageId);
    expect(pageLayers.some((l) => l.type === 'overlay.drawing')).toBe(true);
    expect(pageLayers.some((l) => l.type === 'overlay.crosshairLegend')).toBe(true);
    const legend = pageLayers.find((l) => l.type === 'overlay.crosshairLegend')!;
    expect(legend.frame.w).toBeCloseTo(0.35);
    expect(legend.frame.h).toBeCloseTo(0.1);
  });

  it('addPage clones overlays with distinct ids', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const page2 = ctrl.addPage('Clone');
    const page2Layers = ctrl.getLayersForActivePage();
    expect(page2Layers.some((l) => l.type === 'overlay.drawing')).toBe(true);
    expect(page2Layers.some((l) => l.type === 'overlay.crosshairLegend')).toBe(true);
    expect(page2Layers.every((l) => l.pageId === page2)).toBe(true);
    expect(page2Layers.every((l) => !l.groupId)).toBe(true);
    ctrl.setActivePage('page-1');
    const page1Draw = ctrl
      .getLayersForActivePage()
      .find((l) => l.type === 'overlay.drawing')!;
    const page2Draw = ctrl
      .getPreset()
      .layers.find((l) => l.type === 'overlay.drawing' && l.pageId === page2)!;
    expect(page1Draw.id).not.toBe(page2Draw.id);
  });

  it('syncAllOverlayLayersToMain updates overlays on each page', () => {
    let layers = cloneLayoutPreset(VENDOR_DEFAULT_PRESET).layers;
    layers = ensureOverlayLayers(
      [
        ...layers,
        {
          id: 'main-p2',
          pageId: 'page-2',
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0.2, y: 0.3, w: 0.4, h: 0.3 },
          zIndex: 1,
          visible: true,
          locked: false,
        },
      ],
      'page-2',
    );
    const main2 = layers.find((l) => l.type === 'chart.main' && l.pageId === 'page-2')!;
    main2.frame = { x: 0.6, y: 0.1, w: 0.2, h: 0.2 };
    syncAllOverlayLayersToMain(layers);
    const draw2 = layers.find(
      (l) => l.type === 'overlay.drawing' && l.pageId === 'page-2',
    )!;
    expect(draw2.frame.x).toBeCloseTo(0.6);
  });
});