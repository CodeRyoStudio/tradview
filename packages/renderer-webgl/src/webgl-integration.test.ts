import { describe, expect, it } from 'vitest';
import { hasWebGL2 } from './webgl2-context.js';
import { WebGLChartPane } from './webgl-chart-pane.js';
import { WebGLPaneOrchestrator } from './webgl-pane-orchestrator.js';

const describeWebGL = describe.skipIf(!hasWebGL2());

describeWebGL('WebGL integration', () => {
  it('WebGLChartPane renders synthetic bars', () => {
    const root = document.createElement('div');
    root.style.width = '640px';
    root.style.height = '360px';
    document.body.appendChild(root);

    const pane = new WebGLChartPane(root, { barSpacing: 6 });
    pane.resize(640, 360);
    pane.setData([
      { t: 1, o: 100, h: 105, l: 98, c: 103, v: 1000 },
      { t: 2, o: 103, h: 106, l: 101, c: 102, v: 800 },
      { t: 3, o: 102, h: 104, l: 99, c: 100, v: 1200 },
    ]);
    expect(() => pane.render()).not.toThrow();
    pane.destroy();
    root.remove();
  });

  it('WebGLPaneOrchestrator mount/setBars/destroy lifecycle', () => {
    const root = document.createElement('div');
    root.style.width = '400px';
    root.style.height = '300px';
    document.body.appendChild(root);

    const orch = new WebGLPaneOrchestrator({ initialWidth: 400, initialHeight: 300 });
    orch.mount(root);
    orch.setBars(
      Array.from({ length: 20 }, (_, i) => ({
        t: i * 60_000,
        o: 100 + i,
        h: 102 + i,
        l: 99 + i,
        c: 101 + i,
        v: 500 + i * 10,
      })),
    );
    orch.render();
    expect(orch.getViewport()?.barCount).toBe(20);
    orch.destroy();
    root.remove();
  });
});