# Migration: Bridge schema 2 → 3

Native WebView hosts and web integrators using `@coderyo/bridge` must upgrade before targeting TradView **`core@2` GA**. Schema 2 remains active in production code until **V2-B3**; this guide is the rc.1 contract gate.

| Field | Value |
|-------|-------|
| Status | **Draft** (V2-00b) |
| From | `@coderyo/bridge@2.0.0`, `bridgeSchemaVersion: 2` |
| To | `@coderyo/bridge@3.0.0`, `bridgeSchemaVersion: 3` |
| Chart API | `apiVersion: 1` → **`2`** (`TRADVIEW_API_VERSION`) |
| Contract | [bridge-schema-3.md](./bridge-schema-3.md) |
| Types | `packages/bridge/src/schema3-types.ts` |

---

## 1. Checklist

### 1.1 Read `chart.ready`

- [ ] Require `payload.bridgeSchemaVersion === 3`
- [ ] Require `payload.apiVersion === 2` (separate from bridge schema)
- [ ] Read `payload.workspaceId` and `payload.charts[]` for multi-chart UI
- [ ] Keep using `payload.layerApi` when present (same event lists as schema 2)
- [ ] Reject inbound posts that still send schema 2 shapes without `chartId` on non-layer events

### 1.2 Payload shape — chart scoping

- [ ] **Every** inbound `host.*` includes **`chartId`** in `payload` (schema 2 only required this for `host.layer.*`)
- [ ] `host.setSymbol`, `host.setInterval`, `host.setTheme`, `host.resize`, `host.destroy`, etc. — all scoped
- [ ] Layer events unchanged except now consistent with global `chartId` rule
- [ ] `host.layer.setSyncGroup` still uses **`pane`** + optional **`allPages`** — **no `layerId`**
- [ ] `host.layer.setPreset` still sends integer **`revision` ≥ 1**; handle `STALE_PRESET_REVISION`

### 1.3 Workspace (multi-chart) — new

- [ ] Implement `host.workspace.createChart` with `chartId` + `containerId` (DOM slot in WebView)
- [ ] Implement `host.workspace.destroyChart`
- [ ] Implement `host.workspace.setLinkGroup` with `groupId`, `chartIds[]`, `sync` flags
- [ ] Implement `host.workspace.setActiveChart` for focus
- [ ] Handle outbound `chart.workspaceReady`, `chart.focusChanged`, `chart.linkStateChanged`

### 1.4 Web registration (unchanged pattern)

- [ ] After `mountLayerCompositor` + workspace/chart create, register layer bridge per chart:

```typescript
import { wireChartBridge } from '@coderyo/core';
import { createLayerBridgeRegistration } from '@coderyo/ui-shell';

wireChartBridge({
  chart,
  controller,
  bridge,
  chartId: 'main',
  layerBridge: createLayerBridgeRegistration({
    chartId: 'main',
    chart,
    layerController: compositor.controller,
    compositorApply: () => compositor.apply(),
    syncCompositorShellVisibility: () =>
      layout.syncCompositorShellVisibility?.(compositor.controller),
  }),
});
```

Repeat registration for each `chartId` in the workspace.

### 1.5 Time-scale lazy apply

- [ ] `host.layer.applyTimeScaleSync` with `allPages: true` updates preset only; buses apply on first page visit
- [ ] Expect `chart.layerPageChanged` when switching pages
- [ ] Web clears lazy visit state on `host.setSymbol` / `host.setInterval` (per chartId)

### 1.6 Outbound deltas

- [ ] Subscribe to existing `chart.layer*` events
- [ ] Subscribe to new workspace events (debounce on native if needed)

### 1.7 Errors

- [ ] Handle `chart.error` codes in table below
- [ ] On schema 2 inbound @ GA: expect **`UNSUPPORTED_BRIDGE_SCHEMA`**
- [ ] On missing `chartId`: expect **`MISSING_CHART_ID`**

### 1.8 Unchanged from schema 2

- [ ] `host.setChartPaneResizeFocus` remains independent of link groups
- [ ] Symbol / interval / indicator / drawing semantics unchanged (see [API.md](./API.md))

---

## 2. Breaking changes summary

| # | Change | GA behavior |
|---|--------|-------------|
| 1 | Hard cut | Inbound negotiated as schema **2** → **`UNSUPPORTED_BRIDGE_SCHEMA`** |
| 2 | `chartId` | Required on **all** `host.*` |
| 3 | Workspace | New `host.workspace.*` + outbound workspace events |
| 4 | `chart.ready` | Adds `workspaceId`, `charts[]`; `apiVersion: 2` |
| 5 | Package | `@coderyo/bridge@3.0.0` — **not** synced from root `VERSION` |

