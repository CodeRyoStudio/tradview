import { describe, expect, it, vi } from 'vitest';
import { ChartViewport } from '../chart-viewport.js';
import { applyScaleWheel, ScaleInteraction } from './scale-interaction.js';

describe('ScaleInteraction handlers', () => {
  it('dbl-click on price axis clears override via callback', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }) as DOMRect;
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    const cleared: Array<{ min: number; max: number } | null> = [];
    const interaction = new ScaleInteraction(el, {
      viewport: vp,
      getLayout: () => ({ cssWidth: 800, cssHeight: 400, mainPaneHeight: 300 }),
      callbacks: {
        requestRender: vi.fn(),
        getAutoPriceRange: () => ({ min: 0, max: 100 }),
        getPriceRangeOverride: () => ({ min: 1, max: 50 }),
        onPriceRangeOverride: (band, r) => {
          if (band === 'price') cleared.push(r);
        },
      },
    });
    el.dispatchEvent(
      new MouseEvent('dblclick', { clientX: 760, clientY: 100, bubbles: true }),
    );
    expect(cleared).toContain(null);
    interaction.destroy();
  });

  it('wheel handler path updates price override (applyScaleWheel)', () => {
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    let override: { min: number; max: number } | null = null;
    applyScaleWheel(vp, {
      viewport: vp,
      getLayout: () => ({ cssWidth: 800, cssHeight: 400, mainPaneHeight: 300 }),
      callbacks: {
        requestRender: vi.fn(),
        getAutoPriceRange: () => ({ min: 0, max: 100 }),
        getPriceRangeOverride: () => override,
        onPriceRangeOverride: (_b, r) => {
          override = r;
        },
      },
    }, {
      region: 'price-axis',
      deltaY: 100,
      anchorPlotX: 350,
      plotWidthCss: vp.plotWidthPx(800),
    });
    expect(override).not.toBeNull();
  });

  it('dbl-click on time axis calls fitLatest', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }) as DOMRect;
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    vp.setBarCount(200);
    vp.setVisibleRange(50, 100);
    const fromBefore = vp.visibleFrom;
    const interaction = new ScaleInteraction(el, {
      viewport: vp,
      getLayout: () => ({ cssWidth: 800, cssHeight: 400, mainPaneHeight: 300 }),
      callbacks: {
        requestRender: vi.fn(),
        getAutoPriceRange: () => ({ min: 0, max: 100 }),
        getPriceRangeOverride: () => null,
        onPriceRangeOverride: () => {},
      },
    });
    el.dispatchEvent(
      new MouseEvent('dblclick', { clientX: 400, clientY: 392, bubbles: true }),
    );
    expect(vp.visibleFrom).not.toBe(fromBefore);
    interaction.destroy();
  });

  it('time-axis drag pans viewport', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }) as DOMRect;
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    vp.setBarCount(200);
    vp.setVisibleRange(40, 80);
    const fromBefore = vp.visibleFrom;
    const interaction = new ScaleInteraction(el, {
      viewport: vp,
      getLayout: () => ({ cssWidth: 800, cssHeight: 400, mainPaneHeight: 300 }),
      callbacks: {
        requestRender: vi.fn(),
        getAutoPriceRange: () => ({ min: 0, max: 1 }),
        getPriceRangeOverride: () => null,
        onPriceRangeOverride: () => {},
      },
    });
    el.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 200, clientY: 392, button: 0, bubbles: true }),
    );
    el.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 320, clientY: 392, button: 0, bubbles: true }),
    );
    expect(vp.visibleFrom).not.toBeCloseTo(fromBefore, 3);
    interaction.destroy();
  });

  it('applyScaleWheel skips time axis when enableTimeInteraction is false', () => {
    const vp = new ChartViewport();
    let called = false;
    applyScaleWheel(
      vp,
      {
        viewport: vp,
        getLayout: () => ({ cssWidth: 800, cssHeight: 400, mainPaneHeight: 300 }),
        enableTimeInteraction: () => false,
        callbacks: {
          requestRender: () => {
            called = true;
          },
          getAutoPriceRange: () => ({ min: 0, max: 1 }),
          getPriceRangeOverride: () => null,
          onPriceRangeOverride: () => {},
        },
      },
      {
        region: 'time-axis',
        deltaY: 100,
        anchorPlotX: 100,
        plotWidthCss: 700,
      },
    );
    expect(called).toBe(false);
  });
});