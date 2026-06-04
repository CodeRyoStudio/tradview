import { describe, expect, it, vi } from 'vitest';
import {
  handleLayerBridgeMessage,
  registerChartLayerBridge,
  unregisterChartLayerBridge,
} from '@coderyo/core';
import { LayerController } from '../src/layer/layer-controller.js';
import {
  createLayerBridgeRegistration,
  wrapLayerController,
} from '../src/layer/layer-bridge-registration.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';

describe('createLayerBridgeRegistration', () => {
  it('wraps LayerController and invokes compositorApply via bridge preset merge', () => {
    const preset = cloneLayoutPreset(VENDOR_DEFAULT_PRESET);
    const controller = new LayerController(preset);
    const applyCalls: number[] = [];
    const syncCalls: number[] = [];
    const chart = { applyTimeScaleSyncFromLayers: vi.fn() };

    const reg = createLayerBridgeRegistration({
      chartId: 'chart-a',
      chart,
      layerController: controller,
      compositorApply: () => applyCalls.push(1),
      syncCompositorShellVisibility: () => syncCalls.push(1),
    });

    expect(reg.chartId).toBe('chart-a');
    expect(reg.layerController.activePageId).toBe(controller.activePageId);

    const merged = reg.mergePreset!(reg.layerController.getPreset(), {
      revision: (reg.layerController.presetRevision ?? 1) + 1,
      layers: [],
    });
    const normalized = reg.normalizePreset!({
      ...merged,
      revision: (reg.layerController.presetRevision ?? 1) + 1,
    });
    expect(normalized.version).toBe(2);
    reg.layerController.setPreset(normalized);
    reg.compositorApply?.();
    reg.syncCompositorShellVisibility?.();
    expect(applyCalls).toEqual([1]);
    expect(syncCalls).toEqual([1]);

    const chartLayer = controller.getPreset().layers.find((l) => l.type.startsWith('chart.'));
    expect(chartLayer).toBeDefined();
    const wrapped = wrapLayerController(controller);
    expect(wrapped.getPreset().version).toBe(2);
    expect(wrapped.setLayerSyncGroup(chartLayer!.id, 'g1')).toBe(true);
  });

  it('registers with core registerChartLayerBridge and handles host.layer.setPreset', () => {
    const preset = cloneLayoutPreset(VENDOR_DEFAULT_PRESET);
    const controller = new LayerController(preset);
    const posted: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const reg = createLayerBridgeRegistration({
      chartId: 'wire-test',
      chart: { applyTimeScaleSyncFromLayers: vi.fn() },
      layerController: controller,
    });
    const teardown = registerChartLayerBridge(reg);
    try {
      handleLayerBridgeMessage(
        'host.layer.setPreset',
        {
          chartId: 'wire-test',
          replace: false,
          preset: {
            version: 2,
            revision: (controller.presetRevision ?? 1) + 1,
            id: 'merged-remote',
            name: 'Remote',
            author: 'integrator',
            pages: preset.pages,
            layers: preset.layers,
            groups: preset.groups,
          },
        },
        {
          bridge: { post: () => {}, onMessage: () => () => {} } as never,
          post: (type, payload) => posted.push({ type, payload }),
        },
      );
      expect(reg.layerController.presetRevision).toBe((preset.revision ?? 1) + 1);
    } finally {
      teardown();
      unregisterChartLayerBridge('wire-test');
    }
  });
});