export const BRIDGE_SCHEMA_VERSION = 2 as const;

/** Chart pane id for `host.layer.*` (maps to `chart.main` / `chart.volume` / `chart.indicator`). */
export type BridgeLayerPane = 'main' | 'volume' | 'indicator';

export const LAYER_PRESET_VERSION = 2 as const;

export const LAYER_HOST_EVENTS = [
  'host.layer.setSyncGroup',
  'host.layer.setVisible',
  'host.layer.setActivePage',
  'host.layer.setPreset',
  'host.layer.applyTimeScaleSync',
] as const;

export type BridgeLayerInboundType = (typeof LAYER_HOST_EVENTS)[number];

/** Exhaustive schema-2 inbound `host.*` list (single source for contract + schema 3 chart-scoped events). */
export const BRIDGE_INBOUND_EVENTS = [
  'host.setSymbol',
  'host.setInterval',
  'host.setTheme',
  'host.setShowGrid',
  'host.fitContent',
  'host.scrollToRealtime',
  'host.setLogScale',
  'host.setBarSpace',
  'host.setVisibleRange',
  'host.scrollToTimestamp',
  'host.reloadHistory',
  'host.setLocale',
  'host.setFeatures',
  'host.setIndicatorConfig',
  'host.clearAllIndicators',
  'host.clearAllDrawings',
  'host.setDrawingTool',
  'host.setChartPaneResizeFocus',
  'host.resize',
  'host.destroy',
  ...LAYER_HOST_EVENTS,
] as const;

export const LAYER_OUTBOUND_EVENTS = [
  'chart.layerSyncGroupChanged',
  'chart.layerPageChanged',
  'chart.layerVisibleChanged',
] as const;

export type BridgeLayerOutboundType = (typeof LAYER_OUTBOUND_EVENTS)[number];

/** Payload fragment advertised in `chart.ready` for schema 2 layer hosts. */
export const LAYER_API_READY = {
  presetVersion: LAYER_PRESET_VERSION,
  hostEvents: [...LAYER_HOST_EVENTS],
  outboundLayerEvents: [...LAYER_OUTBOUND_EVENTS],
} as const;

export type BridgeOutboundType =
  | 'chart.ready'
  | 'chart.resize'
  | 'chart.connectionChange'
  | 'chart.destroyed'
  | 'chart.crosshair'
  | 'chart.interval'
  | 'chart.symbol'
  | 'chart.visibleRange'
  | 'chart.barUpdate'
  | 'chart.error'
  | BridgeLayerOutboundType;

export type BridgeInboundType = (typeof BRIDGE_INBOUND_EVENTS)[number];

export interface BridgeOutboundEvent {
  type: BridgeOutboundType;
  payload?: Record<string, unknown>;
}

export interface BridgeInboundMessage {
  type: BridgeInboundType | string;
  payload?: Record<string, unknown>;
}

export function isBridgeInbound(msg: unknown): msg is BridgeInboundMessage {
  return typeof msg === 'object' && msg !== null && typeof (msg as BridgeInboundMessage).type === 'string';
}

export function isBridgeLayerInboundType(type: string): type is BridgeLayerInboundType {
  return (LAYER_HOST_EVENTS as readonly string[]).includes(type);
}

/** Schema 2.0 rejects deprecated `layerId` on `host.layer.setSyncGroup`. */
export function bridgeLayerPayloadHasDeprecatedLayerId(payload: Record<string, unknown> | undefined): boolean {
  return payload != null && 'layerId' in payload;
}