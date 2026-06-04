import type { LayerNode, LayerType } from './types.js';
import { syncAllOverlayLayersToMain } from './overlay-mount.js';

export const CHART_PANE_LAYER_TYPES: readonly LayerType[] = [
  'chart.main',
  'chart.volume',
  'chart.indicator',
  'chart.host',
  'chart.indicatorHost',
] as const;

export const DEFAULT_SYNC_TIME_SCALE_GROUP = 'chart-timescale';

export function isChartPaneLayerType(type: string): type is LayerType {
  return (CHART_PANE_LAYER_TYPES as readonly string[]).includes(type);
}

export function widgetKeyForChartPaneType(type: LayerType): string | null {
  switch (type) {
    case 'chart.main':
      return 'chartMain';
    case 'chart.volume':
      return 'chartVolume';
    case 'chart.indicator':
    case 'chart.indicatorHost':
      return 'chartIndicator';
    case 'chart.host':
      return 'chartMain';
    default:
      return null;
  }
}

export function paneIdFromWidgetKey(
  widgetKey: string,
): 'main' | 'volume' | 'indicator' | null {
  switch (widgetKey) {
    case 'chartMain':
    case 'chartHost':
      return 'main';
    case 'chartVolume':
      return 'volume';
    case 'chartIndicator':
    case 'indicatorHost':
      return 'indicator';
    default:
      return null;
  }
}

export interface HostSplitResult {
  layers: LayerNode[];
  /** Maps removed `chart.host` layer id → [mainId, volumeId]. */
  idRemap: Map<string, string[]>;
}

/** Split legacy `chart.host` into main + volume layers (vertical tile inside host frame). */
export function expandLegacyChartHostLayers(layers: LayerNode[]): LayerNode[] {
  return splitLegacyChartHost(layers).layers;
}

export function splitLegacyChartHost(layers: LayerNode[]): HostSplitResult {
  const host = layers.find((l) => l.type === 'chart.host');
  if (!host || layers.some((l) => l.type === 'chart.main')) {
    return { layers, idRemap: new Map() };
  }

  const mainRatio = 0.65;
  const main: LayerNode = {
    ...host,
    id: `${host.id}-main`,
    type: 'chart.main',
    widgetKey: 'chartMain',
    frame: {
      x: host.frame.x,
      y: host.frame.y,
      w: host.frame.w,
      h: host.frame.h * mainRatio,
    },
    syncTimeScaleGroupId: host.syncTimeScaleGroupId,
  };
  const volume: LayerNode = {
    ...host,
    id: `${host.id}-volume`,
    type: 'chart.volume',
    widgetKey: 'chartVolume',
    frame: {
      x: host.frame.x,
      y: host.frame.y + host.frame.h * mainRatio,
      w: host.frame.w,
      h: host.frame.h * (1 - mainRatio),
    },
    zIndex: host.zIndex + 1,
    syncTimeScaleGroupId: host.syncTimeScaleGroupId,
  };

  const rest = layers.filter((l) => l.id !== host.id);
  const idRemap = new Map<string, string[]>([[host.id, [main.id, volume.id]]]);
  return { layers: [...rest, main, volume], idRemap };
}

/** @deprecated Use syncOverlayLayersToMain / syncAllOverlayLayersToMain */
export function syncCrosshairLegendToMain(layers: LayerNode[]): void {
  syncAllOverlayLayersToMain(layers);
}

export function upgradeIndicatorHostType(layers: LayerNode[]): LayerNode[] {
  return layers.map((l) => {
    if (l.type !== 'chart.indicatorHost') return l;
    return {
      ...l,
      type: 'chart.indicator' as LayerType,
      widgetKey: l.widgetKey === 'indicatorHost' ? 'chartIndicator' : l.widgetKey,
      syncTimeScaleGroupId: l.syncTimeScaleGroupId,
    };
  });
}