import { describe, expect, it, vi } from 'vitest';
import { ChartInteraction, resolveWheelPlotAnchor } from './chart-interaction.js';
import { ChartViewport } from './chart-viewport.js';

describe('resolveWheelPlotAnchor', () => {
  const vp = new ChartViewport({ barSpacing: 8, rightPaddingPx: 56 });

  it('returns null over the price gutter', () => {
    expect(resolveWheelPlotAnchor(vp, 780, 0, 800)).toBeNull();
  });

  it('returns plot-local anchor in the plot band', () => {
    const anchor = resolveWheelPlotAnchor(vp, 400, 0, 800);
    expect(anchor).not.toBeNull();
    expect(anchor!.plotX).toBe(400);
    expect(anchor!.plotWidthPx).toBe(vp.plotWidthPx(800));
    expect(anchor!.plotX).toBeLessThan(anchor!.plotWidthPx);
  });

  it('accepts pointer just inside the plot right edge', () => {
    const plotW = vp.plotWidthPx(800);
    const anchor = resolveWheelPlotAnchor(vp, plotW - 1, 0, 800);
    expect(anchor!.plotX).toBe(plotW - 1);
  });
});

describe('ChartInteraction', () => {
  it('registers wheel listener on mount', () => {
    const el = document.createElement('div');
    const addSpy = vi.spyOn(el, 'addEventListener');
    const vp = new ChartViewport();
    const interaction = new ChartInteraction(el, vp, () => 400, { requestRender: () => {} });
    expect(addSpy).toHaveBeenCalledWith('wheel', expect.any(Function), { passive: false });
    interaction.destroy();
  });

  it('plot drag invokes onPricePan for vertical movement', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }) as DOMRect;
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    const pricePan = vi.fn();
    const interaction = new ChartInteraction(el, vp, () => vp.plotWidthPx(800), {
      requestRender: vi.fn(),
      getPlotHeight: () => 300,
      onPricePan: pricePan,
    });
    el.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 200, clientY: 100, button: 0, bubbles: true }),
    );
    el.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, clientY: 130, button: 0, bubbles: true }),
    );
    expect(pricePan).toHaveBeenCalled();
    interaction.destroy();
  });
});