import type { BridgeLayerPane } from '@coderyo/bridge';
import {
  isValidLayerBridgePane,
  resolvePaneLayerIds as resolvePaneLayerIdsCore,
} from '@coderyo/core';
import type { LayerType, LayoutPreset } from './types.js';

const PANE_TO_LAYER_TYPE: Record<BridgeLayerPane, LayerType> = {
  main: 'chart.main',
  volume: 'chart.volume',
  indicator: 'chart.indicator',
};

export function layerTypeForBridgePane(pane: BridgeLayerPane): LayerType {
  return PANE_TO_LAYER_TYPE[pane];
}

export { isValidLayerBridgePane as isValidBridgeLayerPane };

/**
 * @public Resolve chart pane → layer ids for preset scope (supports `allPages`).
 */
export function resolvePaneLayerIds(
  preset: Pick<LayoutPreset, 'layers' | 'pages'>,
  pane: BridgeLayerPane,
  opts?: { allPages?: boolean; activePageId?: string },
): string[] {
  return resolvePaneLayerIdsCore(preset, pane, opts);
}