# TradView

TradingView-style embeddable K-line chart framework (see [docs/DESIGN.md](./docs/DESIGN.md)).

## Quick start

```bash
pnpm install
pnpm build
pnpm test
```

### Mock data gateway (PR-02)

```bash
pnpm dev:mock
# REST http://127.0.0.1:4010/api/v1/capabilities
# WS   ws://127.0.0.1:4010/ws?v=1.0
```

### Playground

```bash
pnpm dev:mock   # terminal 1
pnpm dev:playground
```

## Monorepo packages

| Package | License | Status |
|---------|---------|--------|
| `@tradview/data` | MIT | Protocol + mock gateway |
| `@tradview/core` | MIT | Stub (PR-07+) |
| `@tradview/ui-shell` | UNLICENSED | Stub (PR-09+) |
| … | | See DESIGN.md PR Plan |