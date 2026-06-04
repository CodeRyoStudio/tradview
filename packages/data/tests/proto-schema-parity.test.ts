import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PROTO_BAR_FIELD_MAP,
  PROTO_CAPABILITIES_FIELD_MAP,
  PROTO_REQUIRED_MESSAGES,
  PROTO_WS_ENVELOPE_BODY_TYPE_MAP,
  PROTO_WS_ENVELOPE_FIELD_MAP,
} from '../src/protocol/proto-schema.js';
import type {
  Bar,
  BarPushPayload,
  DataProviderCapabilities,
  Envelope,
  HistoryRequestPayload,
  HistoryResponsePayload,
  SubscribeOkPayload,
  SubscribePayload,
} from '../src/types.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const protoPath = join(pkgRoot, 'proto', 'tradview.proto');
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'protocol-v11');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as T;
}

describe('proto schema parity (PR-02b-1 — no runtime codec)', () => {
  const protoSource = readFileSync(protoPath, 'utf8');

  it('tradview.proto exists and declares required messages', () => {
    expect(protoSource).toContain('package tradview.ws;');
    for (const name of PROTO_REQUIRED_MESSAGES) {
      expect(protoSource).toMatch(new RegExp(`message ${name}\\s*\\{`));
    }
  });

  it('documents Bar field numbers matching types.ts Bar', () => {
    const barKeys = Object.keys(PROTO_BAR_FIELD_MAP) as (keyof Bar)[];
    expect(barKeys).toEqual(['t', 'o', 'h', 'l', 'c', 'v']);

    for (const [key, meta] of Object.entries(PROTO_BAR_FIELD_MAP)) {
      expect(protoSource).toMatch(new RegExp(`${key}\\s*=\\s*${meta.proto};`));
    }
  });

  it('documents Capabilities field numbers matching DataProviderCapabilities', () => {
    for (const meta of Object.values(PROTO_CAPABILITIES_FIELD_MAP)) {
      expect(protoSource).toMatch(new RegExp(`${meta.protoName}\\s*=\\s*${meta.proto};`));
    }
  });

  it('documents Envelope shell fields matching Envelope<T>', () => {
    for (const meta of Object.values(PROTO_WS_ENVELOPE_FIELD_MAP)) {
      expect(protoSource).toMatch(new RegExp(`${meta.json}\\s*=\\s*${meta.proto};`));
    }
    expect(protoSource).toContain('oneof body');
  });

  it.each(Object.entries(PROTO_WS_ENVELOPE_BODY_TYPE_MAP))(
    'proto oneof contains arm %s for WS type %s',
    (arm, wsType) => {
      expect(protoSource).toMatch(new RegExp(`${arm}\\s*=\\s*\\d+;`));
      expect(wsType.length).toBeGreaterThan(0);
    },
  );

  it('auth_refresh arm matches mock auth.refresh handler', () => {
    expect(PROTO_WS_ENVELOPE_BODY_TYPE_MAP.auth_refresh).toBe('auth.refresh');
    expect(protoSource).toContain('AuthRefreshPayload');
    expect(protoSource).toContain('auth_refresh = 24');
  });

  it('ws.subscribe fixture satisfies Envelope<SubscribePayload>', () => {
    const msg = loadFixture<Envelope<SubscribePayload>>('ws.subscribe.envelope.json');
    expect(msg.v).toBe('1.0');
    expect(msg.type).toBe('subscribe');
    expect(msg.id).toBe('c-10');
    expect(msg.payload.symbol).toBe('BINANCE:BTCUSDT');
    expect(msg.payload.interval).toBe('1m');
    expect(msg.payload.channels).toEqual(['bar']);
    expect(msg.payload.streamMode).toBe('bar');
    expect(protoSource).toContain('stream_mode');

    expect(msg.type).toBe(PROTO_WS_ENVELOPE_BODY_TYPE_MAP.subscribe);
  });

  it('history REST data may be wider than WS HistoryResponsePayload', () => {
    const history = loadFixture<{ data: { bars: Bar[]; symbol?: string; nextCursor?: string } }>(
      'history.response.success.json',
    );
    const wsPayload: HistoryResponsePayload = { bars: history.data.bars, hasMore: true };
    expect(wsPayload.bars).toHaveLength(1);
    expect(history.data.symbol).toBeDefined();
    expect(history.data.nextCursor).toBeDefined();
  });

  it('history.request REST fixture aligns with HistoryRequestPayload semantics', () => {
    const req = loadFixture<{ data: HistoryRequestPayload }>('history.request.json');
    expect(req.data.from).toBeLessThan(req.data.to);
    expect(protoSource).toContain('HistoryRequestPayload');
  });

  it('capabilities fixture aligns with DataProviderCapabilities + proto Capabilities', () => {
    const capFixture = loadFixture<{ data: DataProviderCapabilities }>('capabilities.json');
    const data = capFixture.data;
    expect(data.historyModes.length).toBeGreaterThan(0);
    expect(data.realtimeModes).toContain('bar');
    expect(data.encoding).toContain('protobuf');
  });

  it('TS payload types cover proto history/subscribe shapes', () => {
    const historyReq: HistoryRequestPayload = {
      symbol: 'X',
      interval: '1h',
      from: 0,
      to: 1,
    };
    const historyRes: HistoryResponsePayload = { bars: [{ t: 1, o: 1, h: 1, l: 1, c: 1 }], hasMore: false };
    const subOk: SubscribeOkPayload = {
      subscriptionId: 's1',
      symbol: 'X',
      interval: '1m',
    };
    const barPush: BarPushPayload = {
      subscriptionId: 's1',
      bar: { t: 1, o: 1, h: 1, l: 1, c: 1 },
      barSeq: '42',
    };

    expect(historyReq.from).toBeLessThan(historyReq.to);
    expect(historyRes.bars).toHaveLength(1);
    expect(subOk.subscriptionId).toBe('s1');
    expect(barPush.barSeq).toBe('42');
    expect(protoSource).toContain('subscription_id');
    expect(protoSource).toContain('has_more');
    expect(protoSource).toContain('bar_seq');
  });

  it('documents that protobuf encode/decode is deferred to PR-02b-2', () => {
    expect(protoSource).toContain('PR-02b-2');
  });
});