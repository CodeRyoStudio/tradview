import { describe, expect, it, vi } from 'vitest';
import {
  resolvePaneSyncGroupsFromLayers,
  type PaneSyncGroupPatch,
} from '@coderyo/core';
import { bindLayerTimeScaleSync } from '../src/layer/bind-layer-time-scale-sync.js';
import { LayerController } from '../src/layer/layer-controller.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DUAL_SYNC_PRESET } from '../src/layer/default-presets.js';

function chartMock(apply: ReturnType<typeof vi.fn>) {
  return {
    applyTimeScaleSyncFromLayers: (
      layers: Parameters<typeof resolvePaneSyncGroupsFromLayers>[0],
      pageId?: string,
    ) => {
      apply(layers, pageId);
      return chartMock(apply);
    },
  };
}

function lastPatch(apply: ReturnType<typeof vi.fn>): PaneSyncGroupPatch {
  const [layers, pageId] = apply.mock.calls[apply.mock.calls.length - 1] as [
    Parameters<typeof resolvePaneSyncGroupsFromLayers>[0],
    string | undefined,
  ];
  return resolvePaneSyncGroupsFromLayers(layers, pageId);
}

describe('bindLayerTimeScaleSync', () => {
  it('applies sync on bind and on controller mutations with payload', () => {
    const controller = new LayerController(VENDOR_DUAL_SYNC_PRESET);
    const apply = vi.fn();
    const onSync = vi.fn();

    const unbind = bindLayerTimeScaleSync(chartMock(apply), controller, { onSync });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]![1]).toBe(controller.activePageId);
    expect(lastPatch(apply)).toEqual({
      main: 'prices',
      volume: 'prices',
      indicator: 'osc',
    });
    expect(onSync).toHaveBeenCalledTimes(1);

    const main = controller.getLayersForActivePage().find((l) => l.type === 'chart.main')!;
    controller.setLayerSyncGroup(main.id, 'custom-group');
    expect(apply).toHaveBeenCalledTimes(2);
    expect(
      controller.getLayersForActivePage().find((l) => l.id === main.id)!.syncTimeScaleGroupId,
    ).toBe('custom-group');
    expect(lastPatch(apply)).toEqual({
      main: 'custom-group',
      volume: 'prices',
      indicator: 'osc',
    });
    expect(onSync).toHaveBeenCalledTimes(2);

    controller.setLayerSyncGroup(main.id, '');
    expect(apply).toHaveBeenCalledTimes(3);
    expect(lastPatch(apply)).toEqual({
      main: null,
      volume: 'prices',
      indicator: 'osc',
    });

    unbind();
    controller.setLayerSyncGroup(main.id, 'after-unbind');
    expect(apply).toHaveBeenCalledTimes(3);
  });

  it('passes active page sync groups after page switch (not first page in preset)', () => {
    const preset = cloneLayoutPreset(VENDOR_DUAL_SYNC_PRESET);
    const page1 = preset.pages[0]!.id;
    const mainP1 = preset.layers.find((l) => l.type === 'chart.main' && l.pageId === page1)!;
    mainP1.syncTimeScaleGroupId = 'page-one-main';
    const volP1 = preset.layers.find((l) => l.type === 'chart.volume' && l.pageId === page1)!;
    volP1.syncTimeScaleGroupId = 'page-one-vol';

    const controller = new LayerController(preset);
    const apply = vi.fn();
    const onSync = vi.fn();
    bindLayerTimeScaleSync(chartMock(apply), controller, { onSync });

    const page2 = controller.addPage('Page 2');
    const mainP2 = controller.getPreset().layers.find(
      (l) => l.type === 'chart.main' && l.pageId === page2,
    )!;
    controller.setLayerSyncGroup(mainP2.id, 'page-two-main');
    controller.setActivePage(page1);
    onSync.mockClear();
    controller.setActivePage(page2);

    expect(apply.mock.calls[apply.mock.calls.length - 1]![1]).toBe(page2);
    expect(lastPatch(apply)).toEqual({
      main: 'page-two-main',
      volume: 'page-one-vol',
      indicator: 'osc',
    });
    expect(onSync).toHaveBeenCalled();
  });

  it('re-applies sync when setPreset changes active page groups', () => {
    const controller = new LayerController(VENDOR_DUAL_SYNC_PRESET);
    const apply = vi.fn();
    bindLayerTimeScaleSync(chartMock(apply), controller);

    const next = cloneLayoutPreset(VENDOR_DUAL_SYNC_PRESET);
    const main = next.layers.find((l) => l.type === 'chart.main')!;
    main.syncTimeScaleGroupId = 'preset-swap';
    controller.setPreset(next);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(lastPatch(apply)).toEqual({
      main: 'preset-swap',
      volume: 'prices',
      indicator: 'osc',
    });
  });

  it('re-applies sync when layer visibility changes', () => {
    const controller = new LayerController(VENDOR_DUAL_SYNC_PRESET);
    const apply = vi.fn();
    bindLayerTimeScaleSync(chartMock(apply), controller);

    const topBar = controller.getLayersForActivePage().find((l) => l.widgetKey === 'topBar')!;
    controller.setLayerVisible(topBar.id, false);
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1]![1]).toBe(controller.activePageId);
  });
});