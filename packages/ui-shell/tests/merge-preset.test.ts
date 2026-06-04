import { describe, expect, it } from 'vitest';
import { mergeLayoutPreset } from '../src/layer/merge-preset.js';
import { normalizeLayoutPreset } from '../src/layer/normalize.js';
import { LayerController } from '../src/layer/layer-controller.js';

describe('mergeLayoutPreset', () => {
  it('upserts pages and layers by id while preserving unmentioned entries', () => {
    const base = normalizeLayoutPreset({
      version: 2,
      revision: 2,
      id: 'base',
      name: 'Base',
      author: 'integrator',
      pages: [
        { id: 'page-1', title: 'One' },
        { id: 'page-2', title: 'Two' },
      ],
      layers: [
        {
          id: 'keep',
          pageId: 'page-1',
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0, y: 0, w: 1, h: 0.7 },
          zIndex: 0,
          visible: true,
          locked: false,
        },
        {
          id: 'gone-page2',
          pageId: 'page-2',
          type: 'chart.volume',
          widgetKey: 'chartVolume',
          frame: { x: 0, y: 0.7, w: 1, h: 0.3 },
          zIndex: 1,
          visible: true,
          locked: false,
        },
      ],
      groups: [{ id: 'g1', layerIds: ['keep'] }],
    });

    const merged = mergeLayoutPreset(base, {
      version: 2,
      revision: 4,
      id: 'base',
      name: 'Base',
      author: 'integrator',
      pages: [{ id: 'page-3', title: 'Three' }],
      layers: [
        {
          id: 'new-main',
          pageId: 'page-3',
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0, y: 0, w: 1, h: 1 },
          zIndex: 0,
          visible: true,
          locked: false,
        },
      ],
      groups: [],
    });

    expect(merged.pages.map((p) => p.id).sort()).toEqual(['page-1', 'page-2', 'page-3']);
    expect(merged.layers.some((l) => l.id === 'keep')).toBe(true);
    expect(merged.layers.some((l) => l.id === 'gone-page2')).toBe(true);
    expect(merged.layers.some((l) => l.id === 'new-main')).toBe(true);
    expect(merged.revision).toBe(4);
  });

  it('normalizeLayoutPreset defaults revision to 1', () => {
    const preset = normalizeLayoutPreset({
      version: 2,
      id: 'r',
      name: 'R',
      author: 'integrator',
      pages: [{ id: 'page-1', title: 'P' }],
      layers: [],
      groups: [],
    });
    expect(preset.revision).toBe(1);
  });

  it('mergeLayoutPreset upserts groups by id', () => {
    const base = normalizeLayoutPreset({
      version: 2,
      revision: 1,
      id: 'base',
      name: 'Base',
      author: 'integrator',
      pages: [{ id: 'page-1', title: 'One' }],
      layers: [
        {
          id: 'layer-a',
          pageId: 'page-1',
          type: 'chart.main',
          widgetKey: 'chartMain',
          frame: { x: 0, y: 0, w: 1, h: 1 },
          zIndex: 0,
          visible: true,
          locked: false,
        },
        {
          id: 'layer-b',
          pageId: 'page-1',
          type: 'chart.volume',
          widgetKey: 'chartVolume',
          frame: { x: 0, y: 0.7, w: 1, h: 0.3 },
          zIndex: 1,
          visible: true,
          locked: false,
        },
      ],
      groups: [{ id: 'g1', layerIds: ['layer-a'] }],
    });
    const merged = mergeLayoutPreset(base, {
      version: 2,
      revision: 2,
      id: 'base',
      name: 'Base',
      author: 'integrator',
      pages: [],
      layers: [],
      groups: [{ id: 'g2', layerIds: ['layer-b'] }],
    });
    expect(merged.groups.map((g) => g.id).sort()).toEqual(['g1', 'g2']);
  });

  it('LayerController tracks presetRevision from preset', () => {
    const preset = normalizeLayoutPreset({
      version: 2,
      revision: 7,
      id: 'r',
      name: 'R',
      author: 'integrator',
      pages: [{ id: 'page-1', title: 'P' }],
      layers: [],
      groups: [],
    });
    const ctrl = new LayerController(preset);
    expect(ctrl.presetRevision).toBe(7);
    ctrl.setPreset({ ...preset, revision: 9 });
    expect(ctrl.presetRevision).toBe(9);
  });
});