---

## 3. Code examples

### 3.1 `chart.ready` (schema 3)

```json
{
  "type": "chart.ready",
  "payload": {
    "chartId": "main",
    "apiVersion": 2,
    "bridgeSchemaVersion": 3,
    "workspaceId": "default",
    "charts": [
      { "chartId": "main", "symbol": "BINANCE:BTCUSDT", "interval": "1h", "active": true }
    ]
  }
}
```

Fixture: `packages/bridge/tests/fixtures/schema3/chart-ready-v3.json`

### 3.2 `host.setSymbol` (schema 3 — note `chartId`)

```json
{
  "type": "host.setSymbol",
  "payload": {
    "chartId": "main",
    "symbol": "BINANCE:ETHUSDT"
  }
}
```

**Schema 2 (invalid @ GA)** — missing `chartId` on non-layer host events:

```json
{
  "type": "host.setSymbol",
  "payload": { "symbol": "BINANCE:ETHUSDT" }
}
```

→ `chart.error` **`MISSING_CHART_ID`**

### 3.3 `host.workspace.createChart`

```json
{
  "type": "host.workspace.createChart",
  "payload": {
    "chartId": "secondary",
    "containerId": "chart-slot-2"
  }
}
```

### 3.4 `host.workspace.setLinkGroup`

```json
{
  "type": "host.workspace.setLinkGroup",
  "payload": {
    "groupId": "crypto",
    "chartIds": ["main", "secondary"],
    "sync": { "symbol": true, "interval": true, "visibleRange": false, "crosshair": true }
  }
}
```

### 3.5 Outbound `chart.focusChanged`

```json
{
  "type": "chart.focusChanged",
  "payload": {
    "chartId": "secondary",
    "previousChartId": "main"
  }
}
```

---

## 4. Error codes

| Code | When | Host action |
|------|------|-------------|
| `UNSUPPORTED_BRIDGE_SCHEMA` | Host sends schema 2 (or wrong version) after GA cut | Upgrade bridge client to schema 3 |
| `MISSING_CHART_ID` | Any `host.*` without `chartId` | Add `chartId` to payload |
| `CHART_NOT_FOUND` | `chartId` not registered in workspace | Create chart first or fix id |
| `STALE_PRESET_REVISION` | `host.layer.setPreset` revision behind controller | Re-read preset / bump revision |
| `INVALID_PANE` | Bad `pane` on layer sync | Use `main` \| `volume` \| `indicator` |
| `LAYER_BRIDGE_NOT_REGISTERED` | Layer host event before registration | Call `createLayerBridgeRegistration` |
| `PANE_NOT_FOUND` | Target pane missing on chart | Check layout preset |
| `INVALID_PRESET` | Malformed preset merge | Validate against `LAYER_PRESET_VERSION` |
| `SCHEMA_MISMATCH` | Legacy generic mismatch | Align versions per [MIGRATION-2.0.md](./MIGRATION-2.0.md) matrix |

---

## 5. Package versions

| Package | Schema 2 line | Schema 3 line |
|---------|---------------|-----------------|
| `@coderyo/bridge` | **2.0.0** | **3.0.0** |
| `@coderyo/core` | 1.1.x | **2.0.0** |
| `@coderyo/ui-shell` | 1.1.x | **2.0.0** |
| `TRADVIEW_API_VERSION` | 1 | **2** |

---

## 6. Timeline

| Milestone | Bridge wire | Host action |
|-----------|-------------|-------------|
| **Now (1.1.1)** | Schema **2** active | Follow [MIGRATION-bridge-2.md](./MIGRATION-bridge-2.md) if still on schema 1 |
| **rc.1** | Schema 2 production; schema 3 **types + tests** | Implement against docs/fixtures |
| **V2-B3 / rc.3+** | Runtime schema **3** | Ship native + web hosts |
| **GA** | Hard cut schema 2 | Only schema 3 inbound |

---

## 7. References

- [bridge-schema-3.md](./bridge-schema-3.md)
- [ADR-v2-bridge-schema-3.md](./ADR-v2-bridge-schema-3.md)
- [MIGRATION-bridge-2.md](./MIGRATION-bridge-2.md)
- [examples/bridge-layer-sync.md](../examples/bridge-layer-sync.md)
- [ADR-bridge-layer-sync.md](./ADR-bridge-layer-sync.md)