# Migrating to TradView 2.0.0

| Field | Value |
|-------|-------|
| Status | **Active @ 2.0.0-rc.2** (V2-00b + **§5 layout gate satisfied** — PR-L7b landed; expand before GA) |
| From | `@coderyo/*@1.1.x`, `TRADVIEW_API_VERSION=1`, Bridge schema **2** |
| To | `@coderyo/*@2.0.0`, `TRADVIEW_API_VERSION=2`, `@coderyo/bridge@3.0.0` schema **3** |
| Authoritative plan | [DESIGN-v2.md](./DESIGN-v2.md) |

---

## 1. Overview

TradView **2.0.0** is a **semver major** for the monorepo packages (`@coderyo/core`, `@coderyo/ui-shell`, `@coderyo/data`, renderers, etc.) with **independent** `@coderyo/bridge@3.0.0`. Integrators must upgrade **npm versions**, **embed API version**, **renderer backend**, **layout model**, and (for native hosts) **Bridge schema** together per the matrix below.

**Do not** combine `core@2` with `bridge@2` at GA — inbound schema 2 is rejected with `UNSUPPORTED_BRIDGE_SCHEMA`.

---

## 2. npm version matrix

| Package | v1.1.1 | v2 GA | Notes |
|---------|--------|-------|-------|
| `@coderyo/core` | `1.1.x` | **`2.0.0`** | `TRADVIEW_API_VERSION` → **2** |
| `@coderyo/ui-shell` | `1.1.x` | **`2.0.0`** | peer `core@2`; **not** imported by core |
| `@coderyo/data` | `1.1.x` | **`2.0.0`** | JSON default; Protobuf opt-in |
| `@coderyo/bridge` | **`2.0.0`** (schema 2) | **`3.0.0`** (schema 3) | **Independent semver** — see `INDEPENDENT_VERSION_PACKAGES` in `scripts/sync-versions.mjs` |
| `@coderyo/renderer-webgl` | stub | **`2.0.0`** | **Required** @ GA (`features.renderer: 'webgl'`) |
| `@coderyo/renderer-lite` | `1.1.x` | **`2.0.0`** | RC-only fallback via `features.renderer: 'lite'` |
| `tradview.min.js` (CDN) | `1.x` tag | **`2.0.0`** tag | UMD embeds core+bridge; gzip ≤ 400 KB |

### 2.1 `package.json` target (GA)

```json
{
  "dependencies": {
    "@coderyo/core": "^2.0.0",
    "@coderyo/ui-shell": "^2.0.0",
    "@coderyo/data": "^2.0.0",
    "@coderyo/bridge": "^3.0.0",
    "@coderyo/renderer-webgl": "^2.0.0"
  }
}
```

### 2.2 Invalid combinations @ GA

| Combination | Result |
|-------------|--------|
| `core@2` + `bridge@2` | `chart.error` **`UNSUPPORTED_BRIDGE_SCHEMA`** |
| `core@1` + `bridge@3` | Unsupported — docs guarantee **core 2 + bridge 3** only |
| Public v1 **12×12 grid** API @ GA | Removed — use compositor preset (PR-L7b) |

---

## 3. Embed API (`TRADVIEW_API_VERSION`)

| Constant | v1.1.x | v2 GA |
|----------|--------|-------|
| `TRADVIEW_API_VERSION` | `1` | **`2`** |
| `chart.ready` `apiVersion` | `1` | **`2`** |

### 3.1 Breaking / planned changes (see [API-FREEZE-2.0.md](./API-FREEZE-2.0.md))

- `ChartFeatures.renderer`: `'webgl' | 'lite'` — default **`webgl`** @ GA
- `ChartFeatures.protobuf`: opt-in after backend supports v1.1 Envelope + `tradview-protobuf` WS subprotocol
- `ChartWorkspace` + multi-chart linkage (V2-A) — new public API in `@coderyo/core`
- Grid layout public exports removed @ **2.0.0-rc.2** (PR-L7b)

### 3.2 `chart.ready` payload (GA)

```json
{
  "type": "chart.ready",
  "payload": {
    "chartId": "main",
    "apiVersion": 2,
    "bridgeSchemaVersion": 3,
    "workspaceId": "default",
    "charts": [{ "chartId": "main", "symbol": "BINANCE:BTCUSDT", "interval": "1h" }]
  }
}
```

Full Bridge fields: [bridge-schema-3.md](./bridge-schema-3.md) · host migration: [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md).

---

## 4. Renderer phases

| Phase | Milestone | Integrator impact |
|-------|-----------|-------------------|
| `phase_stub` | v1 (done) | No WebGL product path |
| `phase_alpha` | V2-R1–R4b, **rc.1** | Use **`apps/playground/webgl-demo.html`** — not `createChart` + webgl |
| `phase_beta` | V2-R5–R8 | Indicator panes + LOD in standalone demo |
| `phase_gamma` | V2-R9–R11 | Drawing overlay in demo |
| `phase_full` | V2-R12 @ W14, GA | `createChart` default **`features.renderer: 'webgl'`**; CDN drops LWC-primary path |

### 4.1 RC playground expectations

