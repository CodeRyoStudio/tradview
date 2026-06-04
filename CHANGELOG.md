# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.0.0] - 2026-06-04

### Added

- **GA release**: `@coderyo/*@2.0.0`, `@coderyo/bridge@3.0.0`; `TRADVIEW_API_VERSION = 2`; bridge schema **3** hard cut
- **Docs**: `API-FREEZE-2.0.md` GA freeze approved; ADR WebGL renderer + bridge schema 3 **Accepted**
- **CI**: `@coderyo/core` Vitest `installWebGL2TestContext` setup — `chart-controller.webgl` runs in CI

### Fixed

- **N1 (`ChartController`)**: `applyFeatures()` at end of constructor so WebGL `smoothPriceUpdate` / Pine / drawings apply from initial `features`

## [2.0.0-rc.4] - 2026-06-04

### Added

- **Review remediation (GA path)**: WebGL `setSmoothPriceUpdate` (`BarSmoothAnimator`), `setPinePlots` (main-pane overlays), `setPaneSyncGroups` / `applyTimeScaleSyncFromLayers`; DOM crosshair overlay; Vitest WebGL2 mock (`installWebGL2TestContext`) — port-parity runs in CI
- **Bridge**: `createDefaultBridge` origin allowlist (`allowInboundOrigins`); rejects wildcard inbound by default
- **Security**: csv-rest max bytes/rows + fetch timeout; Android URL allowlist + emulator-only cleartext NSC
- **Docs**: `docs/SDK.md`; `API-FREEZE-2.0.md` rc.4 candidate; ADR §6 CDN exception
- **Tests**: `chart-renderer-webgl.setcrosshair-clear`, `workspace-shell.smoke`, `bridge-origin`, `pine-overlay-lines`

### Changed

- **VERSION** → `2.0.0-rc.4` (GA tag deferred until CDN LWC split / full DESIGN sign-off)
- **Not GA-tagged**: prior `[2.0.0]` claims moved here as rc.4 candidate scope

### Added (rc.4 candidate — was listed as GA)

- **`@coderyo/*@2.0.0` candidate**, `@coderyo/bridge@3.0.0`: `DEFAULT_CHART_FEATURES.renderer` → **`webgl`**; `TRADVIEW_API_VERSION = 2`; schema 2 inbound rejected (`UNSUPPORTED_BRIDGE_SCHEMA`)
- **`IChart.setCrosshair`**: programmatic crosshair sync (workspace `sync.crosshair` uses `setCrosshair`, not `scrollToTimestamp`)
- **WebGL Appendix A parity (V2-R13)**: `compensatePrependForBuses`, log-scale rendering (`setLogScale`), port-parity tests (LOD, crosshair null, prepend delta, MACD/RSI/KDJ panes, independent `MsTimeScaleBusRegistry`)
- **V2-R14**: CDN gate `tradview.min.js` ≤ **400 KB** gzip (`pnpm check:cdn-size` @ **210 KB**)
- **V2-MC3**: `apps/playground/workspace.html` — `ChartWorkspace` + Bridge 3 + `createWorkspaceChartSlots`
- **V2-PROD**: `apps/sample-android` Gradle project (WebView + instrumented smoke); CI `android-sample` job

### Changed

- **Bridge**: `@coderyo/bridge@3.0.0` (GA hard cut; no `bridge@2` + `core@2`)
- **`smoothPriceUpdate` / Pine on WebGL**: `BarSmoothAnimator` + `pinePlotsToLineSpecs` wired @ rc.4 (see `ADR-v2-renderer-webgl.md` for CDN)

### Added (pre-GA rc.2)

