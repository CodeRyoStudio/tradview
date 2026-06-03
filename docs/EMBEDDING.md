# TradView 嵌入指南

> **RC `1.0.0-rc.1`** — 公開 API 見 [API-FREEZE.md](./API-FREEZE.md)（`apiVersion: 1`）。

## 快速開始

```html
<div id="chart" style="width:100%;height:480px"></div>
<script src="https://cdn.example.com/tradview.min.js"></script>
<script>
  const provider = TradView.createGatewayDataProvider({
    restBaseUrl: 'https://api.example.com',
    wsUrl: 'wss://api.example.com/ws?v=1.0',
  });
  const chart = TradView.createChart('#chart', {
    dataProvider: provider,
    symbol: 'BINANCE:BTCUSDT',
    interval: '1h',
    showGrid: false,
    apiVersion: 1,
  });
  // TradView.TRADVIEW_VERSION === '1.0.0-rc.1'
</script>
```

### npm（RC）

```bash
npm install @tradview/core@1.0.0-rc.1
```

```typescript
import { createChart, TRADVIEW_API_VERSION, TRADVIEW_VERSION } from '@tradview/core';
import { createGatewayDataProvider } from '@tradview/data';
import { mountChartLayout } from '@tradview/ui-shell';
```

## 必備條件

- 容器需有明確高度（`height` 或 flex 佈局中的 `flex:1; min-height:0`）。
- 行情由整合方實作：`DataProvider`（REST 歷史 + WS 即時）。
- 可選 `SymbolResolver` 豐富商品搜尋結果（`@tradview/data`）。

## 常用 API

| API | 說明 |
|-----|------|
| `createChart(container, options)` | 建立圖表；`showGrid` 預設 `false`；`drawingDefaults.returnToCursorAfterDraw` 預設 `false` |
| `mountChartLayout` | `showCrosshairLegend`（預設 true）、`showStatusBar`（預設 false）、右側繪圖屬性欄 |
| `chart.setSymbol` / `setInterval` | 切換商品與週期 |
| `chart.setShowGrid(boolean)` | 顯示/隱藏網格 |
| `chart.setTheme('dark' \| 'light')` | 主題 |
| `chart.exportImage()` | 匯出 PNG |
| `TradView.mountChartLayout` | 完整 TV 殼層（TopBar、工具列、StatusBar、十字線圖例、右鍵選單） |
| `symbolResolver` | 可選；`resolve` / `search` 豐富商品資訊 |

## WebView Bridge

```typescript
const bridge = TradView.createDefaultBridge({ target: window.parent });
TradView.createChart('#chart', { dataProvider, bridge, chartId: 'main' });
```

**Web → Native**：`chart.ready`、`chart.crosshair`、`chart.visibleRange`、`chart.destroyed` 等。

**Native → Web**：`host.setSymbol`、`host.setInterval`、`host.setShowGrid`、`host.setTheme`、`host.fitContent` 等。

詳見 [DESIGN.md](./DESIGN.md) §13。

## 本地 Demo

```bash
pnpm install
pnpm demo
# http://127.0.0.1:5173
```

Mock 閘道：`4010`；Playground 透過 Vite 代理 `/api`、`/ws`。