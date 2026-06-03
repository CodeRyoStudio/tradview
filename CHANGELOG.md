# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
- **`TRADVIEW_VERSION`** on `@tradview/core` / CDN / `chart.ready` payload
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

[1.0.0-rc.1]: https://github.com/CodeRyoStudio/tradview/releases/tag/v1.0.0-rc.1