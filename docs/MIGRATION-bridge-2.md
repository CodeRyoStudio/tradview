# Migration: Bridge schema 1 → 2

Native WebView hosts must upgrade before pointing at TradView **1.1.0** bundles. Schema 1 layer APIs are **not** advertised in `chart.ready`.

## Checklist

### 1. Read `chart.ready`

- [ ] Require `payload.bridgeSchemaVersion === 2`
- [ ] Use `payload.layerApi.hostEvents` for inbound layer control (do not hard-code event lists)
- [ ] Keep using `apiVersion` (TradView chart API, still **1**) separately from bridge schema

### 2. Payload shape

- [ ] Every `host.layer.*` message includes **`chartId`** in `payload` (no wire fallback)
- [ ] `host.layer.setSyncGroup` uses **`pane`** (`main` | `volume` | `indicator`) + optional **`allPages`** — **no `layerId`**
- [ ] Clear sync group with **`groupId: ""`**
- [ ] `host.layer.setPreset` sends full or partial `preset` with integer **`revision` ≥ 1**; handle `STALE_PRESET_REVISION`

### 3. Web registration

- [ ] After `mountLayerCompositor` + `createChart`, register layer bridge:

```typescript
import { wireChartBridge } from '@coderyo/core';
import { createLayerBridgeRegistration } from '@coderyo/ui-shell';

wireChartBridge({
  chart,
  controller,
  bridge,
  chartId: 'default',
  layerBridge: createLayerBridgeRegistration({
    chartId: 'default',
    chart,
    layerController: compositor.controller,
    compositorApply: () => compositor.apply(),
    syncCompositorShellVisibility: () =>
      layout.syncCompositorShellVisibility?.(compositor.controller),
  }),
});
```

### 4. Time-scale lazy apply

- [ ] `host.layer.applyTimeScaleSync` with `allPages: true` updates preset only; buses apply when each page is first visited
- [ ] Expect `chart.layerPageChanged` when switching pages
- [ ] Web clears lazy visit state on `host.setSymbol` / `host.setInterval`

### 5. Outbound deltas (optional)

- [ ] Subscribe to `chart.layerSyncGroupChanged`, `chart.layerVisibleChanged`, `chart.layerPageChanged`
- [ ] Debounce on native side if needed (Web posts immediately)

### 6. Errors

- [ ] Handle `chart.error` codes: `MISSING_CHART_ID`, `CHART_NOT_FOUND`, `LAYER_BRIDGE_NOT_REGISTERED`, `INVALID_PANE`, `PANE_NOT_FOUND`, `INVALID_PRESET`, `STALE_PRESET_REVISION`, `SCHEMA_MISMATCH`

### 7. Unchanged from schema 1

- [ ] `host.setChartPaneResizeFocus` remains independent of sync groups
- [ ] Symbol / interval / indicator / drawing host events unchanged (see [API.md](./API.md))

## Package versions

| Package | Version |
|---------|---------|
| `@coderyo/bridge` | **2.0.0** (major) |
| `@coderyo/core`, `@coderyo/ui-shell` | **1.1.0** |
| `TRADVIEW_API_VERSION` | **1** (unchanged) |

## References

- [ADR-bridge-layer-sync.md](./ADR-bridge-layer-sync.md)
- [API-LAYER.md §10](./API-LAYER.md)
- [examples/bridge-layer-sync.md](../examples/bridge-layer-sync.md)