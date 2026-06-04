import type {
  ChartLayerBridgeRegistration,
  LayerBridgeController,
  LayerBridgePreset,
  LayerTimeScaleSyncChart,
} from '@coderyo/core';
import type { LayerController } from './layer-controller.js';
import { mergeLayoutPreset } from './merge-preset.js';
import { normalizeLayoutPreset } from './normalize.js';
import type { LayoutPreset } from './types.js';

export type { ChartLayerBridgeRegistration } from '@coderyo/core';

function asLayerBridgePreset(p: LayoutPreset): LayerBridgePreset {
  return p as unknown as LayerBridgePreset;
}

/** Wrap `LayerController` for `wireChartBridge` / `registerChartLayerBridge`. */
export function wrapLayerController(lc: LayerController): LayerBridgeController {
  return {
    get activePageId() {
      return lc.activePageId;
    },
    get presetRevision() {
      return lc.presetRevision;
    },
    set presetRevision(v: number) {
      lc.presetRevision = v;
    },
    getPreset: () => asLayerBridgePreset(lc.getPreset()),
    setLayerSyncGroup: (layerId, groupId) => lc.setLayerSyncGroup(layerId, groupId),
    setLayerVisible: (layerId, visible) => lc.setLayerVisible(layerId, visible),
    setActivePage: (pageId) => lc.setActivePage(pageId),
    setPreset: (next) => lc.setPreset(next as unknown as LayoutPreset),
  };
}

export interface CreateLayerBridgeRegistrationOptions {
  chartId: string;
  chart: LayerTimeScaleSyncChart;
  layerController: LayerController;
  compositorApply?: () => void;
  syncCompositorShellVisibility?: () => void;
  normalizePreset?: (input: LayerBridgePreset) => LayerBridgePreset;
  mergePreset?: (current: LayerBridgePreset, partial: LayerBridgePreset) => LayerBridgePreset;
}

/**
 * @public Build `ChartLayerBridgeRegistration` for `wireChartBridge({ layerBridge })`.
 * Defaults `normalizePreset` / `mergePreset` to ui-shell layout helpers.
 */
export function createLayerBridgeRegistration(
  opts: CreateLayerBridgeRegistrationOptions,
): ChartLayerBridgeRegistration {
  const normalizePreset =
    opts.normalizePreset ??
    ((p) => asLayerBridgePreset(normalizeLayoutPreset(p as unknown as LayoutPreset)));
  const mergePreset =
    opts.mergePreset ??
    ((current, partial) =>
      asLayerBridgePreset(
        mergeLayoutPreset(
          current as unknown as LayoutPreset,
          partial as unknown as LayoutPreset,
        ),
      ));

  return {
    chartId: opts.chartId,
    chart: opts.chart,
    layerController: wrapLayerController(opts.layerController),
    compositorApply: opts.compositorApply,
    syncCompositorShellVisibility: opts.syncCompositorShellVisibility,
    normalizePreset,
    mergePreset,
  };
}