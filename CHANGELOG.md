# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **PR-02b-1 (`@coderyo/data`)**: `packages/data/proto/tradview.proto` (`tradview.ws.Envelope`, `Bar`, subscribe/history/capabilities/auth payloads incl. `auth_refresh`); REST v1.1 `RestEnvelopeV11` types + parsers/builders (`validateRestEnvelopeV11`, `history.request` fixture); JSON fixtures under `tests/fixtures/protocol-v11/`; parity tests; `proto/**` shipped in npm `files`; `DESIGN.md` §8.2 errata → DESIGN-v2 §4.4 REST wire shape. **No** WS protobuf codec or `ChartFeatures.protobuf` wiring (PR-02b-2).
- **V2 foundation (V2-00 / V2-00b)**: `scripts/rc-version-gates.mjs` + `check-rc` skips `check:lwc-size` when `VERSION` is `2.0.0` or `2.0.0-rc.N`; `scripts/check-rc.test.mjs`; `pnpm arch:boundary` (`packages/core/tests/arch-boundary.test.ts`)

## [1.1.2] - 2026-06-04

### `@coderyo/ui-shell` — PR-L7a (layout deprecation)

- **`@deprecated` JSDoc** on v1 12×12 grid public exports (`createLayoutGrid`, `LayoutSchema`, schema helpers, `layoutSchemaToPreset`) and grid-related `ChartLayoutOptions` / return helpers
- **One-time `console.warn` per session** at legacy mount entry points: direct `createLayoutGrid()`; `mountChartLayout` when `layerCompositorManaged !== true` (nested grid warn suppressed — single mount message)
- **Migration link** in warn strings: [MIGRATION-2.0.md §5](https://github.com/CodeRyoStudio/tradview/blob/main/docs/MIGRATION-2.0.md#5-layout--pr-l7-three-phase-timeline)
- **Tests**: `packages/ui-shell/tests/layout-deprecation.test.ts`, `vitest.setup.ts` (session warn reset)

### Added (monorepo / V2 foundation)

- **Bridge schema 3 skeleton**: `packages/bridge/src/schema3-types.ts`, `schema3-contract.test.ts`, JSON fixtures under `packages/bridge/tests/fixtures/schema3/`
- **Docs**: expanded [MIGRATION-2.0.md](./docs/MIGRATION-2.0.md), [MIGRATION-bridge-3.md](./docs/MIGRATION-bridge-3.md), [bridge-schema-3.md](./docs/bridge-schema-3.md); draft [API-FREEZE-2.0.md](./docs/API-FREEZE-2.0.md)
- **ADR stubs (Proposed)**: [ADR-v2-renderer-webgl.md](./docs/ADR-v2-renderer-webgl.md), [ADR-v2-bridge-schema-3.md](./docs/ADR-v2-bridge-schema-3.md), [ADR-v2-layout-pr-l7.md](./docs/ADR-v2-layout-pr-l7.md), [ADR-v2-protobuf-parallel.md](./docs/ADR-v2-protobuf-parallel.md)

### Note

- Production Bridge wire remains **schema 2** (`BRIDGE_SCHEMA_VERSION = 2`) until V2-B3; no `TRADVIEW_SKIP_LWC_SIZE` env (removed from V2 plan per DESIGN-v2 §10)

## [1.1.1] - 2026-06-04

### Added

- **`createLayerBridgeRegistration` / `wrapLayerController`** (`@coderyo/ui-shell`) for Bridge schema 2 layer registration
- **Prepend compensation (§10.4.1)**: `compensatePrependForBuses` wired from `ChartController.maybeLoadMore`; exports `buildSliceTimes`, `computePrependSliceDeltaForViewport`, `compensatePrependOnRegistry`
- **docs**: [MIGRATION-bridge-2.md](./docs/MIGRATION-bridge-2.md); Android/Kotlin in [examples/bridge-layer-sync.md](./examples/bridge-layer-sync.md)
- **Tests**: §10.4 contract tests (`time-scale-prepend-crosshair`, `time-scale-multi-pane-sync`, `prepend-compensation`)

### Changed

- **`TimeScaleBus.compensatePrependLogicalRange`**: ms→slice fallback when LWC returns null logical range; validates `referenceChart` membership

## [1.1.0] - 2026-06-04

### Added

- **Layer compositor v2**: multi-page layouts, `bindLayerTimeScaleSync`, grouped pane time-scale sync (`resolvePaneSyncGroupsFromLayers`)
- **Bridge schema 2** (`@coderyo/bridge@2.0.0`): `host.layer.*` remote layer control (preset merge + `preset.revision`, pane focus, lazy `allPages`, outbound `layer.*` events); `chart.ready` exposes `layerApi` only (hard cut from schema 1)
- **core**: `bridge-layer-wire.ts`, `visitedPageIds` cleared on `setSymbol` / `setInterval`
- **Playground**: Bridge layer sync JSON debug panel; `@coderyo/bridge` workspace dependency
- **docs**: [ADR-bridge-layer-sync.md](./docs/ADR-bridge-layer-sync.md), [examples/bridge-layer-sync.md](./examples/bridge-layer-sync.md), API layer § updates

### Changed

- **BREAKING**: Bridge hosts must use `bridgeSchemaVersion: 2` and `host.layer.*` (no schema 1 in `chart.ready`)
- Monorepo packages synced to **1.1.0** (`VERSION`); `TRADVIEW_API_VERSION` remains **1**

## [1.0.3] - 2026-06-03

### Added

- **Bridge host**: `setIndicatorConfig`, `clearAllIndicators`, `clearAllDrawings`, `setDrawingTool`
- **core**: `indicatorPersist` load/save via `ChartStorageAdapter` (`loadIndicatorConfig`, `saveIndicatorConfig`, `createLocalChartStorage`)
- **core** re-exports: `clearedIndicatorConfig`, `hasVisibleIndicatorPanes`, `hasMainChartOverlays`, `hasAnyActiveIndicators`, `DEFAULT_INDICATOR_CONFIG`

### Changed

- **ui-shell**: indicator config persistence delegates to `@coderyo/core` (same storage keys)
- **docs**: [API.md](./docs/API.md) / [API-FREEZE.md](./docs/API-FREEZE.md) synced with Bridge and `clearAll*` APIs

## [1.0.2] - 2026-06-03

### Fixed

- **ui-shell (#4)**: TopBar first interval button no longer clipped on the left (`tv-layout-header` stacking; `.tv-topbar-intervals` group)

## [1.0.1] - 2026-06-03

### Fixed

- Pine Worker promise rejections surfaced via `error` event
- `setFeatures` / pine recompile refreshes plots immediately
- WS `connected` no longer triggers redundant catch-up during initial bootstrap

## [1.0.0] - 2026-06-03

### Added

- **IChart viewport API** (#3): `getVisibleRange`, `getBarSpace`, `setBarSpace`, `setVisibleRange`, `scrollToTimestamp`, `reloadHistory`
- **`setLocale` / `subscribeBars`** on `IChart`; `telemetry` event when `features.telemetry`
- **Bridge host**: `setLogScale`, `setBarSpace`, `setVisibleRange`, `scrollToTimestamp`, `reloadHistory`, `setLocale`, `setFeatures`; outbound `chart.barUpdate`
- **History**: chart path uses WS `requestWsHistory` when capabilities allow
- **`gaps.whitespace`**: LWC whitespace points at session gaps (>1.5× interval)
- **`streamMode: 'tick'`**: client `TickAggregator` for tick-only streams
- **Pine-lite**: `highest` / `lowest` / `crossover` / `crossunder`; optional **Web Worker** VM (`features.pineWorker`, default on)

### Fixed

- **Background tab / window focus**: backfill missed bars on resume (also on WS reconnect)

## [1.0.0-rc.4] - 2026-06-03

### Added

- **Pine 腳本編輯器**（`mountPineEditorPanel`）：CodeMirror 語法高亮、行號、即時 lint、debounced 套用、`localStorage` 持久化
- **Pine-lite 執行**：`if` / `else`、`while`、`for … to`、比較與 `and` / `or` / `not`、跳轉 VM（圖靈完備子集）
- **Pine-lite API**：`compilePineLite` 回傳 `diagnostics`（行/列）、`features.pineScript` + `pineEnabled`
- **內建指標**：主圖 **EMA**、**BOLL** 疊加（設定面板可開關）
- Playground 底部 Pine 編輯器面板

### Changed

- `@coderyo/ui-shell` 依賴 CodeMirror 6 + `@coderyo/pine-lite`（workspace）

## [1.0.0-rc.3] - 2026-06-03

### Added

- **Sub-second intervals**: `1s`, `5s`, `15s`, `30s` + mock gateway faster bar/tick push
- **Smooth price update**: `chart.updateLastPrice`, `smoothPriceUpdate` / `smoothPriceDurationMs` (~150ms OHLC + price line)
- [docs/API.md](./docs/API.md) — 整合方 API 參考（`@coderyo/*`、`createChart`、Bridge、DataProvider）
- **TopBar**: `activeInterval` highlight + `setActiveInterval` from `mountChartLayout`
- **Playground**: `predev` rebuilds `@coderyo/ui-shell` before Vite dev (avoids stale `dist`)
- **ui-shell**: regression test for late `onIntervalChange` wiring

### Fixed

- **Demo interval switch**: `mountChartLayout` passes same `opts` reference to TopBar (`Object.assign`, not spread copy) so callbacks assigned after mount work
- **Docs (#1)**: document that chart bootstrap uses `getHistory({ mode: 'loadMore', endTime: now })`
- **Docs (#2)**: EMBEDDING end-to-end shell ⇄ chart callback wiring + `chartRef` pattern

### Changed

- **npm scope**: all publishable packages renamed from `@tradview/*` to `@coderyo/*` (org `coderyo`)

## [1.0.0-rc.2] - 2026-06-03

### Added

- **Integrator feature flags**: `ChartFeatures`, `chart.setFeatures` / `getFeatures`, `featuresChange`, `hasActiveSymbol`
- **Minimal defaults**: no symbol until `setSymbol`; no indicators unless `features.indicators`; drawing layer off by default
- **Layout flags**: shell UI off by default; `setLayoutFeatures`; `createDemoLayoutOptions` / `createDemoChartOptions` for Playground
- **Bridge outbound allowlist**: `bridgeOutboundEvents` / `wireChartBridge({ outboundEvents })`
- **Docs**: [EMBEDDING.md](./docs/EMBEDDING.md) feature matrix; API-FREEZE §2/§5 updated

### Changed (breaking for embedders relying on old defaults)

- `mountChartLayout`: crosshair legend & shell chrome default **false** (use demo presets or explicit opts)
- `createChart`: no default symbol/MA/indicators; `showCrosshairLegend` moved to layout only

## [1.0.0-rc.1] - 2026-06-03

### Added

- **RC release tooling**: `VERSION`, `pnpm version:sync`, `pnpm check:rc`, [docs/API-FREEZE.md](./docs/API-FREEZE.md), [docs/RELEASE.md](./docs/RELEASE.md)
- **`TRADVIEW_VERSION`** on `@coderyo/core` / CDN / `chart.ready` payload
- **API freeze test** for `apiVersion: 1` constants

### Fixed (since pre-RC)

- Chart pan in cursor mode (drawing overlay pass-through + host hit-test)
- Duplicate candles when switching interval rapidly (`loadGeneration` guard)

### Included in RC (feature baseline)

- `createChart` with LWC main + volume + MACD/RSI/KDJ panes
- Full TV-style `mountChartLayout` (toolbar, settings, crosshair legend, drawing properties)
- Drawing tools v1 with `localStorage` persistence
- Mock REST/WS gateway, `DataProvider`, `VirtualWindow`, Bridge schema v1
- CDN `tradview.min.js` with 400 KB gzip CI gate

### Known RC limitations

See [docs/API-FREEZE.md](./docs/API-FREEZE.md) §7 (Pine execution stub, Protobuf v1.1, commercial CDN license gate, etc.).

[1.0.0]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0
[1.0.0-rc.4]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.1