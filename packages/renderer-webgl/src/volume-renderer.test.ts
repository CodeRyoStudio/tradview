import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bar } from '@coderyo/data';
import { ChartViewport } from './chart-viewport.js';
import { SolidBatchRenderer } from './solid-batch.js';
import { DEFAULT_CHART_THEME } from './theme.js';
import { VolumeRenderer } from './volume-renderer.js';

/** Bar quad uses stride-6 verts; y at indices 1 and 13 (y0, y1). */
function quadHeight(verts: Float32Array): number {
  return Math.abs(verts[13]! - verts[1]!);
}

describe('VolumeRenderer volumeRange', () => {
  const roots: HTMLCanvasElement[] = [];
  let drawSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    drawSpy?.mockRestore();
    for (const c of roots) c.remove();
    roots.length = 0;
  });

  it('scales bar height from effective volumeRange.max, not auto max only', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    roots.push(canvas);
    const gl = canvas.getContext('webgl2')!;
    const renderer = new VolumeRenderer(gl);

    const captured: Float32Array[] = [];
    drawSpy = vi.spyOn(SolidBatchRenderer.prototype, 'draw').mockImplementation((verts) => {
      captured.push(new Float32Array(verts));
    });

    const bars: Bar[] = [{ t: 0, o: 1, h: 1, l: 1, c: 1, v: 100 }];
    const vp = new ChartViewport({ rightPaddingPx: 0 });
    vp.setBarCount(1);
    vp.setVisibleRange(0, 0);
    const pane = { left: 0, top: 100, width: 400, height: 80 };
    const base = {
      bars,
      viewport: vp,
      plotWidthPx: 400,
      pane,
      resolution: [400, 200] as [number, number],
      theme: DEFAULT_CHART_THEME,
      cssWidth: 400,
      dpr: 1,
    };

    renderer.render({ ...base, volumeRange: { min: 0, max: 200 } });
    const hWideScale = quadHeight(captured[0]!);

    captured.length = 0;
    renderer.render({ ...base, volumeRange: { min: 0, max: 50 } });
    const hTightScale = quadHeight(captured[0]!);

    expect(captured.length).toBeGreaterThan(0);
    expect(hTightScale).toBeGreaterThan(hWideScale);
    expect(hWideScale / hTightScale).toBeCloseTo(0.25, 2);
  });
});