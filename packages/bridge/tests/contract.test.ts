import { describe, expect, it } from 'vitest';
import type { BridgeInboundType } from '../src/events.js';
import {
  BRIDGE_SCHEMA_VERSION,
  LAYER_API_READY,
  LAYER_HOST_EVENTS,
} from '../src/events.js';

/** Every BridgeInboundType must be listed (exhaustive contract). */
const BRIDGE_INBOUND_CONTRACT: Record<BridgeInboundType, true> = {
  'host.setSymbol': true,
  'host.setInterval': true,
  'host.setTheme': true,
  'host.setShowGrid': true,
  'host.fitContent': true,
  'host.scrollToRealtime': true,
  'host.setLogScale': true,
  'host.setBarSpace': true,
  'host.setVisibleRange': true,
  'host.scrollToTimestamp': true,
  'host.reloadHistory': true,
  'host.setLocale': true,
  'host.setFeatures': true,
  'host.setIndicatorConfig': true,
  'host.clearAllIndicators': true,
  'host.clearAllDrawings': true,
  'host.setDrawingTool': true,
  'host.setChartPaneResizeFocus': true,
  'host.resize': true,
  'host.destroy': true,
  'host.layer.setSyncGroup': true,
  'host.layer.setVisible': true,
  'host.layer.setActivePage': true,
  'host.layer.setPreset': true,
  'host.layer.applyTimeScaleSync': true,
};

const EXPECTED_INBOUND = Object.keys(BRIDGE_INBOUND_CONTRACT) as BridgeInboundType[];

describe('@coderyo/bridge contract', () => {
  it('schema version is 2', () => {
    expect(BRIDGE_SCHEMA_VERSION).toBe(2);
  });

  it('BRIDGE_INBOUND_CONTRACT is exhaustive for BridgeInboundType', () => {
    const _parity: Record<BridgeInboundType, true> = BRIDGE_INBOUND_CONTRACT;
    expect(Object.keys(_parity).sort()).toEqual([...EXPECTED_INBOUND].sort());
    expect(EXPECTED_INBOUND).toHaveLength(25);
  });

  it('includes P2 host.setChartPaneResizeFocus', () => {
    expect(EXPECTED_INBOUND).toContain('host.setChartPaneResizeFocus');
  });

  it('layer host events match LAYER_HOST_EVENTS', () => {
    for (const t of LAYER_HOST_EVENTS) {
      expect(EXPECTED_INBOUND).toContain(t);
    }
    expect(LAYER_API_READY.hostEvents).toEqual([...LAYER_HOST_EVENTS]);
  });
});