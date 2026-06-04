import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REST_ENVELOPE_TYPES_V11,
  REST_PROTOCOL_VERSION_V11,
  buildRestErrorEnvelopeV11,
  buildRestHistoryRequestEnvelopeV11,
  buildRestHistoryResponseEnvelopeV11,
  isRestEnvelopeV11,
  parseBarIssue,
  parseRestEnvelopeV11,
  parseRestErrorEnvelopeV11,
  parseRestHistoryRequestEnvelopeV11,
  parseRestHistoryResponseEnvelopeV11,
  restEnvelopeErrorToRestErrorBody,
  validateRestEnvelopeV11,
  type RestCapabilitiesEnvelopeV11,
  type RestHistoryResponseEnvelopeV11,
} from '../src/protocol/rest-envelope-v11.js';
import type { DataProviderCapabilities } from '../src/types.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'protocol-v11');

function loadFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as T;
}

describe('REST Envelope v1.1 (DESIGN-v2 §4.4)', () => {
  it('round-trips history.response success fixture', () => {
    const raw = loadFixture<unknown>('history.response.success.json');
    expect(isRestEnvelopeV11(raw)).toBe(true);

    const parsed = parseRestHistoryResponseEnvelopeV11(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const env = parsed.envelope;
    expect(env.version).toBe(REST_PROTOCOL_VERSION_V11);
    expect(env.type).toBe(REST_ENVELOPE_TYPES_V11.historyResponse);
    expect(env.ok).toBe(true);
    expect(env.data?.bars).toHaveLength(1);
    expect(env.data?.bars[0]).toMatchObject({
      t: 1718000000000,
      o: 1,
      h: 2,
      l: 0.5,
      c: 1.5,
      v: 100,
    });
    expect(env.data?.symbol).toBe('BINANCE:BTCUSDT');
    expect(env.data?.hasMore).toBe(true);
    expect(env.data?.nextCursor).toBe('opaque-cursor-string');

    const rebuilt = buildRestHistoryResponseEnvelopeV11(env.id, env.data!);
    expect(rebuilt).toEqual(env);
  });

  it('round-trips history.response error fixture via buildRestErrorEnvelopeV11', () => {
    const raw = loadFixture<unknown>('history.response.error.json');
    const parsed = parseRestErrorEnvelopeV11(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.envelope.ok).toBe(false);
    expect(parsed.envelope.error?.code).toBe('SYMBOL_NOT_FOUND');

    const rebuilt = buildRestErrorEnvelopeV11(
      REST_ENVELOPE_TYPES_V11.historyResponse,
      parsed.envelope.id,
      parsed.envelope.error!,
    );
    expect(rebuilt).toEqual(parsed.envelope);
    expect(parseRestErrorEnvelopeV11(rebuilt).ok).toBe(true);

    const flat = restEnvelopeErrorToRestErrorBody(parsed.envelope.error!);
    expect(flat.error.message).toContain('FAKE:PAIR');
  });

  it('maps retryAfterMs through restEnvelopeErrorToRestErrorBody', () => {
    const built = buildRestErrorEnvelopeV11(REST_ENVELOPE_TYPES_V11.historyResponse, 'req-rl', {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryAfterMs: 3000,
    });
    const flat = restEnvelopeErrorToRestErrorBody(built.error!);
    expect(flat.error.retryAfterMs).toBe(3000);
  });

  it('round-trips history.request fixture', () => {
    const raw = loadFixture<unknown>('history.request.json');
    const parsed = parseRestHistoryRequestEnvelopeV11(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.envelope.ok).toBeUndefined();
    expect(parsed.envelope.data?.symbol).toBe('BINANCE:BTCUSDT');

    const rebuilt = buildRestHistoryRequestEnvelopeV11(parsed.envelope.id, parsed.envelope.data!);
    expect(rebuilt).toEqual(parsed.envelope);
  });

  it('buildRestHistoryRequestEnvelopeV11 accepts range HistoryQuery', () => {
    const env = buildRestHistoryRequestEnvelopeV11('id-2', {
      mode: 'range',
      symbol: 'BINANCE:ETHUSDT',
      interval: '5m',
      from: 1,
      to: 2,
    });
    expect(parseRestHistoryRequestEnvelopeV11(env).ok).toBe(true);
  });

  it('parses capabilities fixture via validateRestEnvelopeV11', () => {
    const raw = loadFixture<RestCapabilitiesEnvelopeV11>('capabilities.json');
    const parsed = validateRestEnvelopeV11<DataProviderCapabilities>(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.envelope.type).toBe('capabilities');
    expect(parsed.envelope.data?.encoding).toEqual(['json', 'protobuf']);
    expect(parsed.envelope.data?.historyModes).toContain('loadMore');
  });

  it('rejects invalid envelope shells', () => {
    expect(parseRestEnvelopeV11({ version: '1.0', type: 'x', id: 'a' }).ok).toBe(false);
    expect(parseRestEnvelopeV11({ version: '1.1', type: '', id: 'a', ok: true }).ok).toBe(false);
    expect(
      parseRestEnvelopeV11({
        version: '1.1',
        type: 'history.response',
        id: 'a',
        ok: true,
        error: { code: 'X', message: 'y' },
      }).ok,
    ).toBe(false);
    expect(parseRestEnvelopeV11({ version: '1.1', type: 'x', id: '' }).ok).toBe(false);
    expect(parseRestEnvelopeV11({ version: '1.1', type: 'x', id: 'a', ok: 'yes' }).ok).toBe(false);
    expect(
      parseRestEnvelopeV11({
        version: '1.1',
        type: 'history.response',
        id: 'a',
        ok: false,
        data: { bars: [] },
      }).ok,
    ).toBe(false);
  });

  it('parseRestErrorEnvelopeV11 rejects ok:false without error', () => {
    const result = parseRestErrorEnvelopeV11({
      version: '1.1',
      type: 'history.response',
      id: 'a',
      ok: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContain('error is required when ok is false');
  });

  it.each([
    ['wrong type', { version: '1.1', type: 'capabilities', id: 'a', ok: true, data: { bars: [] } }],
    [
      'ok false',
      {
        version: '1.1',
        type: 'history.response',
        id: 'a',
        ok: false,
        data: { bars: [{ t: 1, o: 1, h: 1, l: 1, c: 1 }] },
      },
    ],
    [
      'non-array bars',
      { version: '1.1', type: 'history.response', id: 'a', ok: true, data: { bars: 'nope' } },
    ],
    [
      'invalid bar',
      {
        version: '1.1',
        type: 'history.response',
        id: 'a',
        ok: true,
        data: { bars: [{ t: 'x', o: 1, h: 1, l: 1, c: 1 }] },
      },
    ],
  ] as const)('parseRestHistoryResponseEnvelopeV11 rejects %s', (_label, value) => {
    const result = parseRestHistoryResponseEnvelopeV11(value);
    expect(result.ok).toBe(false);
  });

  it('parseBarIssue includes path in issue text', () => {
    expect(parseBarIssue({ t: 'bad' }, 'data.bars[0]')).toContain('data.bars[0]');
  });

  it('buildRestHistoryResponseEnvelopeV11 accepts HistoryResponse', () => {
    const env: RestHistoryResponseEnvelopeV11 = buildRestHistoryResponseEnvelopeV11('id-1', {
      symbol: 'BINANCE:ETHUSDT',
      interval: '5m',
      bars: [{ t: 1, o: 2, h: 3, l: 1, c: 2 }],
      hasMore: false,
    });
    expect(parseRestHistoryResponseEnvelopeV11(env).ok).toBe(true);
  });
});