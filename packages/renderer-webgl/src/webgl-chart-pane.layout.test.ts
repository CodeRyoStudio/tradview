import { afterEach, describe, expect, it } from 'vitest';
import { WebGLChartPane } from './webgl-chart-pane.js';

describe('WebGLChartPane getLayoutMetrics', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  it('cssWidth prefers clientWidth over device canvas.width when pane width unset', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '300px';
    document.body.appendChild(container);
    roots.push(container);

    const pane = new WebGLChartPane(container);
    const canvas = pane.getChartCanvas();
    canvas.width = 800;
    canvas.height = 600;
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 300 });

    const metrics = pane.getLayoutMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics!.cssWidth).toBe(400);
    expect(metrics!.canvasWidth).toBe(800);
    pane.destroy();
  });
});