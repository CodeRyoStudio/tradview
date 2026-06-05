import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BridgeAdapter, BridgeOutboundType } from '@coderyo/bridge';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import type { IChart } from '../src/create-chart.js';
import type { ChartController } from '../src/chart-controller.js';
import { wireChartBridge } from '../src/bridge-wire.js';

function createMockBridge() {
  const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
  let handler: ((msg: { type: string; payload?: Record<string, unknown> }) => void) | null =
    null;
  const adapter = {
    post: (event: { type: string; payload?: Record<string, unknown> }) => {
      posted.push(event);
    },
    onMessage: (fn: (msg: { type: string; payload?: Record<string, unknown> }) => void) => {
      handler = fn;
      return () => {
        handler = null;
      };
    },
  } as BridgeAdapter;
  return {
    adapter,
    posted,
    dispatch: (msg: { type: string; payload?: Record<string, unknown> }) => handler?.(msg),
  };
}

const controller = {
  getContainer: () => ({
    getBoundingClientRect: () => ({ width: 400, height: 300 }),
  }),
} as unknown as ChartController;

const unwires: Array<() => void> = [];

function wireMinimal(chart: IChart, outboundEvents?: BridgeOutboundType[]) {
  const { adapter, posted, dispatch } = createMockBridge();
  const unwire = wireChartBridge({
    controller,
    chart,
    bridge: adapter,
    chartId: 'c1',
    outboundEvents,
  });
  unwires.push(unwire);
  return { posted, dispatch, unwire };
}

afterEach(() => {
  while (unwires.length) unwires.pop()?.();
});

describe('wireChartBridge host.* 2.1', () => {
  it('host.setFullscreen calls chart.setFullscreen', () => {
    const setFullscreen = vi.fn();
    const chart = { setFullscreen, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch } = wireMinimal(chart);
    dispatch({ type: 'host.setFullscreen', payload: { chartId: 'c1', enabled: true } });
    expect(setFullscreen).toHaveBeenCalledWith(true);
  });

  it('host.deleteSelectedDrawing calls chart.deleteSelectedDrawing', () => {
    const deleteSelectedDrawing = vi.fn(() => false);
    const chart = { deleteSelectedDrawing, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch } = wireMinimal(chart);
    dispatch({ type: 'host.deleteSelectedDrawing', payload: { chartId: 'c1' } });
    expect(deleteSelectedDrawing).toHaveBeenCalled();
  });

  it('host.exportImage invokes chart.exportImage', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const exportImage = vi.fn(async () => blob);
    const chart = { exportImage, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch, unwire } = wireMinimal(chart, []);
    dispatch({ type: 'host.exportImage', payload: { chartId: 'c1', pixelRatio: 2 } });
    await vi.waitFor(() => exportImage.mock.calls.length > 0);
    expect(exportImage).toHaveBeenCalledWith({ pixelRatio: 2 });
    unwire();
  });

  it('host.exportImage posts chart.exportImage with dataUrl when allowlisted', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const exportImage = vi.fn(async () => blob);
    const chart = { exportImage, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { posted, dispatch } = wireMinimal(chart, ['chart.exportImage']);
    dispatch({ type: 'host.exportImage', payload: { chartId: 'c1', pixelRatio: 1 } });
    let exported: (typeof posted)[number] | undefined;
    await vi.waitFor(() => {
      exported = posted.find(
        (p) =>
          p.type === 'chart.exportImage' &&
          typeof (p.payload as { dataUrl?: string } | undefined)?.dataUrl === 'string',
      );
      expect(exported?.payload).toMatchObject({
        chartId: 'c1',
        mimeType: 'image/png',
        dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
      });
    });
  });

  it('host.exportImage posts EXPORT_FAILED on rejection', async () => {
    const exportImage = vi.fn(async () => {
      throw new Error('canvas lost');
    });
    const chart = { exportImage, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { posted, dispatch } = wireMinimal(chart, ['chart.error']);
    dispatch({ type: 'host.exportImage', payload: { chartId: 'c1' } });
    await vi.waitFor(() => posted.some((p) => p.type === 'chart.error'));
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('EXPORT_FAILED');
    expect(err?.payload?.chartId).toBe('c1');
  });

  it('host.setIndicatorConfig calls chart.setIndicatorConfig', () => {
    const setIndicatorConfig = vi.fn();
    const chart = { setIndicatorConfig, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch } = wireMinimal(chart);
    const config = { ...DEFAULT_INDICATOR_CONFIG, showRsi: true };
    dispatch({ type: 'host.setIndicatorConfig', payload: { chartId: 'c1', config } });
    expect(setIndicatorConfig).toHaveBeenCalledWith(config);
  });

  it('host.clearAllIndicators calls chart.clearAllIndicators', () => {
    const clearAllIndicators = vi.fn();
    const chart = { clearAllIndicators, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch } = wireMinimal(chart);
    dispatch({ type: 'host.clearAllIndicators', payload: { chartId: 'c1' } });
    expect(clearAllIndicators).toHaveBeenCalled();
  });

  it('host.clearAllDrawings calls chart.clearAllDrawings', () => {
    const clearAllDrawings = vi.fn();
    const chart = { clearAllDrawings, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch } = wireMinimal(chart);
    dispatch({ type: 'host.clearAllDrawings', payload: { chartId: 'c1' } });
    expect(clearAllDrawings).toHaveBeenCalled();
  });

  it('host.setDrawingTool calls chart.setDrawingTool for valid tool', () => {
    const setDrawingTool = vi.fn();
    const chart = { setDrawingTool, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { dispatch } = wireMinimal(chart);
    dispatch({ type: 'host.setDrawingTool', payload: { chartId: 'c1', tool: 'trendline' } });
    expect(setDrawingTool).toHaveBeenCalledWith('trendline');
  });

  it('host.setDrawingTool posts INVALID_TOOL for unknown tool', () => {
    const setDrawingTool = vi.fn();
    const chart = { setDrawingTool, on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const { posted, dispatch } = wireMinimal(chart, ['chart.error']);
    dispatch({ type: 'host.setDrawingTool', payload: { chartId: 'c1', tool: 'magic-wand' } });
    expect(setDrawingTool).not.toHaveBeenCalled();
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('INVALID_TOOL');
    expect(err?.payload?.chartId).toBe('c1');
  });
});