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
});