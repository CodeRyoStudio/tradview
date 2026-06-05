import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import type { Bar } from '@coderyo/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChartViewport } from './chart-viewport.js';
import { ViewportSyncBus } from './viewport-sync-bus.js';
import { WebGLVolumePane } from './webgl-volume-pane.js';
import { hasWebGL2 } from './webgl2-context.js';

function makeBars(count: number): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    t: i * 60_000,
    o: 50,
    h: 55,
    l: 45,
    c: 52,
    v: 1000 + i,
  }));
}

const describeWebGL = describe.skipIf(!hasWebGL2());

describeWebGL('WebGLVolumePane sync follower', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  it('ignores plot time pan when syncBus is attached', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '120px';
    document.body.appendChild(container);
    roots.push(container);

    const master = new ChartViewport({ rightPaddingPx: 0 });
    master.setBarCount(100);
    master.setVisibleRange(20, 60);
    const bus = new ViewportSyncBus(master);

    const pane = new WebGLVolumePane(container, { syncBus: bus });
    pane.resize(400, 120);
    pane.setData(makeBars(100), DEFAULT_INDICATOR_CONFIG);
    bus.propagate();

    const fromBefore = pane.viewport.visibleFrom;
    const canvas = container.querySelector('canvas')!;

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 40,
        clientY: 40,
        button: 0,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 320,
        clientY: 40,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 320,
        clientY: 40,
        button: 0,
      }),
    );

    expect(pane.viewport.visibleFrom).toBeCloseTo(fromBefore, 8);
    expect(pane.viewport.visibleFrom).toBeCloseTo(master.visibleFrom, 8);
    pane.destroy();
  });

  it('allows vertical price pan on volume plot when synced', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '120px';
    document.body.appendChild(container);
    roots.push(container);

    const master = new ChartViewport({ rightPaddingPx: 0 });
    master.setBarCount(50);
    master.setVisibleRange(0, 40);
    const bus = new ViewportSyncBus(master);

    const pane = new WebGLVolumePane(container, { syncBus: bus });
    pane.resize(400, 120);
    pane.setData(makeBars(50), DEFAULT_INDICATOR_CONFIG);
    bus.propagate();

    const scaleHost = (pane as unknown as { scaleHost: { panPriceRange: (...a: unknown[]) => void } })
      .scaleHost;
    const panSpy = vi.spyOn(scaleHost, 'panPriceRange');

    const canvas = container.querySelector('canvas')!;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }) as DOMRect;

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 100,
        clientY: 50,
        button: 0,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 100,
        clientY: 80,
        button: 0,
      }),
    );

    expect(panSpy).toHaveBeenCalledWith('volume', expect.any(Number), expect.any(Number));
    pane.destroy();
  });
});