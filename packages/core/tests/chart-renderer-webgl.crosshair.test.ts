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
      getViewport: () => ({
        visibleFrom: 0,
        visibleTo: 9,
        barSpacing: 8,
        rightPaddingPx: 56,
        plotWidthPx: () => 300,
        plotXForBarIndex: () => 150,
        barIndexAtPlotX: () => 0,
        visibleBarIndexRange: () => ({ from: 0, to: 9 }),
        setBarCount: vi.fn(),
        fitLatest: vi.fn(),
        setVisibleRange: vi.fn(),
      }),
      getMainPaneLayoutMetrics: () => ({
        mainPaneHeight: 200,
        volumePaneHeight: 40,
      }),
      getDrawingOverlayCanvas: () => null,
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
});