- **V2-L1 (`@coderyo/ui-shell`)**: `createWorkspaceChartSlots` for multi-chart DOM `containerId` mounts (depends V2-MC1 only)
- **V2-MC2–MC4 (`@coderyo/core`)**: link `crosshair` fan-out (`scrollToTimestamp`); `workspace-smoke.test.ts`
- **V2-MC3 (`apps/playground`)**: `multi-chart.html` + `multi-chart-demo.ts` (`ChartWorkspace` + linked slots)
- **V2-PINE2 (`@coderyo/pine-lite`)**: indicator builtins **18** (`wma`, `stdev`, `change`, `roc`, `atr`, `cci`, `mfi`, `stoch`, `sum`, `bb`, `macd`); `builtins-count.test.ts`
- **V2-R13 (`@coderyo/renderer-webgl`)**: `port-parity.test.ts` — WebGL vs lite fixture parity (bar count after `setBars`, visible range `fromMs`/`toMs`, crosshair `null` clear); Appendix A parity covered in port-parity + WebGL integration tests
- **V2-MC3 smoke (`@coderyo/core`)**: `multi-chart-demo.smoke.test.ts` static analysis for `ChartWorkspace` playground demo
- **V2-C**: `examples/adapters/csv-rest` reference `createCsvRestDataProvider`
- **V2-PROD stub**: `apps/sample-android/README.md` (CI compile placeholder)
- **V2-R12 follow-up**: WebGL `subscribeCrosshair` via pointer move on `WebGLChartRenderBackend`
- **Review fixes**: `listChartSummaries` symbol/interval (B5); crosshair link clear + throttle; `clearCrosshair` on `IChart`; WebGL bus unsubscribe + empty-bars null; `createWorkspaceChartSlots` `destroy()`; expanded workspace/bridge/pine/csv-rest tests
- **Review R2**: WebGL crosshair null only on leave/state transition; bridge `chart.crosshair` clear payload; `lastLinkedCrosshairMs` gated on `sync.crosshair` + reset on re-enable
- **Review R3**: WebGL `clearBars()` / `setBars([])` one-shot crosshair clear via `onBarsBecameEmpty()`; bus sync reentrancy guard
- **V2-B4–B8 + V2-MC1 + V2-R12 (`@coderyo/core`)**: `ChartWorkspace` + `wireWorkspaceBridge` (schema 3 `host.workspace.*`, `chart.workspaceReady`); link group fan-out (`applyLinkEvent`); `features.renderer: 'webgl' | 'lite'` with `WebGLChartRenderBackend` (`MsTimeScaleBus` shim); tests `chart-workspace`, `workspace-bridge`, `chart-controller.webgl`
- **V2-B3 (`@coderyo/bridge@3.0.0-rc.1`, `@coderyo/core`)**: runtime `BRIDGE_SCHEMA_VERSION = 3`; `TRADVIEW_API_VERSION = 2`; `chart.ready` adds `workspaceId` + `charts[]`; `chart.workspaceReady` / workspace host stubs; chart-scoped `host.*` requires `chartId` (`MISSING_CHART_ID`, `CHART_NOT_FOUND`, `UNSUPPORTED_BRIDGE_SCHEMA`); `schema3-wire.ts` + `schema3-events.test.ts`; `bridge-wire.schema3.test.ts`
- **V2-R9–R11 (`@coderyo/renderer-webgl`, `phase_gamma`)**: `chart-coordinates` mapper (`createChartCoordinateMapper`, `barIndexForTimeMs`); `WebGLDrawingLayer` + `drawings.enabled` on `WebGLPaneOrchestrator` (`setDrawingTool`, `setDrawingsLayerVisible`); playground `webgl-demo` drawing toolbar; `check:webgl-size` cap **170 KB** (R11 +50 KB); depends on `@coderyo/drawings`
- **V2-R6–R8 (`@coderyo/renderer-webgl`, `phase_beta`)**: main-chart MA/EMA/BOLL overlays (`main-chart-overlays.ts`, shared price scale); `lodDecimateBars` in `setBars` (`maxRenderPoints`); `getLodStats` / `getRenderPerfStats` / `runRenderBenchmark`; `pnpm bench:webgl`; playground `webgl-demo` overlay toggles + LOD/perf HUD + `?bench=1`; `check:webgl-size` cap **120 KB** (R8)
- **V2-R5 (`@coderyo/renderer-webgl`, `phase_beta`)**: `LineSeriesRenderer`, `WebGLIndicatorPane` / `WebGLIndicatorStack` (MACD/RSI/KDJ via `@coderyo/indicators`), `ViewportSyncBus` + `ChartViewport.syncFrom`; `WebGLPaneOrchestrator` layout (~60% / ~15% / ~25%) + `indicatorConfig` / `setIndicatorConfig`; playground `webgl-demo` indicator toggles; `indicator-values.test.ts`, `viewport-sync-bus.test.ts`
- **V2-R5 fix**: `setBarCount` no longer runs `fitLatest` on followers; `syncBus.propagate()` after indicator `setBars`; orchestrator `lastBars` + `setIndicatorConfig` re-applies series; `webgl-pane-orchestrator.test.ts`

