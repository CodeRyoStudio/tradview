# TradView Layer & Compositor API

> **Package**: `@coderyo/ui-shell` (Tier 3) · **Preset version**: `2` (`LAYER_PRESET_VERSION`)  
> **Main chart API**: [API.md](./API.md) · **Plan**: [API-FRAMEWORK-PLAN.md](./API-FRAMEWORK-PLAN.md)

Layer compositor replaces the legacy **12×12 CSS grid** (`LayoutSchema` v1) for integrators building TradingView-style floating layouts. See [LAYER-COMPOSITOR-PLAN.md](./LAYER-COMPOSITOR-PLAN.md) for delivery phases.

---

## 1. Mount order (v2-first)

```typescript
import { createChart } from '@coderyo/core';
import {
  mountChartLayout,
  mountLayerCompositor,
  mountLayerPanel,
  VENDOR_DEFAULT_PRESET,
  cloneLayoutPreset,
} from '@coderyo/ui-shell';

const layout = mountChartLayout(root, {
  layerCompositorManaged: true,
  showTopBar: true,
  onIntervalChange: (i) => chartRef.current?.setInterval(i),
});

const compositor = mountLayerCompositor(layout.layoutRoot, {
  preset: cloneLayoutPreset(VENDOR_DEFAULT_PRESET),
  widgets: {
    chartMain: layout.chartMain,
    chartVolume: layout.chartVolume,
    chartIndicator: layout.indicatorHost,
    topBar: layout.topBar,
    // … other shell widgets as needed
  },
  hideLegacyGrid: layout.layoutGrid,
  onChartPaneFocus: (pane) => {
    if (pane) chartRef.current?.setChartPaneResizeFocus(pane);
  },
});

const chart = createChart(layout.chartMain, {
  dataProvider,
  volumeMount: layout.chartVolume,
  indicatorHost: layout.indicatorHost,
});

layout.syncCompositorShellVisibility?.(compositor.controller);
mountLayerPanel(document.body, compositor.controller);
```

**Rules**

- `volumeMount` must be an **empty** element; LWC mounts inside after compositor positions it.
- Do **not** call `createChart` on legacy `chartHost` when using compositor — use `chartMain`.
- After preset drag/resize: `chart.setChartPaneResizeFocus('all')` then `chart.resize()` if needed.

---

## 2. Data model

### `LayoutPreset` (v2)

| Field | Type | Description |
|-------|------|-------------|
| `version` | `2` | Preset format version |
| `id` | `string` | Unique preset id |
| `name` | `string` | Display name |
| `author` | `'integrator' \| 'user'` | Template origin |
| `readonly` | `boolean?` | Vendor templates may be read-only |
| `forkedFrom` | `string?` | Source preset id when user-saved |
| `pages` | `Page[]` | Mobile/desktop pages (`{ id, title }`) |
| `layers` | `LayerNode[]` | Positioned widgets |
| `groups` | `BindGroup[]` | Group move/resize/lock |

### `LayerNode`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Layer id |
| `pageId` | `string` | Owning page |
| `type` | `LayerType` | `shell.*`, `chart.main` / `volume` / `indicator`, `overlay.crosshairLegend`, `overlay.drawing` |
| `widgetKey` | `LayerWidgetKey` | DOM slot key |
| `frame` | `LayerFrame` | `{ x, y, w, h }` in 0..1 relative coords |
| `zIndex` | `number` | Stacking order |
| `visible` | `boolean` | Layer visibility |
| `locked` | `boolean` | Edit lock |

| `syncTimeScaleGroupId` | `string?` | Chart panes only. Same non-empty id → pan/zoom/loadMore viewport shared via one `TimeScaleBus`; omit or `''` → **independent** pane (own bus). Indicator pane uses its layer’s id (MACD/RSI/KDJ follow `chart.indicator`). |

**Integrator wiring (recommended):** after `createChart` + `mountLayerCompositor`, call once:

