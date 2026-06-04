import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  decodeWsProtobufEnvelope,
  encodeWsProtobufEnvelope,
} from '../src/protocol/ws-protobuf-codec.js';
import type { BarPushPayload, Envelope, HistoryResponsePayload, SubscribePayload } from '../src/types.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'protocol-v11');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as T;
}

/** Fixed-length snapshot for `ws.subscribe.envelope.json` (proto3 deterministic wire). */
const WS_SUBSCRIBE_PROTO_BYTE_LENGTH = 62;

const HISTORY_RESPONSE_ENVELOPE: Envelope<HistoryResponsePayload> = {
  v: '1.0',
  id: 'hist-1',
  type: 'history.response',
  ts: 1710000001000,
  payload: {
    bars: [{ t: 1718000000000, o: 1, h: 2, l: 0.5, c: 1.5, v: 100 }],
    hasMore: true,
  },
};

const BAR_PUSH_ENVELOPE: Envelope<BarPushPayload> = {
  v: '1.0',
  type: 'bar',
  ts: 1710000002000,
  payload: {
    subscriptionId: 'sub-golden-1',
    bar: { t: 1718000000000, o: 1, h: 2, l: 0.5, c: 1.5, v: 100 },
    partial: true,
    barSeq: '42',
  },
};

describe('WS protobuf golden (PR-02b-2)', () => {
  it('encodes ws.subscribe fixture to a fixed byte length', async () => {
    const subscribe = loadFixture<Envelope<SubscribePayload>>('ws.subscribe.envelope.json');
    const bytes = await encodeWsProtobufEnvelope(subscribe);
    expect(bytes.byteLength).toBe(WS_SUBSCRIBE_PROTO_BYTE_LENGTH);
  });

  it('round-trips subscribe JSON → proto → JSON', async () => {
    const subscribe = loadFixture<Envelope<SubscribePayload>>('ws.subscribe.envelope.json');
    const roundTrip = await decodeWsProtobufEnvelope(await encodeWsProtobufEnvelope(subscribe));
    expect(roundTrip).toEqual(subscribe);
  });

  it('round-trips history.response', async () => {
    const roundTrip = await decodeWsProtobufEnvelope(
      await encodeWsProtobufEnvelope(HISTORY_RESPONSE_ENVELOPE),
    );
    expect(roundTrip).toEqual(HISTORY_RESPONSE_ENVELOPE);
  });

  it('round-trips bar push', async () => {
    const roundTrip = await decodeWsProtobufEnvelope(await encodeWsProtobufEnvelope(BAR_PUSH_ENVELOPE));
    expect(roundTrip).toEqual(BAR_PUSH_ENVELOPE);
  });
});