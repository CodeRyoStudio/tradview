/**
 * Static proto ↔ TypeScript parity metadata (PR-02b-1).
 * Runtime protobuf encode/decode: `ws-protobuf-codec.ts` (PR-02b-2).
 */

/** JSON ↔ proto field mapping for Bar (tradview.ws.Bar). */
export const PROTO_BAR_FIELD_MAP = {
  t: { proto: 1, json: 't', ts: 't' },
  o: { proto: 2, json: 'o', ts: 'o' },
  h: { proto: 3, json: 'h', ts: 'h' },
  l: { proto: 4, json: 'l', ts: 'l' },
  c: { proto: 5, json: 'c', ts: 'c' },
  v: { proto: 6, json: 'v', ts: 'v', optional: true },
} as const;

/** JSON ↔ proto field mapping for Capabilities (tradview.ws.Capabilities). */
export const PROTO_CAPABILITIES_FIELD_MAP = {
  historyModes: { proto: 1, json: 'historyModes', protoName: 'history_modes' },
  realtimeModes: { proto: 2, json: 'realtimeModes', protoName: 'realtime_modes' },
  wsHistory: { proto: 3, json: 'wsHistory', protoName: 'ws_history', optional: true },
  symbolSearch: { proto: 4, json: 'symbolSearch', protoName: 'symbol_search', optional: true },
  encoding: { proto: 5, json: 'encoding', protoName: 'encoding', optional: true },
} as const;

/** WS Envelope shell (tradview.ws.Envelope). */
export const PROTO_WS_ENVELOPE_FIELD_MAP = {
  v: { proto: 1, json: 'v', ts: 'v' },
  id: { proto: 2, json: 'id', ts: 'id', optional: true },
  type: { proto: 3, json: 'type', ts: 'type' },
  ts: { proto: 4, json: 'ts', ts: 'ts', optional: true },
} as const;

/** oneof `body` arm → WS `type` string (PR-02b-2 codec must keep in sync). */
export const PROTO_WS_ENVELOPE_BODY_TYPE_MAP = {
  subscribe: 'subscribe',
  subscribe_ok: 'subscribe.ok',
  unsubscribe: 'unsubscribe',
  unsubscribe_ok: 'unsubscribe.ok',
  history_request: 'history.request',
  history_response: 'history.response',
  bar: 'bar',
  tick: 'tick',
  capabilities: 'capabilities',
  error: 'error',
  auth: 'auth',
  auth_ok: 'auth.ok',
  auth_refresh: 'auth.refresh',
  pong: 'pong',
  ping: 'ping',
} as const;

export type ProtoWsEnvelopeBodyArm = keyof typeof PROTO_WS_ENVELOPE_BODY_TYPE_MAP;

/** All non-trivial messages declared in tradview.proto (parity test). */
export const PROTO_REQUIRED_MESSAGES = [
  'Bar',
  'Capabilities',
  'SubscribePayload',
  'SubscribeOkPayload',
  'UnsubscribePayload',
  'UnsubscribeOkPayload',
  'HistoryRequestPayload',
  'HistoryResponsePayload',
  'Tick',
  'BarPushPayload',
  'TickPushPayload',
  'AuthPayload',
  'AuthOkPayload',
  'AuthRefreshPayload',
  'ProtocolErrorPayload',
  'EmptyPayload',
  'Envelope',
] as const;