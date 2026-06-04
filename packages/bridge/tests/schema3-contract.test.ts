import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BRIDGE_INBOUND_EVENTS,
  BRIDGE_SCHEMA_VERSION,
  LAYER_API_READY,
  LAYER_HOST_EVENTS,
  LAYER_OUTBOUND_EVENTS,
} from '../src/events.js';
import {
  BRIDGE_SCHEMA3_ERROR_CODES,
  BRIDGE_SCHEMA_VERSION_V3,
  LAYER_API_READY_V3,
  SCHEMA3_CHART_SCOPED_HOST_EVENTS,
  TRADVIEW_API_VERSION_V2,
  WORKSPACE_HOST_EVENTS,
  WORKSPACE_OUTBOUND_EVENTS,
  type ChartReadyPayloadV3,
} from '../src/schema3-types.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'schema3');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as T;
}

describe('bridge schema 3 — contract vs docs/fixtures', () => {
  it('production BRIDGE_SCHEMA_VERSION is 3 @ V2-B3', () => {
    expect(BRIDGE_SCHEMA_VERSION).toBe(3);
    expect(BRIDGE_SCHEMA_VERSION_V3).toBe(BRIDGE_SCHEMA_VERSION);
  });

  it('SCHEMA3_CHART_SCOPED_HOST_EVENTS equals BRIDGE_INBOUND_EVENTS (schema 2 parity)', () => {
    expect([...SCHEMA3_CHART_SCOPED_HOST_EVENTS].sort()).toEqual([...BRIDGE_INBOUND_EVENTS].sort());
    expect(SCHEMA3_CHART_SCOPED_HOST_EVENTS).toHaveLength(25);
  });

  it('workspace and chart-scoped host event sets are disjoint', () => {
    const chartScoped = new Set(SCHEMA3_CHART_SCOPED_HOST_EVENTS);
    for (const t of WORKSPACE_HOST_EVENTS) {
      expect(chartScoped.has(t)).toBe(false);
    }
    expect(WORKSPACE_HOST_EVENTS).toHaveLength(4);
  });

  it('WORKSPACE_HOST_EVENTS matches DESIGN-v2 §4.5', () => {
    expect([...WORKSPACE_HOST_EVENTS].sort()).toEqual(
      [
        'host.workspace.createChart',
        'host.workspace.destroyChart',
        'host.workspace.setLinkGroup',
        'host.workspace.setActiveChart',
      ].sort(),
    );
  });

  it('WORKSPACE_OUTBOUND_EVENTS matches bridge-schema-3.md', () => {
    expect([...WORKSPACE_OUTBOUND_EVENTS]).toEqual([
      'chart.workspaceReady',
      'chart.focusChanged',
      'chart.linkStateChanged',
    ]);
  });

  it('BRIDGE_SCHEMA3_ERROR_CODES documents GA error surface', () => {
    expect([...BRIDGE_SCHEMA3_ERROR_CODES].sort()).toEqual(
      [
        'UNSUPPORTED_BRIDGE_SCHEMA',
        'MISSING_CHART_ID',
        'CHART_NOT_FOUND',
        'STALE_PRESET_REVISION',
        'INVALID_PANE',
      ].sort(),
    );
  });

  it('LAYER_API_READY_V3 mirrors schema 2 layer advertisement', () => {
    expect(LAYER_API_READY_V3.presetVersion).toBe(LAYER_API_READY.presetVersion);
    expect([...LAYER_API_READY_V3.hostEvents].sort()).toEqual([...LAYER_HOST_EVENTS].sort());
    expect([...LAYER_API_READY_V3.outboundLayerEvents].sort()).toEqual(
      [...LAYER_OUTBOUND_EVENTS].sort(),
    );
  });

  it('chart.ready fixture matches ChartReadyPayloadV3 shape', () => {
    const msg = loadFixture<{ type: string; payload: ChartReadyPayloadV3 }>('chart-ready-v3.json');
    expect(msg.type).toBe('chart.ready');
    const p = msg.payload;
    expect(p.apiVersion).toBe(TRADVIEW_API_VERSION_V2);
    expect(p.bridgeSchemaVersion).toBe(BRIDGE_SCHEMA_VERSION_V3);
    expect(p.workspaceId).toBe('default');
    expect(p.charts[0]?.chartId).toBe('main');
    expect(p.layerApi?.presetVersion).toBe(LAYER_API_READY.presetVersion);
    expect([...p.layerApi!.hostEvents].sort()).toEqual([...LAYER_HOST_EVENTS].sort());
    expect([...p.layerApi!.outboundLayerEvents].sort()).toEqual([...LAYER_OUTBOUND_EVENTS].sort());
  });

  it('host.setSymbol fixture requires chartId and symbol', () => {
    const msg = loadFixture<{ type: string; payload: { chartId: string; symbol: string } }>(
      'host-set-symbol-v3.json',
    );
    expect(msg.type).toBe('host.setSymbol');
    expect(msg.payload.chartId).toBe('main');
    expect(msg.payload.symbol).toBe('BINANCE:ETHUSDT');
    expect(SCHEMA3_CHART_SCOPED_HOST_EVENTS).toContain(msg.type);
  });

  it('host.setInterval fixture is chart-scoped', () => {
    const msg = loadFixture<{ type: string; payload: { chartId: string; interval: string } }>(
      'host-set-interval-v3.json',
    );
    expect(msg.payload.chartId).toBe('main');
    expect(msg.payload.interval).toBe('15m');
    expect(SCHEMA3_CHART_SCOPED_HOST_EVENTS).toContain('host.setInterval');
  });

  it('host.workspace fixtures match WORKSPACE_HOST_EVENTS', () => {
    const create = loadFixture<{ type: string }>('host-workspace-create-chart-v3.json');
    const destroy = loadFixture<{ type: string }>('host-workspace-destroy-chart-v3.json');
    const link = loadFixture<{ type: string }>('host-workspace-set-link-group-v3.json');
    const active = loadFixture<{ type: string }>('host-workspace-set-active-chart-v3.json');
    for (const t of [create.type, destroy.type, link.type, active.type]) {
      expect(WORKSPACE_HOST_EVENTS).toContain(t);
      expect(SCHEMA3_CHART_SCOPED_HOST_EVENTS).not.toContain(t);
    }
  });

  it('workspace outbound fixtures match WORKSPACE_OUTBOUND_EVENTS', () => {
    const ready = loadFixture<{ type: string }>('chart-workspace-ready-v3.json');
    const focus = loadFixture<{ type: string }>('chart-focus-changed-v3.json');
    const link = loadFixture<{ type: string }>('chart-link-state-changed-v3.json');
    expect(WORKSPACE_OUTBOUND_EVENTS).toContain(ready.type);
    expect(WORKSPACE_OUTBOUND_EVENTS).toContain(focus.type);
    expect(WORKSPACE_OUTBOUND_EVENTS).toContain(link.type);
  });
});