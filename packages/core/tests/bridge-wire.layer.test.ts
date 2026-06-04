import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { BridgeAdapter } from '@coderyo/bridge';
import { LAYER_API_READY } from '@coderyo/bridge';
import type { ChartController } from '../src/chart-controller.js';
import type { IChart } from '../src/create-chart.js';
import { wireChartBridge } from '../src/bridge-wire.js';
import { mergeLayerBridgePreset } from '../src/merge-layer-bridge-preset.js';
import {
  getChartLayerBridgeState,
  handleLayerBridgeMessage,
  registerChartLayerBridge,
  resolvePaneLayerIds,
  resolvePaneSyncGroupsForBridge,
  unregisterChartLayerBridge,
  type LayerBridgeController,
  type LayerBridgePreset,
} from '../src/bridge-layer-wire.js';

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

function dualPagePreset(): LayerBridgePreset {
  return {
    version: 2,
    revision: 1,
    id: 'test',
    name: 'Test',
    author: 'integrator',
    pages: [
      { id: 'page-1', title: 'One' },
      { id: 'page-2', title: 'Two' },
    ],
    layers: [
      {
        id: 'm1',
        pageId: 'page-1',
        type: 'chart.main',
        widgetKey: 'chartMain',
        visible: true,
        syncTimeScaleGroupId: 'g1',
      },
      {
        id: 'm2',
        pageId: 'page-2',
        type: 'chart.main',
        widgetKey: 'chartMain',
        visible: true,
        syncTimeScaleGroupId: 'g1',
      },
      {
        id: 'v1',
        pageId: 'page-1',
        type: 'chart.volume',
        widgetKey: 'chartVolume',
        visible: true,
      },
    ],
    groups: [{ id: 'g1', layerIds: ['m1'] }],
  };
}

function mockLayerController(initial: LayerBridgePreset): LayerBridgeController {
  let preset = structuredClone(initial);
  let activePageId = preset.pages[0]!.id;
  let presetRevision = preset.revision ?? 1;
  return {
    get activePageId() {
      return activePageId;
    },
    get presetRevision() {
      return presetRevision;
    },
    set presetRevision(v: number) {
      presetRevision = v;
    },
    getPreset: () => structuredClone(preset),
    setLayerSyncGroup(layerId, groupId) {
      const layer = preset.layers.find((l) => l.id === layerId);
      if (!layer) return false;
      const trimmed = groupId == null ? '' : String(groupId).trim();
      layer.syncTimeScaleGroupId = trimmed.length > 0 ? trimmed : undefined;
      return true;
    },
    setLayerVisible(layerId, visible) {
      const layer = preset.layers.find((l) => l.id === layerId);
      if (layer) layer.visible = visible;
    },
    setActivePage(pageId) {
      if (!preset.pages.some((p) => p.id === pageId)) return false;
      if (activePageId === pageId) return false;
      activePageId = pageId;
      return true;
    },
    setPreset(next) {
      preset = structuredClone(next);
      presetRevision = preset.revision ?? presetRevision;
      return true;
    },
  };
}

function layerPost(
  posted: Array<{ type: string; payload?: Record<string, unknown> }>,
) {
  return (type: string, payload: Record<string, unknown>) => {
    posted.push({ type, payload });
  };
}

