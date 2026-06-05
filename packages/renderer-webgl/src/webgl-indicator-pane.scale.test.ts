import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import type { Bar } from '@coderyo/data';
import { afterEach, describe, expect, it } from 'vitest';
import { hasWebGL2 } from './webgl2-context.js';
import { WebGLIndicatorPane } from './webgl-indicator-pane.js';

const describeWebGL = describe.skipIf(!hasWebGL2());

function makeBars(count: number): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    t: i * 60_000,
    o: 50,
    h: 55,
    l: 45,
    c: 52,
    v: 10,
  }));
}

describeWebGL('WebGLIndicatorPane independent price axis', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  for (const paneId of ['macd', 'rsi', 'kdj'] as const) {
    it(`${paneId} mounts scale overlay canvas`, () => {
      const container = document.createElement('div');
      container.style.width = '400px';
      container.style.height = '80px';
      document.body.appendChild(container);
      roots.push(container);

      const cfg = {
        ...DEFAULT_INDICATOR_CONFIG,
        showMacd: paneId === 'macd',
        showRsi: paneId === 'rsi',
        showKdj: paneId === 'kdj',
      };
      const pane = new WebGLIndicatorPane(container, { paneId, label: paneId.toUpperCase() });
      pane.resize(400, 80);
      pane.setBars(makeBars(120), cfg);
      pane.render();

      const overlays = container.querySelectorAll('canvas');
      expect(overlays.length).toBeGreaterThanOrEqual(2);
      pane.destroy();
    });
  }
});