```typescript
import { bindLayerTimeScaleSync } from '@coderyo/ui-shell';

const unbind = bindLayerTimeScaleSync(chart, compositor.controller, {
  onSync: () => requestAnimationFrame(() => chart.resize()),
});
```

This applies `IChart.applyTimeScaleSyncFromLayers(preset.layers, controller.activePageId)` immediately and on every `LayerController` mutation (preset edits, page switch, `setLayerSyncGroup`, etc.). The optional `pageId` scopes pane picks to that page (required for multi-page presets). Manual alternative: `chart.applyTimeScaleSyncFromLayers(preset.layers, activePageId)` after each change.

`LayerController.setLayerSyncGroup(layerId, groupId)` updates preset metadata (`''` clears). `DEFAULT_SYNC_TIME_SCALE_GROUP` (`'chart-timescale'`) is an **optional** constant for integrator defaults — `normalizeLayoutPreset` does **not** auto-fill sync groups (empty/omit = independent pane).

### Multi-page (P4) — layout-only

`PageNavigator` + `LayerController.setActivePage` switch which `pageId` layers the compositor mounts. This is a **layout preset** feature: one chart instance (Playground uses a single `createChart`). Inactive pages’ layers are not mounted; switching pages does **not** spawn separate LWC workspaces. `bindLayerTimeScaleSync` covers page changes via `controller.subscribe`; add `onPageChange` only for shell visibility / resize side effects.

### Overlay layers (P3)

| Type | DOM | Notes |
|------|-----|-------|
| `overlay.crosshairLegend` | Compositor wrap + `crosshairLegend` widget | `pointer-events: none` on wrap and element |
| `overlay.drawing` | **Not** double-mounted | Logical layer; canvas stays on `chartMain`. Frame synced to `chart.main` via `syncOverlayLayersToMain(layers, pageId)`. Toggle visibility in the layer panel → wire `chart.setFeatures({ drawings: { layer: visible } })` (see Playground). |

### `LayerFrame`

Normalized to `[0, 1]` per page root. Compositor applies `left/top/width/height` as percentages.

---

## 3. `mountLayerCompositor`

```typescript
function mountLayerCompositor(
  parent: HTMLElement,
  opts: LayerCompositorOptions,
): LayerCompositorHandle;
```

### `LayerCompositorOptions`

| Field | Type | Description |
|-------|------|-------------|
| `preset` | `LayoutPreset` | Initial layout |
| `widgets` | `LayerWidgetElements` | Map of `widgetKey` → root `HTMLElement` |
| `hideLegacyGrid` | `HTMLElement?` | Hide v1 grid when compositor active |
| `onPresetChange` | `(preset) => void` | After user edit commits |
| `onMarqueeSelect` | `(layerIds) => void` | Shift+drag multi-select |
| `onChartPaneFocus` | `(pane) => void` | `'main' \| 'volume' \| 'indicator' \| null` |

### `LayerCompositorHandle`

| Member | Description |
|--------|-------------|
| `root` | Compositor container |
| `controller` | `LayerController` instance |
| `apply()` | Re-apply frames to DOM |
| `enableLayerEditor(enabled)` | Toggle drag/resize handles |
| `isLayerEditorEnabled()` | Editor state |
| `destroy()` | Teardown |

---

## 4. `LayerController`

Mutable view over a `LayoutPreset`. Emits on structural changes.

| Method | Returns | Description |
|--------|---------|-------------|
| `getPreset()` | `LayoutPreset` | Deep clone of current preset |
| `setPreset(next)` | `boolean` | Replace preset (blocked during interaction) |
| `getLayersForActivePage()` | `LayerNode[]` | Sorted by z-index |
| `getLayer(id)` | `LayerNode \| undefined` | Lookup |
| `setLayerVisible(id, visible)` | `void` | Toggle visibility |
| `setLayerLocked(id, locked)` | `void` | Toggle lock |
| `moveLayer(id, frame)` | `void` | Update frame |
| `focusChartPane(layerId)` | `void` | Raise chart pane z-index + focus |
| `getFocusedPaneId()` | `'main' \| 'volume' \| 'indicator' \| null` | Active chart pane |
| `subscribe(fn)` | `() => void` | Preset change listener |
| `subscribeFocus(fn)` | `() => void` | Pane focus listener |

