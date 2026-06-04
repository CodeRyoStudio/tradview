import { describe, expect, it } from 'vitest';
import { createLayoutGrid } from '../src/layout-engine.js';
import { DEFAULT_LAYOUT_SCHEMA } from '../src/layout-schema.js';
import { DEFAULT_LAYOUT_FEATURES } from '../src/layout-features.js';

describe('createLayoutGrid', () => {
  it('mounts widgets into grid cells with default schema', () => {
    const chartHost = document.createElement('div');
    chartHost.id = 'chart';
    const grid = createLayoutGrid({
      schema: DEFAULT_LAYOUT_SCHEMA,
      features: { ...DEFAULT_LAYOUT_FEATURES, showTopBar: true, showLeftToolbar: true },
      widgets: {
        topBar: document.createElement('div'),
        leftToolbar: document.createElement('aside'),
        bottomToolbar: document.createElement('div'),
        chartHost,
        indicatorHost: document.createElement('div'),
        statusBar: document.createElement('div'),
        propertiesPanel: document.createElement('div'),
      },
    });
    document.body.appendChild(grid.root);
    expect(grid.cells.get('chartHost')?.contains(chartHost)).toBe(true);
    expect(getComputedStyle(grid.grid).display).toBe('grid');
    grid.root.remove();
  });
});