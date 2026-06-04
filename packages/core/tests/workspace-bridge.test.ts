import { describe, expect, it, vi } from 'vitest';
import type { BridgeAdapter } from '@coderyo/bridge';
import type { DataProvider } from '@coderyo/data';

vi.mock('../src/create-chart.js', () => ({
  createChart: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  })),
}));

import { ChartWorkspace } from '../src/chart-workspace.js';


const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

describe('wireWorkspaceBridge (V2-B4–B6)', () => {
  it('handles host.workspace.createChart and destroyChart', () => {
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const listeners = new Set<(msg: { type: string; payload?: Record<string, unknown> }) => void>();
    const bridge = {
      post: (e: { type: string; payload?: Record<string, unknown> }) => posted.push(e),
      onMessage: (fn: (msg: { type: string; payload?: Record<string, unknown> }) => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    } as BridgeAdapter;
    const dispatch = (msg: { type: string; payload?: Record<string, unknown> }) => {
      for (const fn of listeners) fn(msg);
    };

    const host = document.createElement('div');
    host.id = 'chart-slot-a';
    host.style.width = '320px';
    host.style.height = '240px';
    document.body.appendChild(host);

    const ws = new ChartWorkspace({ dataProvider: stubProvider, bridge });

    expect(posted.some((p) => p.type === 'chart.workspaceReady')).toBe(true);

    dispatch({
      type: 'host.workspace.createChart',
      payload: { chartId: 'a', containerId: 'chart-slot-a' },
    });
    expect(ws.getChart('a')).toBeDefined();

    dispatch({
      type: 'host.workspace.destroyChart',
      payload: { chartId: 'a' },
    });
    expect(ws.getChart('a')).toBeUndefined();

    ws.destroy();
    host.remove();
  });
});