Group helpers (`moveGroup`, `resizeGroup`, …) operate on `BindGroup` entries — see source `group-utils.ts`.

---

## 5. Preset store

| Export | Description |
|--------|-------------|
| `BUILTIN_PRESETS` | Vendor templates map |
| `VENDOR_DEFAULT_PRESET` | Default Playground layout |
| `cloneLayoutPreset(p)` | Immutable clone |
| `normalizeLayoutPreset(raw)` | Validate + clamp |
| `presetStorageKey(id)` | `localStorage` key |
| `loadPreset(id)` | Load user/vendor preset |
| `savePreset(preset)` | Persist |
| `listPresets()` | Builtin + user index |
| `resolvePreset(id)` | Builtin or stored preset |
| `forkPreset(sourceId, newId, newName)` | User "save as"; returns `LayoutPreset \| null` |

Storage keys: `tradview:preset:v2:{id}` · index `tradview:preset:v2:index`.

---

## 6. Layer panel & editor

### `mountLayerPanel(parent, controller, opts?)`

| Option | Description |
|--------|-------------|
| `onSaveAsPreset` | User "Save as" → new preset |

Returns `LayerPanelHandle` with `destroy()`.

### Layer editor

Attached inside `mountLayerCompositor` via `enableLayerEditor(true)`. Supports drag, resize, marquee, group transforms. Disabled when layer `locked`.

---

## 7. Shell integration (`mountChartLayout`)

When `layerCompositorManaged: true`:

| Handle member | Role |
|---------------|------|
| `chartMain` | LWC main price pane mount |
| `chartVolume` | Volume pane (`volumeMount`) |
| `indicatorHost` | Indicator panes |
| `layoutGrid` | Legacy grid (hidden by compositor) |
| `handleDrawingSelection` | Drawing properties + compositor-safe visibility |
| `bindLayerCompositorController` | One-time bind after `mountLayerCompositor`; `setLayoutFeatures` then syncs shell/legend `visible` |
| `syncCompositorShellVisibility` | Maps `showTopBar`, `showLeftToolbar`, `showBottomToolbar`, `showStatusBar`, `showPropertiesPanel`, `showCrosshairLegend` to layer `visible` (does **not** override `overlay.drawing` panel toggles) |

---

## 8. Chart pane layer types

`CHART_PANE_LAYER_TYPES`: `chart.main`, `chart.volume`, `chart.indicator`.

Helpers in `chart-pane-mount.ts` build default pane layers for a preset. Integrators normally use `VENDOR_DEFAULT_PRESET`. One-time v1 grid migration: `layoutSchemaToPreset()` from **`@coderyo/ui-shell/migrate`**.

---

## 9. Migration from v1 grid

| v1 | v2 |
|----|-----|
| `layout: LayoutSchema` | `preset: LayoutPreset` + compositor |
| `layoutEditor: true` | `compositor.enableLayerEditor(true)` |
| `layoutPersist` + `layoutId` | `savePreset` / `loadPreset` |
| `getLayoutSchema()` | `controller.getPreset()` |

```typescript
import { layoutSchemaToPreset, loadLayoutSchema } from '@coderyo/ui-shell/migrate';

const preset = layoutSchemaToPreset(loadLayoutSchema('default') ?? undefined);
```

`layoutSchemaToPreset(schema)` converts a v1 schema to v2 for one-time migration (not on the main `@coderyo/ui-shell` export).

---

## 10. Bridge schema 2 (`host.layer.*`)

