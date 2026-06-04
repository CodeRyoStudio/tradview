# TradView Framework API Formalization Plan

> **Status**: L4 complete · **Date**: 2026-06-04  
> **Scope**: Integrator-facing public API (`apiVersion: 1.x`) — not renderer internals.

Related: [LAYER-COMPOSITOR-PLAN.md](./LAYER-COMPOSITOR-PLAN.md) (implementation), [API-LAYER.md](./API-LAYER.md) (layer chapter), [API.md](./API.md) (main reference).

---

## 1. Goals

| Goal | Outcome |
|------|---------|
| **Three-tier public API** | Stable chapters: `@coderyo/core` (chart) · `@coderyo/ui-shell` (layout shell) · layer/compositor (ui-shell, documented in API-LAYER) |
| **Layer surface fully public** | `LayerController`, editor, panel, preset store — formal exports + docs |
| **v2 layout primary** | `layoutPreset` + compositor documented; v1 12×12 grid **deprecated** in docs |
| **Embed contract honesty** | `apiVersion: 1.x` extensions; grouped sync via `bindLayerTimeScaleSync` / `IChart.applyTimeScaleSyncFromLayers` + `LayerController.setLayerSyncGroup` |
| **Bridge P2** | `host.setChartPaneResizeFocus`; `volumeMount` / P2 via `createChart` options (documented passthrough) |
| **Demo helpers frozen** | `createDemoLayoutOptions`, `createDemoChartOptions`, `mountLayerPanel`, … in [API-FREEZE.md](./API-FREEZE.md) |
| **Indicator layers dual path** | `@coderyo/indicators` helpers + `IChart.listIndicatorLayers()` / `disableIndicatorLayer(id)` + Bridge `host.setIndicatorConfig` |
| **L4 enforcement** | JSDoc `@public`, `package.json` exports whitelist, contract/snapshot tests |

---

