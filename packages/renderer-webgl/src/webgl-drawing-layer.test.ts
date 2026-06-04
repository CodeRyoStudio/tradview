import { describe, expect, it, afterEach } from 'vitest';
import { ChartViewport } from './chart-viewport.js';
import { WebGLDrawingLayer } from './webgl-drawing-layer.js';

describe('WebGLDrawingLayer', () => {
  const hosts: HTMLElement[] = [];

  afterEach(() => {
    for (const el of hosts) el.remove();
    hosts.length = 0;
  });

  it('creates overlay canvas and defaults to cursor tool', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    hosts.push(parent);
    const interaction = document.createElement('canvas');
    parent.appendChild(interaction);

    const vp = new ChartViewport();
    vp.setBarCount(10);

    const layer = new WebGLDrawingLayer({
      parent,
      interactionHost: interaction,
      chartId: 'test',
      symbol: 'SYM',
      interval: '1h',
      getViewport: () => vp,
      getBars: () => [],
      getLayout: () => ({
        canvasWidth: 400,
        canvasHeight: 300,
        mainPaneHeight: 220,
        cssWidth: 400,
      }),
    });

    expect(layer.getTool()).toBe('cursor');
    expect(parent.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(1);
    layer.destroy();
  });
});