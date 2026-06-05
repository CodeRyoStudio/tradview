import { describe, expect, it, vi } from 'vitest';
import { ChartViewport } from '../chart-viewport.js';
import { ScaleRenderer } from './scale-renderer.js';

function mockCtx(): CanvasRenderingContext2D {
  const noop = vi.fn();
  return {
    clearRect: noop,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;
}

describe('ScaleRenderer crosshair and last price', () => {
  it('draws last-price and crosshair tags on price gutter', () => {
    const ctx = mockCtx();
    const renderer = new ScaleRenderer();
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    vp.setBarCount(50);
    vp.setVisibleRange(0, 40);

    const bars = Array.from({ length: 50 }, (_, i) => ({
      t: i * 60_000,
      c: 100 + i,
    }));

    renderer.draw(ctx, {
      deviceWidth: 800,
      deviceHeight: 400,
      cssWidth: 800,
      dpr: 1,
      viewport: vp,
      bars,
      priceBands: [{ top: 0, bottom: 340, range: { min: 90, max: 160 }, kind: 'price' }],
      lastPrice: 150,
      crosshairPrice: 120,
      crosshairTimeMs: bars[20]!.t,
    });

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    const texts = vi.mocked(ctx.fillText).mock.calls.map((c) => String(c[0]));
    expect(texts.some((t) => t.includes('150'))).toBe(true);
    expect(texts.some((t) => t.includes('120'))).toBe(true);
  });
});