# TradView 嵌入指南

> **RC `1.0.0-rc.2`** — 完整 API 見 [API.md](./API.md)；凍結範圍見 [API-FREEZE.md](./API-FREEZE.md)（`apiVersion: 1`）。

整合方預設為 **最小圖表**：不帶商品、不帶指標、不帶繪圖互動層、不帶 TV 殼層；需用 `features` / `mountChartLayout` **明確開啟**。Playground 使用 `createDemoChartOptions` / `createDemoLayoutOptions` 展示全功能。

## 三層 API（建議用法）

| 層級 | API | 說明 |
|------|-----|------|
| 圖表核心 | `createChart(host, { dataProvider, features? })` | 必填 `dataProvider`；可省略 `symbol` → 空白圖直到 `setSymbol` |
| 殼層（可選） | `mountChartLayout(root, opts?)` | TopBar、工具列、圖例、StatusBar 等 **預設全關** |
| Bridge（可選） | `wireChartBridge({ controller, chart, bridge, outboundEvents? })` 或 `createChart` 內建 `bridge` + `bridgeOutboundEvents` | 整合方 **白名單** 要轉發的 outbound 事件 |

```typescript
import {
  createChart,
  DEFAULT_CHART_FEATURES,
  wireChartBridge,
  createDemoChartOptions,
} from '@coderyo/core';
import { createGatewayDataProvider } from '@coderyo/data';
import { mountChartLayout, createDemoLayoutOptions } from '@coderyo/ui-shell';

// 最小嵌入：僅 K 線 + 你自己的 UI
const chart = createChart(document.getElementById('chart')!, {
  dataProvider: createGatewayDataProvider({ restBaseUrl: '/api', wsUrl: 'wss://…' }),
  // 不傳 symbol → 空白圖
});
chart.setSymbol('BINANCE:BTCUSDT').setInterval('1h');

// 全功能 Demo（Playground 同款）
const layout = mountChartLayout(app, createDemoLayoutOptions({ /* callbacks */ }));
const demo = createChart(layout.chartHost, createDemoChartOptions({ dataProvider, symbol: '…', interval: '1h', indicatorHost: layout.indicatorHost }));
```

## Feature 矩陣（`ChartFeatures`）

| 欄位 | 預設 | 說明 |
|------|------|------|
| `fetchPolicy` | `'lazy-left-only'` | 虛擬視窗拉歷史策略 |
| `streamMode` | `'bar'` | WS 訂閱模式；`tickStream: true` 時等同 `bar+tick` |
| `gaps.whitespace` | `false` | 非交易時段留白 |
| `gaps.fillVisibleHoles` | `false` | 為 `true` 時強制 `fill-visible-holes` fetch |
| `drawings.layer` | `false` | 繪圖互動層；關閉時 API（`setDrawingTool` 等）仍可用 |
| `drawings.persist` | `true` | `localStorage` 持久化；可設 `false` 關閉 |
| `indicators` | `null` | 不傳 / `null` → **零指標**、無子窗格 |
| `indicatorPersist` | `false` | 指標參數寫入 storage |
| `pineEnabled` / `protobuf` / `telemetry` / `tickStream` | `false` | 預留；多數尚未接線 |

執行期：`chart.setFeatures({ … })`、`chart.getFeatures()`；事件 `featuresChange`。

## Layout 矩陣（`mountChartLayout`）

| 選項 | 預設 | 說明 |
|------|------|------|
| `showTopBar` | `false` | 週期列 + 商品輸入 |
| `showLeftToolbar` | `false` | 桌機左側繪圖工具 |
| `showBottomToolbar` | `false` | 手機底部工具列 |
| `showCrosshairLegend` | `false` | 十字線 OHLC 浮層（與 StatusBar 分開） |
| `showStatusBar` | `false` | 底部連線 / OHLCV |
| `showPropertiesPanel` | `false` | 繪圖屬性側欄 |
| `showContextMenu` | `false` | 右鍵選單 |
| `showSettings` | `false` | TopBar 齒輪（需 `showTopBar`） |
| `showShortcuts` | `false` | `?` 快捷鍵說明 |
| `symbolInput` | `'manual'` | 無搜尋 API 時手動輸入；有 `onSymbolSearch` 可設 `'search'` |

執行期：`setLayoutFeatures(patch)`、`getLayoutFeatures()`。

### 殼層與圖表接線（端到端）

`mountChartLayout` **不會**自動綁定 `IChart`。只開 `showTopBar` / `showLeftToolbar` 而不接 callback 時，工具列會亮但**畫不了線**、換週期也**沒反應**。完整範例見 `apps/playground/src/main.ts`。

**建立順序：** 先 `mountChartLayout` 取得 `chartHost`，再 `createChart`；callback 裡還沒有 `chart` 實例，請用 ref holder：

