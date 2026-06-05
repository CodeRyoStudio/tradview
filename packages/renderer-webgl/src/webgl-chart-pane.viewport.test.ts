import { describe, expect, it } from 'vitest';
import { hasWebGL2 } from './webgl2-context.js';
import { WebGLChartPane } from './webgl-chart-pane.js';

const describeWebGL = describe.skipIf(!hasWebGL2());

function sampleBars(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    t: i * 60_000,
    o: 100 + i,
    h: 102 + i,
    l: 99 + i,
    c: 101 + i,
    v: 500,
  }));
}

describeWebGL('WebGLChartPane viewport', () => {
  it('setData preserves pan after initial fit', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const pane = new WebGLChartPane(root);
    pane.resize(640, 360);
    pane.setData(sampleBars(40), { fitViewport: true });
    const before = pane.viewport.visibleFrom;
    pane.viewport.pan(-5);
    expect(pane.viewport.visibleFrom).toBeLessThan(before);
    const pannedFrom = pane.viewport.visibleFrom;
    pane.setData(sampleBars(41));
    expect(pane.viewport.visibleFrom).toBeCloseTo(pannedFrom, 5);
    pane.destroy();
    root.remove();
  });
});