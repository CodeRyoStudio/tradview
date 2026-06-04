# ADR: V2 Data Protocol — JSON Default, Protobuf Parallel

| Field | Value |
|-------|-------|
| Status | **Proposed** |
| Date | 2026-06-04 |
| Decision | Ship **Protobuf v1.1** alongside JSON; **default remains JSON** @ GA (KD-5) |
| Related | [DESIGN-v2.md](./DESIGN-v2.md) §4.4, PR-02b |

---

## 1. Context

v1.1.x uses JSON REST/WS only. Enterprise integrators requested binary WS for bandwidth. V2 adds `packages/data/proto/tradview.proto` and golden tests without forcing all hosts to upgrade backends on day one.

---

## 2. Decision

| Topic | Choice |
|-------|--------|
| Default encoding | **JSON** (`features.protobuf` default `false`) |
| Opt-in | `ChartFeatures.protobuf: true` + WS subprotocol `tradview-protobuf` |
| Semantics | Protobuf **Envelope** mirrors JSON subscribe/history semantics |
| Testing | Golden: same logical `subscribe` JSON vs proto byte length fixtures |
| Capabilities | Document `encoding: ['json','protobuf']` @ v2; wire unchanged until host enables |

---

## 3. PR-02b staging

| Stage | Deliverable |
|-------|-------------|
| rc.1–rc.2 | Proto definitions + golden tests (no gateway requirement) |
| rc.3+ | Reference gateway adapter optional |
| GA | JSON default; Protobuf for new backends |

---

## 4. Consequences

- No breaking change for existing JSON-only integrators
- Backend teams must implement Envelope before enabling `protobuf` in production
- [MIGRATION-2.0.md](./MIGRATION-2.0.md) §6 documents enablement steps

---

## 5. Status

**Proposed** — accept when PR-02b golden tests merge and API-FREEZE-2.0 lists `protobuf` field.