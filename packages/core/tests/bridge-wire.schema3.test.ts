import { describe, expect, it, vi } from 'vitest';
import { BRIDGE_SCHEMA_VERSION } from '@coderyo/bridge';
import type { BridgeAdapter } from '@coderyo/bridge';
import type { IChart } from '../src/create-chart.js';
import type { ChartController } from '../src/chart-controller.js';
import { TRADVIEW_API_VERSION, wireChartBridge } from '../src/bridge-wire.js';

function createMockBridge(): {
  adapter: BridgeAdapter;
  posted: Array<{ type: string; payload?: Record<string, unknown> }>;
  dispatch: (msg: { type: string; payload?: Record<string, unknown> }) => void;
} {
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
    dispatch: (msg) => handler?.(msg),
  };
}

function mockController(): ChartController {
  return {
    getContainer: () => ({
      getBoundingClientRect: () => ({ width: 320, height: 240 }),
    }),
    getSymbol: () => 'BINANCE:BTCUSDT',
    getInterval: () => '1h',
  } as unknown as ChartController;
}

describe('wireChartBridge schema 3 (V2-B3)', () => {
  it('posts chart.ready with schema 3 fields', () => {
    const { adapter, posted } = createMockBridge();
    wireChartBridge({
      controller: mockController(),
      chart: { on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'main',
      outboundEvents: ['chart.ready', 'chart.workspaceReady'],
    });

    const ready = posted.find((p) => p.type === 'chart.ready');
    expect(ready?.payload?.bridgeSchemaVersion).toBe(BRIDGE_SCHEMA_VERSION);
    expect(ready?.payload?.bridgeSchemaVersion).toBe(3);
    expect(ready?.payload?.apiVersion).toBe(TRADVIEW_API_VERSION);
    expect(ready?.payload?.workspaceId).toBe('default');
    expect(ready?.payload?.charts).toEqual([
      expect.objectContaining({
        chartId: 'main',
        symbol: 'BINANCE:BTCUSDT',
        interval: '1h',
        active: true,
      }),
    ]);

    const ws = posted.find((p) => p.type === 'chart.workspaceReady');
    expect(ws?.payload?.workspaceId).toBe('default');
    expect(ws?.payload?.charts).toHaveLength(1);
  });

  it('rejects chart-scoped host without chartId', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    const setSymbol = vi.fn();
    wireChartBridge({
      controller: mockController(),
      chart: { setSymbol, on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'main',
      outboundEvents: ['chart.error'],
    });

    dispatch({ type: 'host.setSymbol', payload: { symbol: 'ETH' } });
    expect(setSymbol).not.toHaveBeenCalled();
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('MISSING_CHART_ID');
  });

  it('rejects chart-scoped host with unknown chartId', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    wireChartBridge({
      controller: mockController(),
      chart: { setSymbol: vi.fn(), on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'main',
      outboundEvents: ['chart.error'],
    });

    dispatch({
      type: 'host.setSymbol',
      payload: { chartId: 'other', symbol: 'ETH' },
    });
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('CHART_NOT_FOUND');
  });

  it('rejects inbound bridgeSchemaVersion 2', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    wireChartBridge({
      controller: mockController(),
      chart: { on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'main',
      outboundEvents: ['chart.error'],
    });

    dispatch({
      type: 'host.fitContent',
      payload: { chartId: 'main', bridgeSchemaVersion: 2 },
    });
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('UNSUPPORTED_BRIDGE_SCHEMA');
  });

  it('defers host.workspace.* when workspaceContext is set (V2-B4)', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    wireChartBridge({
      controller: mockController(),
      chart: { on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'main',
      outboundEvents: ['chart.error', 'chart.focusChanged'],
      workspaceContext: {
        workspaceId: 'ws-1',
        getChartSummaries: () => [{ chartId: 'main', active: true }],
      },
    });

    dispatch({
      type: 'host.workspace.createChart',
      payload: { chartId: 'other', containerId: 'slot' },
    });
    dispatch({
      type: 'host.workspace.setActiveChart',
      payload: { chartId: 'main' },
    });
    expect(posted.find((p) => p.type === 'chart.error')).toBeUndefined();
    expect(posted.find((p) => p.type === 'chart.focusChanged')).toBeUndefined();
  });

  it('handles host.workspace.setActiveChart with focusChanged', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    wireChartBridge({
      controller: mockController(),
      chart: { on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'main',
      outboundEvents: ['chart.focusChanged'],
    });

    dispatch({
      type: 'host.workspace.setActiveChart',
      payload: { chartId: 'main' },
    });
    expect(posted.find((p) => p.type === 'chart.focusChanged')?.payload?.chartId).toBe('main');
  });
});