import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bar } from '@coderyo/data';

const mockSetBars = vi.fn();
const mockDestroy = vi.fn();
const mockRender = vi.fn();

vi.mock('@coderyo/renderer-webgl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coderyo/renderer-webgl')>();
  return {
    ...actual,
    WebGLPaneOrchestrator: vi.fn().mockImplementation(() => ({
      mount: vi.fn(),
      destroy: mockDestroy,
      setBars: mockSetBars,
      render: mockRender,
      setShowGrid: vi.fn(),
      getViewport: () => ({
        visibleFrom: 0,
        visibleTo: 9,
        barSpacing: 8,
        rightPaddingPx: 56,
        plotOffsetPx: () => 0,
        plotWidthPx: () => 300,
        plotXForBarIndex: () => 150,
        canvasXForBarIndex: () => 150,
        barIndexAtPlotX: () => 0,
        visibleBarIndexRange: () => ({ from: 0, to: 9 }),
        setBarCount: vi.fn(),
        fitLatest: vi.fn(),
        setVisibleRange: vi.fn(),
      }),
      getEffectiveMainPriceRange: () => ({ min: 0, max: 2 }),
      getMainPaneLayoutMetrics: () => ({
        canvasWidth: 800,
        canvasHeight: 400,
        cssWidth: 400,
        mainPaneHeight: 400,
        volumePaneHeight: 40,
      }),
      getDrawingOverlayCanvas: () => null,
      setCrosshairReadout: vi.fn(),
    })),
  };
});

import { WebGLChartRenderBackend } from '../src/chart-renderer-webgl.js';

const sampleBar: Bar = { t: 1_000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };

describe('WebGLChartRenderBackend crosshair (R3)', () => {
  beforeEach(() => {
    mockSetBars.mockClear();
    mockDestroy.mockClear();
  });

  it('emitClear once on clearBars when crosshair was active (no pointerleave)', () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const handler = vi.fn();
    const backend = new WebGLChartRenderBackend(el);
    const off = backend.subscribeCrosshair(handler);

    backend.setBars([sampleBar]);
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 200,
        clientY: rect.top + 100,
      }),
    );

    expect(handler.mock.calls.some((c) => c[0] != null)).toBe(true);

    handler.mockClear();
    backend.clearBars();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(null);

    el.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 200,
        clientY: rect.top + 100,
      }),
    );
    expect(handler).toHaveBeenCalledTimes(1);

    off();
    backend.destroy();
    el.remove();
  });

  it('emitClear once on setBars([]) after active crosshair', () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const handler = vi.fn();
    const backend = new WebGLChartRenderBackend(el);
    backend.subscribeCrosshair(handler);

    backend.setBars([sampleBar]);
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + 100,
        clientY: rect.top + 100,
      }),
    );
    expect(handler.mock.calls.some((c) => c[0] != null)).toBe(true);

    handler.mockClear();
    backend.setBars([]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(null);

    backend.destroy();
    el.remove();
  });

  it('positions DOM crosshair in CSS pixels when layout metrics are device-scaled (DPR=2)', () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const backend = new WebGLChartRenderBackend(el);
    backend.setBars([{ ...sampleBar, t: 1_000, c: 0 }]);
    backend.setCrosshair({ timeMs: 1_000, price: 0 });

    const overlay = el.querySelector('.tv-webgl-crosshair');
    expect(overlay).not.toBeNull();
    const hLine = overlay!.children[1] as HTMLElement;
    expect(hLine.style.top).toBe('200px');
    expect(hLine.style.width).toBe('400px');

    backend.destroy();
    el.remove();
  });
});