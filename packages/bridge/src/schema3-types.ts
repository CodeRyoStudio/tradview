/**
 * Bridge schema 3 contract types (V2-00b skeleton + V2-B3 runtime).
 * @see docs/bridge-schema-3.md, docs/DESIGN-v2.md §4.5
 */

import type { BridgeLayerInboundType, BridgeLayerOutboundType } from './events.js';
import {
  BRIDGE_INBOUND_EVENTS,
  LAYER_API_READY,
  LAYER_HOST_EVENTS,
  LAYER_OUTBOUND_EVENTS,
} from './events.js';

export const BRIDGE_SCHEMA_VERSION_V3 = 3 as const;

/** Target `apiVersion` in schema-3 `chart.ready` @ TradView 2.0. */
export const TRADVIEW_API_VERSION_V2 = 2 as const;

/** Advertised in chart.ready @ schema 3 */
export interface ChartSummaryV3 {
  chartId: string;
  symbol?: string;
  interval?: string;
  active?: boolean;
}

export interface LayerApiReadyV3 {
  presetVersion: typeof LAYER_API_READY.presetVersion;
  hostEvents: readonly BridgeLayerInboundType[];
  outboundLayerEvents: readonly BridgeLayerOutboundType[];
}

export interface ChartReadyPayloadV3 {
  chartId: string;
  apiVersion: typeof TRADVIEW_API_VERSION_V2;
  bridgeSchemaVersion: typeof BRIDGE_SCHEMA_VERSION_V3;
  workspaceId: string;
  charts: ChartSummaryV3[];
  layerApi?: LayerApiReadyV3;
}

export const WORKSPACE_HOST_EVENTS = [
  'host.workspace.createChart',
  'host.workspace.destroyChart',
  'host.workspace.setLinkGroup',
  'host.workspace.setActiveChart',
] as const;

export type WorkspaceHostEventType = (typeof WORKSPACE_HOST_EVENTS)[number];

export const WORKSPACE_OUTBOUND_EVENTS = [
  'chart.workspaceReady',
  'chart.focusChanged',
  'chart.linkStateChanged',
] as const;

export type WorkspaceOutboundEventType = (typeof WORKSPACE_OUTBOUND_EVENTS)[number];

/** Schema 2 inbound host events; @ schema 3 every payload must include `chartId`. */
export const SCHEMA3_CHART_SCOPED_HOST_EVENTS = BRIDGE_INBOUND_EVENTS;

export type Schema3ChartScopedHostEventType = (typeof SCHEMA3_CHART_SCOPED_HOST_EVENTS)[number];

export interface LinkSyncFlagsV3 {
  symbol?: boolean;
  interval?: boolean;
  visibleRange?: boolean;
  crosshair?: boolean;
}

export interface WorkspaceHostCreateChartPayload {
  chartId: string;
  containerId: string;
}

export interface WorkspaceHostDestroyChartPayload {
  chartId: string;
}

export interface WorkspaceHostSetLinkGroupPayload {
  groupId: string;
  chartIds: string[];
  sync: LinkSyncFlagsV3;
}

export interface WorkspaceHostSetActiveChartPayload {
  chartId: string;
}

export interface WorkspaceReadyPayloadV3 {
  workspaceId: string;
  charts: ChartSummaryV3[];
}

export interface FocusChangedPayloadV3 {
  chartId: string;
  previousChartId?: string;
}

export interface LinkStateChangedPayloadV3 {
  groupId: string;
  chartIds: string[];
  sync: LinkSyncFlagsV3;
}

export const BRIDGE_SCHEMA3_ERROR_CODES = [
  'UNSUPPORTED_BRIDGE_SCHEMA',
  'MISSING_CHART_ID',
  'CHART_NOT_FOUND',
  'STALE_PRESET_REVISION',
  'INVALID_PANE',
] as const;

export type BridgeSchema3ErrorCode = (typeof BRIDGE_SCHEMA3_ERROR_CODES)[number];

/** Layer API snapshot for chart.ready fixtures (schema 3 reuses schema 2 layer lists). */
export const LAYER_API_READY_V3: LayerApiReadyV3 = {
  presetVersion: LAYER_API_READY.presetVersion,
  hostEvents: [...LAYER_HOST_EVENTS],
  outboundLayerEvents: [...LAYER_OUTBOUND_EVENTS],
};