import { describe, expect, it } from 'vitest';
import {
  decodeWsProtobufEnvelope,
  encodeWsProtobufEnvelope,
  resetWsProtobufCodecForTests,
} from '../src/protocol/ws-protobuf-codec.js';
import type { Envelope } from '../src/types.js';

describe('ws-protobuf-codec negative paths (PR-02b-2)', () => {
  it('rejects encode for unsupported WS type', async () => {
    const bad: Envelope = { v: '1.0', type: 'not.a.real.type', payload: {} };
    await expect(encodeWsProtobufEnvelope(bad)).rejects.toThrow(/Unsupported WS type/);
  });

  it('throws when decoding truncated protobuf bytes', async () => {
    const subscribe = {
      v: '1.0',
      id: 'c-10',
      type: 'subscribe',
      ts: 1710000000000,
      payload: { symbol: 'X', interval: '1m', channels: ['bar'], streamMode: 'bar' },
    } satisfies Envelope;
    const bytes = await encodeWsProtobufEnvelope(subscribe);
    const truncated = bytes.subarray(0, Math.max(1, bytes.byteLength - 4));
    await expect(decodeWsProtobufEnvelope(truncated)).rejects.toThrow();
  });

  it('can reset cached proto root between loads', async () => {
    const ping: Envelope = { v: '1.0', type: 'ping', payload: {} };
    await encodeWsProtobufEnvelope(ping);
    resetWsProtobufCodecForTests();
    const roundTrip = await decodeWsProtobufEnvelope(await encodeWsProtobufEnvelope(ping));
    expect(roundTrip.type).toBe('ping');
    expect(roundTrip.payload).toEqual({});
  });
});