## 2. Three-tier API map

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1 — @coderyo/core (MIT)                                │
│ createChart · IChart · ChartFeatures · wireChartBridge        │
│ Data via @coderyo/data (separate package)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 2 — @coderyo/ui-shell (commercial)                     │
│ mountChartLayout · layout features · v1 grid (deprecated)   │
│ handleDrawingSelection · syncCompositorShellVisibility      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Tier 3 — Layer / compositor (@coderyo/ui-shell)             │
│ mountLayerCompositor · LayerController · preset store         │
│ mountLayerPanel · layer editor · chart pane mounts          │
│ Full reference: docs/API-LAYER.md                           │
└─────────────────────────────────────────────────────────────┘
```

**Import rule**: only package root exports (`@coderyo/core`, `@coderyo/ui-shell`, `@coderyo/indicators`). No deep paths (`@coderyo/core/dist/...`).

---

## 3. Public surface tables (summary)

### Tier 1 — Core (`@coderyo/core`)

| Symbol | Kind | Notes |
|--------|------|-------|
| `createChart` | function | Primary entry |
| `IChart` | interface | All methods in API.md §3 |
| `listIndicatorLayers()` | method | Wraps `listActiveIndicatorLayers` |
| `disableIndicatorLayer(id)` | method | Wraps `@coderyo/indicators` |
| `setChartPaneResizeFocus` | method | P2 pane resize gate |
| `wireChartBridge` | function | Optional embed |
| `TRADVIEW_API_VERSION` | const | `1` |
| Indicator re-exports | functions | `clearedIndicatorConfig`, `listActiveIndicatorLayers`, … |

### Tier 2 — Shell (`@coderyo/ui-shell`)

| Symbol | Kind | Notes |
|--------|------|-------|
| `mountChartLayout` | function | Shell widgets + grid hosts |
| `createDemoLayoutOptions` | function | **Frozen** demo preset |
| `layerCompositorManaged` | option | Compositor drives legend visibility |
| `handleDrawingSelection` | callback helper | Drawing + properties panel |
| `syncCompositorShellVisibility` | optional fn | Shell ↔ compositor visibility |
| v1 `layout` / `layoutEditor` | options | **Deprecated** — use compositor |

### Tier 3 — Layer (see [API-LAYER.md](./API-LAYER.md))

| Symbol | Kind | Notes |
|--------|------|-------|
| `mountLayerCompositor` | function | |
| `LayerController` | class | `setLayerSyncGroup`, page CRUD |
| `bindLayerTimeScaleSync` | function | Chart ↔ controller time-scale sync |
| `mountLayerPanel` / `mountPageNavigator` | function | |
| `loadPreset` / `savePreset` / `forkPreset` / `resolvePreset` | persistence | |
| `BUILTIN_PRESETS`, `VENDOR_DEFAULT_PRESET` | constants | |
| `DEFAULT_SYNC_TIME_SCALE_GROUP` | const | Optional integrator default; not auto-filled by `normalize` |
| `IChart.applyTimeScaleSyncFromLayers(layers, pageId?)` | method (core) | Scoped pane sync groups |

---

## 4. Bridge additions (P2)

| Direction | type | payload |
|-----------|------|---------|
| Native → Web | `host.setChartPaneResizeFocus` | `{ pane: 'main' \| 'volume' \| 'indicator' \| 'all' }` |

**Grouped time-scale sync**: set `syncTimeScaleGroupId` on chart pane layers; call `bindLayerTimeScaleSync(chart, controller)` once after compositor + chart mount (or manually `chart.applyTimeScaleSyncFromLayers` after preset changes); `LayerController.setLayerSyncGroup(layerId, groupId)` for UI edits.

**P2 createChart passthrough** (document only — set at mount):

- `volumeMount: HTMLElement` — empty container for volume pane
- `indicatorHost: HTMLElement` — MACD/RSI/KDJ host

---

## 5. v1 grid deprecation

| API | Status | Migration |
|-----|--------|-----------|
| `layout` / `layoutEditor` / `LayoutSchema` v1 | **Deprecated** in docs | `mountLayerCompositor` + `LayoutPreset` v2 |
| `chartHost` on layout handle | Alias of `chartMain` | Mount LWC on `chartMain` with compositor |
| `createLayoutGrid` | Internal / legacy | Preset + compositor |

P5: Playground / `layerCompositorManaged` use compositor shell (no grid positioning). v1 `createLayoutGrid` remains for non-compositor embeds and `layoutSchemaToPreset` migration only.

---

## 6. L4 checklist

- [x] `docs/API-FRAMEWORK-PLAN.md` (this document)
- [x] `docs/API-LAYER.md` — layer chapter (author/forkPreset/layoutSchemaToPreset aligned)
- [x] `docs/API.md` — v2 primary quick-start; IChart indicator methods; compositor hooks
- [x] `docs/API-FREEZE.md` — frozen demo helpers, P2 bridge, preset store exports
- [x] `docs/EMBEDDING.md` — v2-first mount order
- [x] JSDoc `@public` on tier-1/3 entry points + IChart indicator methods
- [x] `package.json` `exports` — single public entry `"."` per package
- [x] `packages/core/tests/public-exports.test.ts`
- [x] `packages/ui-shell/tests/public-exports.test.ts` — full runtime allowlist
- [x] `packages/indicators/tests/public-exports.test.ts`
- [x] `packages/bridge/tests/contract.test.ts` — exhaustive inbound parity
- [x] `indicator-layers.test.ts` — null `indicators` + bridge dispatch
- [x] `syncTimeScaleGroupId` on chart pane layers + `bindLayerTimeScaleSync` / `applyTimeScaleSyncFromLayers` documented in API-LAYER

---

## 7. PR breakdown (suggested)

| PR | Content |
|----|---------|
| **PR-API-1** | Design plan + API-LAYER.md + API.md / FREEZE / EMBEDDING |
| **PR-API-2** | IChart indicator wrappers + core re-exports + `@public` JSDoc |
| **PR-API-3** | Bridge `host.setChartPaneResizeFocus` + contract tests |
| **PR-API-4** | Export snapshot tests + CI filter test commands |

---

## 8. Verification

```bash
pnpm --filter @coderyo/core test
pnpm --filter @coderyo/ui-shell test
pnpm --filter @coderyo/bridge test
pnpm --filter @coderyo/indicators test
```

Build before type consumers: `pnpm --filter @coderyo/core build` (if dist stale).