Remote layer control uses **`bridgeSchemaVersion: 2`** (`@coderyo/bridge@2.0.0`). `chart.ready` includes `layerApi` with `hostEvents` / `outboundLayerEvents`.

| Web API | Bridge |
|---------|--------|
| `LayerController.setLayerSyncGroup` | `host.layer.setSyncGroup` (`pane`, `allPages`; no `layerId`) |
| `LayerController.setLayerVisible` | `host.layer.setVisible` |
| `LayerController.setActivePage` | `host.layer.setActivePage` |
| `LayerController.setPreset` / `mergeLayoutPreset` | `host.layer.setPreset` (`revision`, `replace`) |
| `bindLayerTimeScaleSync` / `applyTimeScaleSyncFromLayers` | `host.layer.applyTimeScaleSync` |

Register after compositor mount:

```typescript
import { wireChartBridge } from '@coderyo/core';
import { createLayerBridgeRegistration } from '@coderyo/ui-shell';
import type { ChartLayerBridgeRegistration } from '@coderyo/core';

const chartId = 'default';

const layerBridge: ChartLayerBridgeRegistration = createLayerBridgeRegistration({
  chartId,
  chart,
  layerController: compositor.controller,
  compositorApply: () => compositor.apply(),
  syncCompositorShellVisibility: () =>
    layout.syncCompositorShellVisibility?.(compositor.controller),
});

wireChartBridge({ chart, controller, bridge, chartId, layerBridge });
```

`createLayerBridgeRegistration` wraps `LayerController` → `LayerBridgeController` and defaults `normalizePreset` / `mergePreset` to `normalizeLayoutPreset` / `mergeLayoutPreset`. Override those fields only when you need custom merge rules.

**Integrator note:** Bridge wire types use `LayerBridgePreset` (core); ui-shell uses `LayoutPreset` (v2). The helper applies a deliberate cast between the two shapes — they share the same JSON fields (`pages`, `layers`, `groups`, `revision`). Custom `normalizePreset` / `mergePreset` overrides must accept/return `LayerBridgePreset` and perform their own validation if you bypass ui-shell helpers.

`LayoutPreset.revision` (integer ≥ 1) guards against stale remote presets (`STALE_PRESET_REVISION`). `host.setSymbol` / `host.setInterval` clear lazy time-scale visit state.

Examples: [examples/bridge-layer-sync.md](../examples/bridge-layer-sync.md) · Migration: [MIGRATION-bridge-2.md](./MIGRATION-bridge-2.md) · ADR: [ADR-bridge-layer-sync.md](./ADR-bridge-layer-sync.md)

---

## 11. Related exports (allowlist)

See `packages/ui-shell/tests/public-exports.test.ts` for the full frozen export set. Primary symbols:

`bindLayerTimeScaleSync`, `createLayerBridgeRegistration`, `wrapLayerController`, `mountLayerCompositor`, `LayerController`, `mountLayerPanel`, `mountPageNavigator`, `forkPreset`, `resolvePreset`, `deleteUserPreset`, `presetStorageKey`, `loadPreset`, `savePreset`, `listPresets`, `syncOverlayLayersToMain`, `syncAllOverlayLayersToMain`, `syncCompositorShellVisibilityFromFeatures`, `getDrawingOverlayVisible`, `BUILTIN_PRESETS`, `VENDOR_DEFAULT_PRESET`, `cloneLayoutPreset`, `normalizeLayoutPreset`, `LAYER_PRESET_VERSION` — main entry allowlist: `packages/ui-shell/tests/public-exports.test.ts`. Migration (`layoutSchemaToPreset`, v1 schema helpers): `packages/ui-shell/tests/migrate-exports.test.ts`.

---

## 12. See also

| Doc | Content |
|-----|---------|
| [API.md](./API.md) | `createChart`, Bridge, indicators |
| [EMBEDDING.md](./EMBEDDING.md) | Feature matrix + mount order |
| [API-FREEZE.md](./API-FREEZE.md) | Frozen demo helpers |