## [2.0.0-rc.2] - 2026-06-04

### `@coderyo/ui-shell` — PR-L7b (grid public API removal)

- **Version** monorepo sync → **`2.0.0-rc.2`** (`VERSION` + `pnpm version:sync`; `@coderyo/bridge` stays `2.0.0`)
- **Removed** v1 12×12 grid symbols from main `@coderyo/ui-shell` export: `createLayoutGrid`, `LayoutSchema` helpers, `layoutSchemaToPreset`, etc. (internal `layout-engine.ts` / `layout-schema.ts` retained)
- **Added** `@coderyo/ui-shell/migrate` subpath — `layoutSchemaToPreset`, `MigrateLayoutSchema`, `cloneLayoutSchema`, persistence helpers for integrator migration
- **`mountChartLayout`** requires `layerCompositorManaged: true` @ rc.2 (throws with [MIGRATION-2.0.md §5](https://github.com/CodeRyoStudio/tradview/blob/main/docs/MIGRATION-2.0.md#5-layout--pr-l7-three-phase-timeline) link); legacy grid mount branch removed
- **Tests**: `migrate-exports.test.ts`, updated `public-exports.test.ts`, `layout-deprecation.test.ts`, `top-bar.layout.test.ts`

### Added

- **PR-02b-2 (`@coderyo/data`, `@coderyo/core`)**: WS protobuf codec (`protobufjs`, `encodeWsProtobufEnvelope` / `decodeWsProtobufEnvelope`, `PROTO_WS_ENVELOPE_BODY_TYPE_MAP`); golden tests (`proto-golden.test.ts`, subscribe byte length 62); mock gateway `tradview-protobuf` subprotocol; `TradViewWsClient` `encoding: 'json' \| 'protobuf'` + `tradview-json` / `tradview-protobuf`; mock `capabilities.encoding: ['json','protobuf']`; `ChartFeatures.protobuf` enables WS protobuf when provider advertises it (JSON default unchanged); **`@coderyo/data/client`** subpath for gateway/WS (main entry browser-safe); `protobuf-ws-encoding.test.ts` + `ws-protobuf-codec.test.ts`.
- **V2-R1–R4b follow-up**: wheel zoom respects `rightPaddingPx`; `check:webgl-size` (40 KB raw gate in `check:rc`); shader compile errors logged once; playground demo uses inline `synthetic-bars` (no `@coderyo/data/mock` barrel); viewport/interaction/export tests; DESIGN-v2 §2.1 baseline updated.
- **V2-R1–R4b (`@coderyo/renderer-webgl`, `phase_alpha`)**: WebGL2 chart stack — `WebGL2Context` (resize/DPR/context loss), `ChartViewport` (bar spacing, visible logical range, pan/zoom), `CandlestickRenderer`, `VolumeRenderer`, `WebGLChartPane`, `WebGLPaneOrchestrator`; viewport/price-scale tests; optional WebGL integration tests (`describe.skipIf(!hasWebGL2)`). Standalone demo **`apps/playground/webgl-demo.html`** (600 synthetic OHLCV bars via `@coderyo/data/mock`); does **not** wire `createChart`. ADR: [ADR-v2-renderer-webgl.md](./docs/ADR-v2-renderer-webgl.md) §5.1.
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