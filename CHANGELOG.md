# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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

[1.0.0-rc.4]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.4
[1.0.0-rc.3]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.3
[1.0.0-rc.2]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.1