describe('bridge layer wire', () => {
  beforeEach(() => {
    unregisterChartLayerBridge('default');
    unregisterChartLayerBridge('other');
  });

  it('chart.ready advertises schema 2 and layerApi', () => {
    const { adapter, posted } = createMockBridge();
    const chart = { on: vi.fn(), off: vi.fn() } as unknown as IChart;
    const controller = {
      getContainer: () => ({
        getBoundingClientRect: () => ({ width: 100, height: 100 }),
      }),
    } as unknown as ChartController;

    wireChartBridge({
      controller,
      chart,
      bridge: adapter,
      chartId: 'default',
      outboundEvents: ['chart.ready'],
    });

    const ready = posted.find((p) => p.type === 'chart.ready');
    expect(ready?.payload?.bridgeSchemaVersion).toBe(2);
    expect(ready?.payload?.layerApi).toEqual(LAYER_API_READY);
  });

  it('setSyncGroup with empty groupId patches null for main pane', () => {
    const preset = dualPagePreset();
    const controller = mockLayerController(preset);
    const apply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: apply },
      layerController: controller,
    });

    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setSyncGroup',
      { chartId: 'default', pane: 'main', groupId: '', allPages: false },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );

    const patch = resolvePaneSyncGroupsForBridge(controller.getPreset().layers, 'page-1');
    expect(patch.main).toBeNull();
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-1');
    const evt = posted.find((p) => p.type === 'chart.layerSyncGroupChanged');
    expect(evt?.payload).toMatchObject({
      chartId: 'default',
      pane: 'main',
      groupId: '',
      allPages: false,
      activePageId: 'page-1',
    });
  });

  it('allPages setSyncGroup updates preset but applies only active page', () => {
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: apply },
      layerController: controller,
    });

    handleLayerBridgeMessage(
      'host.layer.setSyncGroup',
      { chartId: 'default', pane: 'main', groupId: 'remote', allPages: true },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );

    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-1');
    const ids = resolvePaneLayerIds(controller.getPreset(), 'main', { allPages: true });
    expect(ids).toEqual(['m1', 'm2']);
  });

  it('rejects layerId on setSyncGroup', () => {
    const controller = mockLayerController(dualPagePreset());
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: controller,
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setSyncGroup',
      { chartId: 'default', layerId: 'm1', pane: 'main', groupId: 'x' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('INVALID_PAYLOAD');
  });

  it('MISSING_CHART_ID when chartId absent in payload', () => {
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setSyncGroup',
      { pane: 'main', groupId: 'x' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('MISSING_CHART_ID');
  });

  it('LAYER_BRIDGE_NOT_REGISTERED when no registry', () => {
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setVisible',
      { chartId: 'default', pane: 'volume', visible: false },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe(
      'LAYER_BRIDGE_NOT_REGISTERED',
    );
  });

  it('CHART_NOT_FOUND for unknown chartId when bridge exists', () => {
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: mockLayerController(dualPagePreset()),
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setVisible',
      { chartId: 'other', pane: 'main', visible: true },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('CHART_NOT_FOUND');
  });

  it('INVALID_PANE and PANE_NOT_FOUND', () => {
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: mockLayerController(dualPagePreset()),
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setVisible',
      { chartId: 'default', pane: 'bad', visible: true },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('INVALID_PANE');

    posted.length = 0;
    const noIndicator = mockLayerController({
      ...dualPagePreset(),
      layers: dualPagePreset().layers.filter((l) => l.type !== 'chart.indicator'),
    });
    unregisterChartLayerBridge('default');
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: noIndicator,
    });
    handleLayerBridgeMessage(
      'host.layer.setSyncGroup',
      { chartId: 'default', pane: 'indicator', groupId: 'x' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('PANE_NOT_FOUND');
  });

  it('setVisible posts chart.layerVisibleChanged', () => {
    const compositorApply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: mockLayerController(dualPagePreset()),
      compositorApply,
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setVisible',
      { chartId: 'default', pane: 'volume', visible: false, allPages: false },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(compositorApply).toHaveBeenCalled();
    expect(posted.find((p) => p.type === 'chart.layerVisibleChanged')?.payload).toMatchObject({
      chartId: 'default',
      pane: 'volume',
      visible: false,
      allPages: false,
    });
  });

  it('setActivePage posts layerPageChanged and skips when unchanged', () => {
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: apply },
      layerController: controller,
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setActivePage',
      { chartId: 'default', pageId: 'page-1' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.some((p) => p.type === 'chart.layerPageChanged')).toBe(false);

    handleLayerBridgeMessage(
      'host.layer.setActivePage',
      { chartId: 'default', pageId: 'page-2' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    const evt = posted.find((p) => p.type === 'chart.layerPageChanged');
    expect(evt?.payload).toEqual({
      chartId: 'default',
      pageId: 'page-2',
      previousPageId: 'page-1',
    });
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-2');
  });

  it('applyTimeScaleSync uses resolved pageId on active page', () => {
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: apply },
      layerController: controller,
    });
    handleLayerBridgeMessage(
      'host.layer.applyTimeScaleSync',
      { chartId: 'default', pageId: 'page-1' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-1');
  });

  it('applyTimeScaleSync defers non-active pageId until setActivePage', () => {
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: apply },
      layerController: controller,
    });
    apply.mockClear();
    handleLayerBridgeMessage(
      'host.layer.applyTimeScaleSync',
      { chartId: 'default', pageId: 'page-2' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );
    expect(apply).not.toHaveBeenCalled();
    handleLayerBridgeMessage(
      'host.layer.setActivePage',
      { chartId: 'default', pageId: 'page-2' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-2');
  });

  it('applyTimeScaleSync allPages re-applies on next visit to visited page', () => {
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: apply },
      layerController: controller,
    });
    handleLayerBridgeMessage(
      'host.layer.setActivePage',
      { chartId: 'default', pageId: 'page-2' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );
    apply.mockClear();
    handleLayerBridgeMessage(
      'host.layer.applyTimeScaleSync',
      { chartId: 'default', allPages: true },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenLastCalledWith(expect.anything(), 'page-2');

    handleLayerBridgeMessage(
      'host.layer.setActivePage',
      { chartId: 'default', pageId: 'page-1' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: vi.fn(),
      },
    );
    expect(apply).toHaveBeenLastCalledWith(expect.anything(), 'page-1');
  });

  it('setPreset INVALID_PRESET when preset missing or revision invalid', () => {
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: mockLayerController(dualPagePreset()),
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];

    handleLayerBridgeMessage(
      'host.layer.setPreset',
      { chartId: 'default' },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('INVALID_PRESET');

    posted.length = 0;
    handleLayerBridgeMessage(
      'host.layer.setPreset',
      {
        chartId: 'default',
        preset: { ...dualPagePreset(), revision: 0 },
      },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('INVALID_PRESET');
  });

  it('setPreset INVALID_PRESET when normalize throws', () => {
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: mockLayerController(dualPagePreset()),
      normalizePreset: () => {
        throw new Error('normalize failed');
      },
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setPreset',
      {
        chartId: 'default',
        replace: true,
        preset: { ...dualPagePreset(), revision: 2 },
      },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    const err = posted.find((p) => p.type === 'chart.error');
    expect(err?.payload?.code).toBe('INVALID_PRESET');
    expect(String(err?.payload?.message)).toContain('normalize failed');
  });

  it('setPreset rejects stale revision; merge preserves layers when replace omitted', () => {
    const controller = mockLayerController(dualPagePreset());
    controller.presetRevision = 5;
    registerChartLayerBridge({
      chartId: 'default',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: controller,
    });
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    handleLayerBridgeMessage(
      'host.layer.setPreset',
      {
        chartId: 'default',
        replace: true,
        preset: { ...dualPagePreset(), revision: 3 },
      },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe(
      'STALE_PRESET_REVISION',
    );

    posted.length = 0;
    handleLayerBridgeMessage(
      'host.layer.setPreset',
      {
        chartId: 'default',
        preset: {
          version: 2,
          revision: 6,
          id: 'partial',
          name: 'Partial',
          author: 'integrator',
          pages: [{ id: 'page-3', title: 'Three' }],
          layers: [],
          groups: [],
        },
      },
      {
        bridge: { post: vi.fn() } as unknown as BridgeAdapter,
        post: layerPost(posted),
      },
    );
    expect(controller.getPreset().layers.some((l) => l.id === 'm1')).toBe(true);
    expect(controller.getPreset().pages.some((p) => p.id === 'page-3')).toBe(true);
    expect(controller.presetRevision).toBe(6);
  });

  it('mergeLayerBridgePreset upserts groups by id', () => {
    const base = dualPagePreset();
    const merged = mergeLayerBridgePreset(base, {
      ...base,
      revision: 2,
      groups: [{ id: 'g2', layerIds: ['m2'] }],
    });
    expect(merged.groups.map((g) => g.id).sort()).toEqual(['g1', 'g2']);
  });

  it('wireChartBridge unknown host.layer.* posts SCHEMA_MISMATCH', () => {
    const { adapter, posted, dispatch } = createMockBridge();
    wireChartBridge({
      controller: {
        getContainer: () => ({
          getBoundingClientRect: () => ({ width: 100, height: 100 }),
        }),
      } as unknown as ChartController,
      chart: { on: vi.fn(), off: vi.fn() } as unknown as IChart,
      bridge: adapter,
      chartId: 'default',
      outboundEvents: ['chart.error'],
    });
    posted.length = 0;
    dispatch({ type: 'host.layer.unknown', payload: { chartId: 'default' } });
    expect(posted.find((p) => p.type === 'chart.error')?.payload?.code).toBe('SCHEMA_MISMATCH');
  });

  it('wireChartBridge clears visited pages on host.setSymbol', () => {
    const { adapter, dispatch } = createMockBridge();
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    const setSymbol = vi.fn();
    wireChartBridge({
      controller: {
        getContainer: () => ({
          getBoundingClientRect: () => ({ width: 100, height: 100 }),
        }),
      } as unknown as ChartController,
      chart: {
        setSymbol,
        setInterval: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as IChart,
      bridge: adapter,
      chartId: 'default',
      layerBridge: {
        chartId: 'default',
        chart: { applyTimeScaleSyncFromLayers: apply },
        layerController: controller,
      },
      outboundEvents: ['chart.ready'],
    });

    dispatch({
      type: 'host.layer.setActivePage',
      payload: { chartId: 'default', pageId: 'page-2' },
    });
    expect(getChartLayerBridgeState('default')?.visitedPageIds.has('page-2')).toBe(true);

    apply.mockClear();
    dispatch({ type: 'host.setSymbol', payload: { symbol: 'ETHUSDT' } });
    expect(setSymbol).toHaveBeenCalledWith('ETHUSDT');
    expect(getChartLayerBridgeState('default')?.visitedPageIds.size).toBe(0);

    apply.mockClear();
    dispatch({
      type: 'host.layer.setActivePage',
      payload: { chartId: 'default', pageId: 'page-1' },
    });
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-1');
  });

  it('wireChartBridge clears visited pages on host.setInterval', () => {
    const { adapter, dispatch } = createMockBridge();
    const controller = mockLayerController(dualPagePreset());
    const apply = vi.fn();
    const setInterval = vi.fn();
    wireChartBridge({
      controller: {
        getContainer: () => ({
          getBoundingClientRect: () => ({ width: 100, height: 100 }),
        }),
      } as unknown as ChartController,
      chart: {
        setSymbol: vi.fn(),
        setInterval,
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as IChart,
      bridge: adapter,
      chartId: 'default',
      layerBridge: {
        chartId: 'default',
        chart: { applyTimeScaleSyncFromLayers: apply },
        layerController: controller,
      },
      outboundEvents: ['chart.ready'],
    });

    dispatch({
      type: 'host.layer.setActivePage',
      payload: { chartId: 'default', pageId: 'page-2' },
    });
    apply.mockClear();
    dispatch({ type: 'host.setInterval', payload: { interval: '4h' } });
    expect(setInterval).toHaveBeenCalledWith('4h');
    expect(getChartLayerBridgeState('default')?.visitedPageIds.size).toBe(0);

    dispatch({
      type: 'host.layer.setActivePage',
      payload: { chartId: 'default', pageId: 'page-1' },
    });
    expect(apply).toHaveBeenCalledWith(expect.anything(), 'page-1');
  });
});