```typescript
import { createChart } from '@coderyo/core';
import { createGatewayDataProvider } from '@coderyo/data';
import { mountChartLayout } from '@coderyo/ui-shell';
import type { DrawingToolId } from '@coderyo/ui-shell';

const chartRef: { current: ReturnType<typeof createChart> | null } = { current: null };

const layout = mountChartLayout(root, {
  showTopBar: true,
  showLeftToolbar: true,
  showBottomToolbar: true,
  showPropertiesPanel: true,
  initialSymbol: 'BINANCE:BTCUSDT',
  onSymbolSelect: (symbol) => chartRef.current?.setSymbol(symbol),
  onIntervalChange: (interval) => chartRef.current?.setInterval(interval),
  onDrawingToolSelect: (tool: DrawingToolId) => chartRef.current?.setDrawingTool(tool),
  onDrawingStyleChange: (patch) => chartRef.current?.updateSelectedDrawingStyle(patch),
  onDrawingSelectionBind: (bind) => {
    chartRef.current?.on('drawingSelectionChange', ({ record }) => bind(record ?? null));
  },
});

const chart = createChart(layout.chartHost, {
  dataProvider: createGatewayDataProvider({ restBaseUrl: '/api', wsUrl: 'wss://…' }),
  indicatorHost: layout.indicatorHost,
  symbol: 'BINANCE:BTCUSDT',
  interval: '1h',
  features: { drawings: { layer: true } },
});
chartRef.current = chart;
```

| 殼層 UI | 建議 callback | 對應 `IChart` |
|---------|---------------|---------------|
| TopBar 週期 | `onIntervalChange` | `setInterval` |
| TopBar 商品 | `onSymbolSelect` | `setSymbol` |
| 左/底繪圖工具 | `onDrawingToolSelect` | `setDrawingTool` |
| 屬性側欄 | `onDrawingStyleChange` | `updateSelectedDrawingStyle` |
| 選取繪圖 | `onDrawingSelectionBind` + `drawingSelectionChange` | 更新屬性面板 |

## `DataProvider`：首次歷史也用 `loadMore`

自訂 `getHistory` 時，`loadMore` **不只是**「使用者往左拖才拉更舊 K 線」。圖表在 `setSymbol` / 首次載入時會呼叫：

```typescript
getHistory({
  mode: 'loadMore',
  symbol,
  interval,
  endTime: Date.now(),
  limit: 500,
});
```

若對所有 `loadMore` 都回 `{ bars: [], hasMore: false }`，開圖會**沒有歷史**，只剩即時 WS 一根根長出來。請讓上述 bootstrap 請求回傳**最近一窗** K 線；使用者向左平移時，VirtualWindow 會再以較早的 `endTime` 發 `loadMore`。

| `HistoryMode` | 典型用途 |
|---------------|----------|
| `loadMore` | **首次載入**（`endTime = now`）+ 向左懶加載 |
| `range` | 指定毫秒區間 |
| `cursor` | 分頁 / cursor 協議 |

詳見 [API.md § DataProvider](./API.md#7-dataprovider)。

## 快速開始（CDN）

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
    features: { gaps: { whitespace: false } },
  });
  chart.setSymbol('BINANCE:BTCUSDT').setInterval('1h');
</script>
```

### npm（RC）

```bash
npm install @coderyo/core@1.0.0-rc.2
```

## 必備條件

- 容器需有明確高度（`height` 或 flex 佈局中的 `flex:1; min-height:0`）。
- 行情由整合方實作：`DataProvider`（REST 歷史 + WS 即時）。
- 可選 `SymbolResolver` 豐富商品搜尋（`@coderyo/data`）。

## Bridge 事件白名單

```typescript
import { createChart } from '@coderyo/core';
import { createDefaultBridge } from '@coderyo/bridge';

const bridge = createDefaultBridge({ target: window.parent });
createChart('#chart', {
  dataProvider,
  bridge,
  bridgeOutboundEvents: ['chart.ready', 'chart.crosshair', 'chart.symbol'],
});
```

**Web → Native**：`chart.ready`、`chart.resize`、`chart.connectionChange`、`chart.crosshair`、`chart.visibleRange`、`chart.symbol`、`chart.interval`、`chart.error`、`chart.destroyed`。

**Native → Web**：`host.setSymbol`、`host.setInterval`、`host.setTheme`、`host.setShowGrid`、`host.fitContent`、`host.scrollToRealtime`、`host.resize`、`host.destroy`。

## 本地 Demo

```bash
pnpm install
pnpm demo
# http://127.0.0.1:5173
```

Mock 閘道：`4010`；Playground 透過 Vite 代理 `/api`、`/ws`。