export const BRIDGE_SCHEMA_VERSION = 1 as const;

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
  | 'chart.error';

export type BridgeInboundType =
  | 'host.setSymbol'
  | 'host.setInterval'
  | 'host.setTheme'
  | 'host.setShowGrid'
  | 'host.fitContent'
  | 'host.scrollToRealtime'
  | 'host.setLogScale'
  | 'host.setBarSpace'
  | 'host.setVisibleRange'
  | 'host.scrollToTimestamp'
  | 'host.reloadHistory'
  | 'host.setLocale'
  | 'host.setFeatures'
  | 'host.setIndicatorConfig'
  | 'host.clearAllIndicators'
  | 'host.clearAllDrawings'
  | 'host.setDrawingTool'
  | 'host.setChartPaneResizeFocus'
  | 'host.resize'
  | 'host.destroy';

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