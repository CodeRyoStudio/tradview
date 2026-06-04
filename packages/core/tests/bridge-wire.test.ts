import { describe, expect, it, vi } from 'vitest';
import type { BridgeAdapter } from '@coderyo/bridge';
import type { IChart } from '../src/create-chart.js';
import type { ChartController } from '../src/chart-controller.js';
import { wireChartBridge } from '../src/bridge-wire.js';

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

describe('wireChartBridge host.setChartPaneResizeFocus', () => {
  it('posts chart.error for invalid pane', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    const setChartPaneResizeFocus = vi.fn();
    const chart = {
      setChartPaneResizeFocus,
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as IChart;
    const controller = {
      getContainer: () => ({
        getBoundingClientRect: () => ({ width: 100, height: 100 }),
      }),
    } as unknown as ChartController;

    wireChartBridge({
      controller,
      chart,
      bridge: adapter,
      chartId: 'test-chart',
      outboundEvents: ['chart.ready', 'chart.error'],
    });

    posted.length = 0;
    dispatch({ type: 'host.setChartPaneResizeFocus', payload: { pane: 'invalid' } });

    expect(setChartPaneResizeFocus).not.toHaveBeenCalled();
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('INVALID_PANE');
    expect(err?.payload?.chartId).toBe('test-chart');
  });

  it('calls setChartPaneResizeFocus for valid pane', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    const setChartPaneResizeFocus = vi.fn(() => chart);
    const chart = {
      setChartPaneResizeFocus,
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as IChart;
    const controller = {
      getContainer: () => ({
        getBoundingClientRect: () => ({ width: 100, height: 100 }),
      }),
    } as unknown as ChartController;

    wireChartBridge({ controller, chart, bridge: adapter, chartId: 'c1' });
    posted.length = 0;
    dispatch({ type: 'host.setChartPaneResizeFocus', payload: { pane: 'volume' } });
    expect(setChartPaneResizeFocus).toHaveBeenCalledWith('volume');
    expect(posted.some((p) => p.type === 'chart.error')).toBe(false);
  });
});