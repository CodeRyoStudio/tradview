import { describe, expect, it } from 'vitest';
import type { BridgeInboundType } from '../src/events.js';
import {
  BRIDGE_INBOUND_EVENTS,
  BRIDGE_SCHEMA_VERSION,
  LAYER_API_READY,
  LAYER_HOST_EVENTS,
} from '../src/events.js';

/** Every BridgeInboundType must be listed (exhaustive contract). */
const BRIDGE_INBOUND_CONTRACT: Record<BridgeInboundType, true> = Object.fromEntries(
  BRIDGE_INBOUND_EVENTS.map((t) => [t, true]),
) as Record<BridgeInboundType, true>;

const EXPECTED_INBOUND = [...BRIDGE_INBOUND_EVENTS] as BridgeInboundType[];

describe('@coderyo/bridge contract', () => {
  it('schema version is 3 (V2-B3)', () => {
    expect(BRIDGE_SCHEMA_VERSION).toBe(3);
  });

  it('BRIDGE_INBOUND_EVENTS is exhaustive for BridgeInboundType', () => {
    const _parity: Record<BridgeInboundType, true> = BRIDGE_INBOUND_CONTRACT;
    expect(Object.keys(_parity).sort()).toEqual([...EXPECTED_INBOUND].sort());
    expect(BRIDGE_INBOUND_EVENTS).toHaveLength(25);
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