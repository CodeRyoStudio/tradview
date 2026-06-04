# ADR: Bridge Schema 3 — Hard Cut

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-06-04 |
| Decision | `@coderyo/bridge@3.0.0` with **`bridgeSchemaVersion: 3`**; **no** schema 2 @ `core@2` GA |
| Related | [bridge-schema-3.md](./bridge-schema-3.md), [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md) |

---

## 1. Context

Bridge schema **2** (layer remote control, `chartId` on `host.layer.*`) shipped @ TradView 1.1.0. V2 requires **multi-chart workspaces** and **`chartId` on all host events**. Native hosts need a clear, testable major bump.

---

## 2. Decision

| Topic | Choice |
|-------|--------|
| Schema version | **`3`** |
| npm | `@coderyo/bridge` **`3.0.0`** — **independent** from monorepo `VERSION` (`INDEPENDENT_VERSION_PACKAGES`) |
| Negotiation | `chart.ready` advertises `bridgeSchemaVersion: 3` + `apiVersion: 2` |
| GA inbound | Schema **2** → `chart.error` **`UNSUPPORTED_BRIDGE_SCHEMA`** |
| `chartId` | Required on **every** `host.*` (not only layer family) |
| Workspace | New `host.workspace.*` + outbound `chart.workspace*` events |
| Types | `schema3-types.ts` + contract tests **before** runtime switch (V2-00b) |
| Migration doc | [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md) mirrors [MIGRATION-bridge-2.md](./MIGRATION-bridge-2.md) |

---

## 3. Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Schema 2 + optional fields | Ambiguous for native code generators |
| Dual support schema 2+3 @ GA | Doubles wire test matrix; violates KD-7 hard cut |
| Bump bridge without major | Breaking wire requires semver major |

---

## 4. Consequences

- Host apps must ship bridge 3 client before pointing WebView at `core@2` GA bundle
- Contract tests gate rc.1 (`schema3-contract.test.ts`)
- `core@2` + `bridge@2` explicitly unsupported (documented error path)

---

## 5. Status

**Proposed** — accept when V2-B3 lands runtime wire + native samples updated.