| RC | Playground / core |
|----|-------------------|
| **rc.1** | Standalone WebGL demo only |
| **rc.2** | Optional `?renderer=webgl` experiment (default lite) |
| **rc.4** | Playground default `features.renderer: 'webgl'` |
| **GA** | `createChart` default webgl; lite only via explicit flag |

### 4.2 `ChartFeatures` (incremental)

| Field | v1.1.1 | rc.1 | rc.4 | GA |
|-------|--------|------|------|-----|
| `renderer` | *absent* | *use demo route* | `'lite'\|'webgl'`, default `lite` | default **`webgl`** |
| `protobuf` | `false` | `false` | opt-in | `false` (JSON default) |
| `debugWebGL` | *absent* | `false` | `false` | shader logs when `true` |

---

## 5. Layout — PR-L7 three-phase timeline

Compositor v2 (`LayoutPreset`, `mountLayerCompositor`, `layerCompositorManaged: true`) is the **only** supported public layout model @ GA.

| Phase | PR | Version line | Public API |
|-------|-----|--------------|------------|
| **a — deprecate** | PR-L7a | `1.1.2+` | `@deprecated` on grid exports; one-time `console.warn` at legacy **mount** entry points (`createLayoutGrid()` direct call; `mountChartLayout` when `layerCompositorManaged !== true`) |
| **b — remove** | PR-L7b | **`2.0.0-rc.2`** ✓ | Delete public grid API; ship `@coderyo/ui-shell/migrate` (`layoutSchemaToPreset`) |
| **c — enforce** | PR-L7c | **`2.0.0` GA** | `mountChartLayout` requires `layerCompositorManaged: true` (**enforced @ rc.2**; GA = freeze/docs) |

### 5.1 Migration checklist (layout)

- [ ] Set `layerCompositorManaged: true` on chart mount options
- [ ] Replace `createLayoutGrid` / `DEFAULT_LAYOUT_SCHEMA` with `LayoutPreset` + compositor
- [ ] Run `layoutSchemaToPreset` once if persisting legacy 12×12 grid JSON — `import { … } from '@coderyo/ui-shell/migrate'`
- [ ] Register Bridge layer API via `createLayerBridgeRegistration` (unchanged pattern from 1.1.x)

See [LAYER-COMPOSITOR-PLAN.md](./LAYER-COMPOSITOR-PLAN.md), [ADR-v2-layout-pr-l7.md](./ADR-v2-layout-pr-l7.md).

---

## 6. Data protocol (optional @ GA)

| Topic | v1.1.x | v2 |
|-------|--------|-----|
| Default encoding | JSON | **JSON** (unchanged default) |
| Protobuf | Not wired | `features.protobuf: true` + `tradview-protobuf` subprotocol |
| REST/WS | v1.0 JSON | v1.1 Envelope semantics; golden tests in `@coderyo/data` |

Enable Protobuf only after your gateway implements v1.1 — see [ADR-v2-protobuf-parallel.md](./ADR-v2-protobuf-parallel.md).

---

## 7. Bridge schema 3

Bridge upgrades are **documented separately** because `@coderyo/bridge` uses an independent major version.

- Contract: [bridge-schema-3.md](./bridge-schema-3.md)
- Host checklist: [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md)
- ADR: [ADR-v2-bridge-schema-3.md](./ADR-v2-bridge-schema-3.md)

**Gate (rc.1)**: types in `packages/bridge/src/schema3-types.ts` + contract tests must pass before runtime wire switch (V2-B3).

---

## 8. CI / release gates

| Gate | v1.1.x RC | v2.0.0 / 2.0.0-rc.N |
|------|-----------|---------------------|
| `pnpm check:cdn-size` | ✓ | ✓ |
| `pnpm check:lwc-size` | ✓ | **Skipped** in `check-rc` (WebGL-primary) |
| `pnpm arch:boundary` | ✓ (V2-00) | ✓ — `core` must not depend on `ui-shell` |

---

## 9. Master migration checklist

### npm & build

- [ ] Bump `@coderyo/core`, `ui-shell`, `data`, `renderer-webgl` to `^2.0.0`
- [ ] Bump `@coderyo/bridge` to `^3.0.0` (not `2.x`)
- [ ] Remove direct dependency on v1-only grid helpers (post PR-L7b)
- [ ] Re-run `pnpm build` / typecheck in CI

### Web embed

- [ ] Handle `chart.ready` `apiVersion: 2` and `bridgeSchemaVersion: 3`
- [ ] Add `chartId` to **every** `host.*` message (see bridge migration)
- [ ] Set `features.renderer` explicitly during RC; omit @ GA for webgl default
- [ ] Enable compositor-managed layout

### Native WebView

- [ ] Complete [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md) checklist
- [ ] Update Kotlin/Swift samples when `apps/sample-*` land (V2 productization)

### Backend (optional)

- [ ] Protobuf Envelope + WS subprotocol if using `features.protobuf`

---

## 10. References

- [DESIGN-v2.md](./DESIGN-v2.md) — full 18-week plan (option C)
- [API-FREEZE-2.0.md](./API-FREEZE-2.0.md) — planned 2.0 freeze (draft)
- [MIGRATION-bridge-2.md](./MIGRATION-bridge-2.md) — prior bridge 1→2 migration
- [RELEASE.md](./RELEASE.md) — RC tagging (`pnpm check:rc`)