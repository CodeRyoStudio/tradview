import { describe, expect, it } from 'vitest';
import type { BridgeInboundType, BridgeLayerInboundType, BridgeOutboundType } from '../src/events.js';
import {
  BRIDGE_SCHEMA_VERSION,
  LAYER_API_READY,
  LAYER_HOST_EVENTS,
  LAYER_OUTBOUND_EVENTS,
  LAYER_PRESET_VERSION,
  bridgeLayerPayloadHasDeprecatedLayerId,
  isBridgeLayerInboundType,
} from '../src/events.js';

/** Every schema-2 `host.layer.*` inbound event (exhaustive parity with events.ts). */
const EXPECTED_INBOUND_SCHEMA2: Record<BridgeLayerInboundType, true> = {
  'host.layer.setSyncGroup': true,
  'host.layer.setVisible': true,
  'host.layer.setActivePage': true,
  'host.layer.setPreset': true,
  'host.layer.applyTimeScaleSync': true,
};

const EXPECTED_LAYER_INBOUND = Object.keys(EXPECTED_INBOUND_SCHEMA2) as BridgeLayerInboundType[];

describe('bridge schema 2 layer events', () => {
  it('BRIDGE_SCHEMA_VERSION is 2', () => {
    expect(BRIDGE_SCHEMA_VERSION).toBe(2);
  });

  it('LAYER_HOST_EVENTS matches EXPECTED_INBOUND_SCHEMA2 exhaustively', () => {
    const fromModule = [...LAYER_HOST_EVENTS].sort();
    const expected = [...EXPECTED_LAYER_INBOUND].sort();
    expect(fromModule).toEqual(expected);
    expect(LAYER_HOST_EVENTS).toHaveLength(5);
    const _parity: Record<BridgeLayerInboundType, true> = EXPECTED_INBOUND_SCHEMA2;
    expect(Object.keys(_parity).sort()).toEqual(expected);
  });

  it('LAYER_OUTBOUND_EVENTS lists delta layer events', () => {
    expect([...LAYER_OUTBOUND_EVENTS].sort()).toEqual(
      [
        'chart.layerSyncGroupChanged',
        'chart.layerPageChanged',
        'chart.layerVisibleChanged',
      ].sort(),
    );
  });

  it('LAYER_API_READY advertises host and outbound layer events', () => {
    expect(LAYER_API_READY.presetVersion).toBe(LAYER_PRESET_VERSION);
    expect([...LAYER_API_READY.hostEvents].sort()).toEqual([...EXPECTED_LAYER_INBOUND].sort());
    expect([...LAYER_API_READY.outboundLayerEvents].sort()).toEqual(
      [...LAYER_OUTBOUND_EVENTS].sort(),
    );
  });

  it('BridgeInboundType union includes all layer host events', () => {
    const sample: BridgeInboundType[] = [...EXPECTED_LAYER_INBOUND];
    expect(sample).toHaveLength(5);
  });

  it('BridgeOutboundType union includes layer outbound events', () => {
    const sample: BridgeOutboundType[] = [...LAYER_OUTBOUND_EVENTS];
    expect(sample).toHaveLength(3);
  });

  it('isBridgeLayerInboundType recognizes host.layer.* only', () => {
    for (const t of EXPECTED_LAYER_INBOUND) {
      expect(isBridgeLayerInboundType(t)).toBe(true);
    }
    expect(isBridgeLayerInboundType('host.setSymbol')).toBe(false);
    expect(isBridgeLayerInboundType('host.layer.unknown')).toBe(false);
  });

  it('rejects deprecated layerId in setSyncGroup payloads', () => {
    expect(bridgeLayerPayloadHasDeprecatedLayerId({ layerId: 'x', pane: 'main' })).toBe(true);
    expect(bridgeLayerPayloadHasDeprecatedLayerId({ pane: 'main' })).toBe(false);
    expect(bridgeLayerPayloadHasDeprecatedLayerId(undefined)).toBe(false);
  });
});