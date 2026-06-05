import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import type { Bar } from '@coderyo/data';
import { afterEach, describe, expect, it } from 'vitest';
import { ChartViewport } from './chart-viewport.js';
import { ViewportSyncBus } from './viewport-sync-bus.js';
import { WebGLIndicatorPane } from './webgl-indicator-pane.js';

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

describe('WebGLIndicatorPane sync follower', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  it('ignores plot pan when syncBus is attached', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '80px';
    document.body.appendChild(container);
    roots.push(container);

    const master = new ChartViewport({ rightPaddingPx: 0 });
    master.setBarCount(100);
    master.setVisibleRange(20, 60);
    const bus = new ViewportSyncBus(master);

    const pane = new WebGLIndicatorPane(container, {
      paneId: 'rsi',
      label: 'RSI',
      syncBus: bus,
    });
    pane.resize(400, 80);
    pane.setBars(makeBars(100), DEFAULT_INDICATOR_CONFIG);
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
});