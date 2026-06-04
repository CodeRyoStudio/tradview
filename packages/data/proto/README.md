# TradView protocol (Protobuf)

**Single source of truth** for v1.1 WS binary encoding. TypeScript types in `packages/data/src/types.ts` and REST v1.1 envelopes in `src/protocol/rest-envelope-v11.ts` must stay aligned with this file.

## Layout

| Artifact | Role |
|----------|------|
| `tradview.proto` | `tradview.ws` messages: `Bar`, `Capabilities`, subscribe/history payloads, `Envelope` |
| `src/types.ts` | JSON WS envelope + payload shapes (`Envelope<T>`, `Bar`, …) |
| `src/entry-client.ts` | WS/REST clients + protobuf codec (`@coderyo/data/client`; omitted from main entry for browser bundles) |
| `src/protocol/rest-envelope-v11.ts` | REST v1.1 only: `{ version, type, id, ok, data?, error? }` (DESIGN-v2 §4.4) |
| `tests/fixtures/protocol-v11/` | Golden JSON for fixture round-trips (no runtime codec in PR-02b-1) |

## JSON vs Protobuf

### WebSocket (§8.1 / §8.11)

JSON frames use the flat envelope:

```json
{ "v": "1.0", "id": "c-10", "type": "subscribe", "ts": 1710000000000, "payload": { ... } }
```

Protobuf frames (PR-02b-2) use `tradview.ws.Envelope` with the same logical fields. The populated `oneof body` arm corresponds to `payload` in JSON; `type` must match (e.g. `subscribe` → `SubscribePayload`).

Subprotocol: `tradview-protobuf` (negotiated with `Sec-WebSocket-Protocol`; default remains JSON).

### REST (v1.0 vs v1.1)

| Version | Body shape | Header |
|---------|------------|--------|
| **1.0** | Flat JSON (`HistoryResponse`, `RestErrorBody`) | `X-TradView-Protocol-Version: 1.0` |
| **1.1** | `RestEnvelopeV11` | `X-TradView-Protocol-Version: 1.1` |

v1.1 success example (DESIGN-v2 §4.4):

```json
{
  "version": "1.1",
  "type": "history.response",
  "id": "req-uuid",
  "ok": true,
  "data": { "bars": [{ "t": 1718000000000, "o": 1, "h": 2, "l": 0.5, "c": 1.5, "v": 100 }] }
}
```

REST v1.1 is **not** the same wire shape as WS JSON (`v` / `payload`); only semantics (bars, errors, capabilities) align.

## Field naming

| Layer | Convention |
|-------|------------|
| `.proto` | `snake_case` field names |
| JSON / TypeScript | `camelCase` (see parity table in `tradview.proto` comments) |

## PR staging

| PR | Scope |
|----|--------|
| **PR-02b-1** (this tree) | `.proto`, TS types, JSON fixtures, parity tests; npm `files` includes `proto/**` |
| **PR-02b-2** | **`protobufjs`** runtime codec (`ws-protobuf-codec.ts`), `TradViewWsClient` protobuf mode, `ChartFeatures.protobuf` wiring |

Runtime loads `tradview.proto` via `protobufjs` (no protoc/codegen in CI). Subprotocols: `tradview-json` (default), `tradview-protobuf`.