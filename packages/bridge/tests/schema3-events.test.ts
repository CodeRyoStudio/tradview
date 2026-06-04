import { describe, expect, it } from 'vitest';
import { BRIDGE_SCHEMA_VERSION } from '../src/events.js';
import {
  isChartScopedHostEvent,
  isWorkspaceHostEvent,
  readInboundBridgeSchemaVersion,
  readPayloadChartId,
} from '../src/schema3-wire.js';
import { WORKSPACE_HOST_EVENTS } from '../src/schema3-types.js';

describe('bridge schema 3 wire helpers (V2-B3)', () => {
  it('BRIDGE_SCHEMA_VERSION is 3', () => {
    expect(BRIDGE_SCHEMA_VERSION).toBe(3);
  });

  it('classifies workspace vs chart-scoped host events', () => {
    expect(isWorkspaceHostEvent('host.workspace.createChart')).toBe(true);
    expect(isWorkspaceHostEvent('host.setSymbol')).toBe(false);
    expect(isChartScopedHostEvent('host.setSymbol')).toBe(true);
    for (const t of WORKSPACE_HOST_EVENTS) {
      expect(isChartScopedHostEvent(t)).toBe(false);
    }
  });

  it('readPayloadChartId trims string chartId', () => {
    expect(readPayloadChartId({ chartId: '  main  ' })).toBe('main');
    expect(readPayloadChartId({})).toBe('');
  });

  it('readInboundBridgeSchemaVersion accepts numeric field only', () => {
    expect(readInboundBridgeSchemaVersion({ bridgeSchemaVersion: 3 })).toBe(3);
    expect(readInboundBridgeSchemaVersion({ bridgeSchemaVersion: '3' })).toBeNull();
    expect(readInboundBridgeSchemaVersion(undefined)).toBeNull();
  });
});