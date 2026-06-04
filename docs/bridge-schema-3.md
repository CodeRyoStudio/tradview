# Bridge Schema 3 — Contract

| Field | Value |
|-------|-------|
| Status | **Proposed** (V2-00b skeleton; runtime wire @ V2-B3) |
| Package | `@coderyo/bridge@3.0.0` |
| `BRIDGE_SCHEMA_VERSION` | **3** (constant: `BRIDGE_SCHEMA_VERSION_V3` in code) |
| Chart API | `apiVersion: 2` |
| GA rule | Inbound schema **≠ 3** → `UNSUPPORTED_BRIDGE_SCHEMA` |
| Type source | [`packages/bridge/src/schema3-types.ts`](../packages/bridge/src/schema3-types.ts) |

> Narrative: [DESIGN-v2.md](./DESIGN-v2.md) §4.5 · Migration: [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md) · ADR: [ADR-v2-bridge-schema-3.md](./ADR-v2-bridge-schema-3.md)

**Production note**: `packages/bridge/src/events.ts` exports `BRIDGE_SCHEMA_VERSION = 3` (@ V2-B3). `@coderyo/bridge` npm **`3.0.0-rc.1`**.

---

## 1. Version negotiation

| Field | Schema 2 | Schema 3 |
|-------|----------|----------|
| `bridgeSchemaVersion` in `chart.ready` | `2` | **`3`** |
| `apiVersion` in `chart.ready` | `1` | **`2`** |
| `@coderyo/bridge` npm | `2.0.0` | **`3.0.0`** |

---

## 2. Outbound events

### 2.1 `chart.ready` (required fields)

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `chartId` | ✓ | `string` | Primary chart id for this WebView instance |
| `apiVersion` | ✓ | `2` | `TRADVIEW_API_VERSION` |
| `bridgeSchemaVersion` | ✓ | `3` | Must match host expectation |
| `workspaceId` | ✓ | `string` | Workspace scope (default `"default"`) |
| `charts` | ✓ | `ChartSummary[]` | All charts in workspace |
| `layerApi` | optional | `LayerApiReady` | Same lists as schema 2 (`LAYER_API_READY`) |

#### `ChartSummary`

| Field | Required | Type |
|-------|----------|------|
| `chartId` | ✓ | `string` |
| `symbol` | optional | `string` |
| `interval` | optional | `string` |
| `active` | optional | `boolean` |

#### Example

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

---

### 2.2 Workspace lifecycle (new)

| type | When | payload |
|------|------|---------|
| `chart.workspaceReady` | Workspace mounted; all slots known | `{ workspaceId, charts[] }` |
| `chart.focusChanged` | Active chart changed | `{ chartId, previousChartId? }` |
| `chart.linkStateChanged` | Link group updated | `{ groupId, chartIds, sync }` |

#### `sync` (`LinkSyncFlags`)

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `boolean?` | Mirror symbol changes |
| `interval` | `boolean?` | Mirror interval |
| `visibleRange` | `boolean?` | Fan-out visible range (per-chart buses) |
| `crosshair` | `boolean?` | Crosshair linkage |

---

### 2.3 Layer deltas (unchanged from schema 2)

| type | payload summary |
|------|-----------------|
| `chart.layerSyncGroupChanged` | pane sync group delta |
| `chart.layerPageChanged` | active page id |
| `chart.layerVisibleChanged` | layer visibility |

Advertised in optional `layerApi.outboundLayerEvents`.

---

### 2.4 Other outbound (unchanged family)

`chart.resize`, `chart.symbol`, `chart.interval`, `chart.visibleRange`, `chart.crosshair`, `chart.barUpdate`, `chart.error`, `chart.destroyed`, `chart.connectionChange` — payloads gain no breaking field removals; hosts should scope handlers by `chartId` when present in future deltas.

---

## 3. Inbound events

### 3.1 `host.workspace.*` (new)

| type | Required payload | Description |
|------|------------------|-------------|
| `host.workspace.createChart` | `chartId`, `containerId` | Host provides DOM container id inside WebView |
| `host.workspace.destroyChart` | `chartId` | Tear down chart instance |
| `host.workspace.setLinkGroup` | `groupId`, `chartIds[]`, `sync` | Link group definition |
| `host.workspace.setActiveChart` | `chartId` | Focus chart |

Constants: `WORKSPACE_HOST_EVENTS` in `schema3-types.ts`.

---

### 3.2 Chart-scoped `host.*` (schema 3 change)

**Every** inbound event below **must** include `chartId` in `payload`.

| type | Notes |
|------|-------|
| `host.setSymbol` | Symbol change |
| `host.setInterval` | Interval change |
| `host.setTheme` | Theme |
| `host.setShowGrid` | Grid visibility |
| `host.fitContent` | Fit content |
| `host.scrollToRealtime` | Scroll to realtime |
| `host.setLogScale` | Log scale |
| `host.setBarSpace` | Bar spacing |
| `host.setVisibleRange` | Visible range |
| `host.scrollToTimestamp` | Scroll to timestamp |
| `host.reloadHistory` | Reload history |
| `host.setLocale` | Locale |
| `host.setFeatures` | Feature flags |
| `host.setIndicatorConfig` | Indicator config |
| `host.clearAllIndicators` | Clear indicators |
| `host.clearAllDrawings` | Clear drawings |
| `host.setDrawingTool` | Drawing tool |
| `host.setChartPaneResizeFocus` | Pane resize focus |
| `host.resize` | Container resize |
| `host.destroy` | Destroy chart |
| `host.layer.setSyncGroup` | Layer sync (schema 2 semantics) |
| `host.layer.setVisible` | Layer visibility |
| `host.layer.setActivePage` | Active page |
| `host.layer.setPreset` | Preset merge + revision |
| `host.layer.applyTimeScaleSync` | Lazy / immediate time-scale sync |

Constants: `SCHEMA3_CHART_SCOPED_HOST_EVENTS` (25 events) in `schema3-types.ts`.

**Schema 2 gap**: only `host.layer.*` required `chartId`; schema 3 extends to all host events.

---

## 4. Error codes

| code | When |
|------|------|
| `UNSUPPORTED_BRIDGE_SCHEMA` | Inbound `bridgeSchemaVersion !== 3` @ GA (includes schema **2**) |
| `MISSING_CHART_ID` | Any `host.*` missing `chartId` |
| `CHART_NOT_FOUND` | `chartId` not registered in workspace |
| `STALE_PRESET_REVISION` | `host.layer.setPreset` revision stale |
| `INVALID_PANE` | Invalid `pane` on layer sync |

Type export: `BridgeSchema3ErrorCode` · constant `BRIDGE_SCHEMA3_ERROR_CODES`.

Additional errors from schema 2 layer wiring may still surface (`LAYER_BRIDGE_NOT_REGISTERED`, `INVALID_PRESET`, `PANE_NOT_FOUND`, `SCHEMA_MISMATCH`) — see [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md) §4.

---

## 5. Tests

| File | Purpose |
|------|---------|
| `packages/bridge/tests/schema3-contract.test.ts` | Types + fixtures vs this doc |
| `packages/bridge/tests/layer-events.schema2.test.ts` | Schema 2 layer parity (unchanged) |
| `packages/bridge/tests/contract.test.ts` | Schema 2 inbound exhaustive list |

Planned @ V2-B3: `schema3-events.test.ts` (runtime wire, mirrors layer schema2 tests).

---

## 6. References

- [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md)
- [MIGRATION-2.0.md](./MIGRATION-2.0.md)
- [API-LAYER.md](./API-LAYER.md)