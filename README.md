# TradView

TradingView-style embeddable K-line chart framework (see [docs/DESIGN.md](./docs/DESIGN.md)).

**Repository:** https://github.com/CodeRyoStudio/tradview

## Release status

| 版本 | 狀態 | 說明 |
|------|------|------|
| **1.0.0-rc.2** | RC | [API 凍結](./docs/API-FREEZE.md) · [發布流程](./docs/RELEASE.md) · [CHANGELOG](./CHANGELOG.md) |

```bash
# RC 發布前完整檢查
pnpm check:rc
```

## Quick start

```bash
pnpm install
pnpm build
pnpm test
```

### Mock data gateway

```bash
pnpm dev:mock
# REST http://127.0.0.1:4010/api/v1/capabilities
# WS   ws://127.0.0.1:4010/ws?v=1.0
```

### Playground

```bash
pnpm demo
# http://127.0.0.1:5173
```

## Integrator docs

- [EMBEDDING.md](./docs/EMBEDDING.md) — `createChart` / CDN / Bridge
- [API-FREEZE.md](./docs/API-FREEZE.md) — RC 凍結的公開 API（`apiVersion: 1`）
- [RELEASE.md](./docs/RELEASE.md) — 標籤、npm、CDN 附件

## Monorepo packages

| Package | License | Role |
|---------|---------|------|
| `@tradview/core` | MIT | `createChart`, Bridge, chart controller |
| `@tradview/data` | MIT | Protocol types + gateway client |
| `@tradview/ui-shell` | UNLICENSED | TV layout shell |
| `@tradview/drawings` | UNLICENSED | Drawing overlay |
| … | | See [DESIGN.md](./docs/DESIGN.md) |

**CDN:** `bundle/cdn/dist/tradview.min.js`（gzip ≤ 400 KB，CI gate）