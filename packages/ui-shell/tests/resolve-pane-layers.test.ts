import { describe, expect, it } from 'vitest';
import {
  isValidBridgeLayerPane,
  layerTypeForBridgePane,
  resolvePaneLayerIds,
} from '../src/layer/resolve-pane-layers.js';
import { normalizeLayoutPreset } from '../src/layer/normalize.js';

describe('resolvePaneLayerIds', () => {
  const preset = normalizeLayoutPreset({
    version: 2,
    revision: 1,
    id: 't',
    name: 'T',
    author: 'integrator',
    pages: [
      { id: 'page-1', title: 'One' },
      { id: 'page-2', title: 'Two' },
    ],
    layers: [
      {
        id: 'm1',
        pageId: 'page-1',
        type: 'chart.main',
        widgetKey: 'chartMain',
        frame: { x: 0, y: 0, w: 1, h: 0.7 },
        zIndex: 0,
        visible: true,
        locked: false,
      },
      {
        id: 'm2',
        pageId: 'page-2',
        type: 'chart.main',
        widgetKey: 'chartMain',
        frame: { x: 0, y: 0, w: 1, h: 0.7 },
        zIndex: 0,
        visible: true,
        locked: false,
      },
    ],
    groups: [],
  });

  it('isValidBridgeLayerPane guards pane strings', () => {
    expect(isValidBridgeLayerPane('main')).toBe(true);
    expect(isValidBridgeLayerPane('bad')).toBe(false);
  });

  it('layerTypeForBridgePane maps to chart layer types', () => {
    expect(layerTypeForBridgePane('volume')).toBe('chart.volume');
  });

  it('allPages returns main layer ids on every page', () => {
    expect(resolvePaneLayerIds(preset, 'main', { allPages: true }).sort()).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('active page scope returns single page layer', () => {
    expect(resolvePaneLayerIds(preset, 'main', { activePageId: 'page-2' })).toEqual(['m2']);
  });
});