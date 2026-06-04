import { describe, expect, it, vi } from 'vitest';
import type { Bar } from '@coderyo/data';
import { installWebGL2TestContext } from '@coderyo/renderer-webgl';

installWebGL2TestContext();

const sampleBar: Bar = { t: 42_000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };

describe('WebGLChartRenderBackend setCrosshair → clearCrosshair (review #1)', () => {
  it('clearCrosshair emits null after programmatic setCrosshair', async () => {
    const { WebGLChartRenderBackend } = await import('../src/chart-renderer-webgl.js');
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const handler = vi.fn();
    const backend = new WebGLChartRenderBackend(el);
    backend.subscribeCrosshair(handler);
    backend.setBars([sampleBar]);
    backend.setCrosshair({ timeMs: 42_000, price: 1.5 });

    expect(handler.mock.calls.some((c) => c[0]?.time === 42_000)).toBe(true);

    handler.mockClear();
    backend.clearCrosshair();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(null);

    backend.destroy();
    el.remove();
  });
});