/**
 * Schema 3 wire helpers (V2-B3 runtime).
 * @see docs/bridge-schema-3.md
 */

import { BRIDGE_INBOUND_EVENTS } from './events.js';
import {
  WORKSPACE_HOST_EVENTS,
  type WorkspaceHostEventType,
} from './schema3-types.js';

const WORKSPACE_HOST_SET = new Set<string>(WORKSPACE_HOST_EVENTS);
const CHART_SCOPED_HOST_SET = new Set<string>(BRIDGE_INBOUND_EVENTS);

export function isWorkspaceHostEvent(type: string): type is WorkspaceHostEventType {
  return WORKSPACE_HOST_SET.has(type);
}

export function isChartScopedHostEvent(type: string): boolean {
  return CHART_SCOPED_HOST_SET.has(type);
}

export function readPayloadChartId(
  payload: Record<string, unknown> | undefined,
): string {
  const id = typeof payload?.chartId === 'string' ? payload.chartId.trim() : '';
  return id;
}

/** When hosts attach `bridgeSchemaVersion` on inbound payloads (optional). */
export function readInboundBridgeSchemaVersion(
  payload: Record<string, unknown> | undefined,
): number | null {
  const v = payload?.bridgeSchemaVersion;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}