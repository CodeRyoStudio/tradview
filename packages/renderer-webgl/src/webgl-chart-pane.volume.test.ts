import { describe, expect, it } from 'vitest';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { hasWebGL2 } from './webgl2-context.js';
import { WebGLChartPane } from './webgl-chart-pane.js';

const describeWebGL = describe.skipIf(!hasWebGL2());

describeWebGL('WebGLChartPane volume visibility', () => {
  it('showGrid false still exposes scale overlay canvas', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const pane = new WebGLChartPane(root);
    pane.setShowGrid(false);
    pane.resize(640, 400);
    expect(pane.getScaleOverlayCanvas()).toBeInstanceOf(HTMLCanvasElement);
    pane.destroy();
    root.remove();
  });

  it('showVolume false uses full canvas height for main pane', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const pane = new WebGLChartPane(root);
    pane.resize(640, 400);
    pane.setIndicatorConfig({ ...DEFAULT_INDICATOR_CONFIG, showVolume: false });
    pane.setData([
      { t: 1, o: 100, h: 105, l: 98, c: 103, v: 1000 },
      { t: 2, o: 103, h: 106, l: 101, c: 102, v: 800 },
    ]);
    const layout = (
      pane as unknown as { getScaleLayoutCss: () => { mainPaneHeight: number; volumeBandTop?: number } }
    ).getScaleLayoutCss();
    expect(layout.mainPaneHeight).toBe(400);
    expect(layout.volumeBandTop).toBeUndefined();
    pane.destroy();
    root.remove();
  });
});