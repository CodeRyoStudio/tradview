# TradView API 參考

> **版本**：`1.0.0` · **Embed API**：`apiVersion: 1`（`TRADVIEW_API_VERSION`）  
> **npm scope**：`@coderyo/*` · **Bridge schema**：`bridgeSchemaVersion: 1`

本文描述整合方使用的公開 API。架構與協議細節見 [DESIGN.md](./DESIGN.md)；凍結承諾見 [API-FREEZE.md](./API-FREEZE.md)；嵌入範例見 [EMBEDDING.md](./EMBEDDING.md)。

**三層 API**：圖表核心（本文 §3）→ 殼層 §6 → 圖層／Compositor [API-LAYER.md](./API-LAYER.md)。正式化計畫見 [API-FRAMEWORK-PLAN.md](./API-FRAMEWORK-PLAN.md)。

> **版面 v2 為主**：新整合請用 `mountLayerCompositor` + `LayoutPreset` v2。v1 12×12 `layout` / `layoutEditor` 仍可用但**已棄用**（見 §6）。

---

## 目錄

1. [套件與交付](#1-套件與交付)
2. [快速整合](#2-快速整合)
3. [`createChart` / `IChart`](#3-createchart--ichart)
4. [`ChartFeatures`](#4-chartfeatures)
5. [圖表事件 `ChartEvent`](#5-圖表事件-chartevent)
6. [`mountChartLayout`](#6-mountchartlayout)
7. [`DataProvider`](#7-dataprovider)
8. [WebView Bridge](#8-webview-bridge)
9. [繪圖 API](#9-繪圖-api)
10. [指標 `IndicatorConfig`](#10-指標-indicatorconfig)
11. [CDN 全域 `TradView`](#11-cdn-全域-tradview)
12. [常數與型別匯出](#12-常數與型別匯出)

---

## 1. 套件與交付

| 套件 | 授權 | 用途 |
|------|------|------|
| `@coderyo/core` | MIT | **主入口**：`createChart`、`wireChartBridge` |
| `@coderyo/data` | MIT | `DataProvider`、`createGatewayDataProvider` |
| `@coderyo/bridge` | MIT | WebView `postMessage` 適配器 |
| `@coderyo/ui-shell` | 商業 | 殼層 `mountChartLayout` + 圖層 Compositor（[API-LAYER.md](./API-LAYER.md)） |
| `@coderyo/drawings` | 商業 | 繪圖型別與工具（通常經 core 間接使用） |
| `@coderyo/indicators` | MIT | 指標設定型別 |
| `tradview.min.js`（CDN） | 含 ui-shell | 全域 `TradView` |

```bash
npm install @coderyo/core@rc @coderyo/data@rc
# 需要殼層時
npm install @coderyo/ui-shell@rc
```

---

## 2. 快速整合

預設為**最小圖表**：不帶商品、不帶指標、不顯示繪圖互動層、不掛殼層 UI。

```typescript
import { createChart } from '@coderyo/core';
import { createGatewayDataProvider } from '@coderyo/data';

const provider = createGatewayDataProvider({
  restBaseUrl: 'https://api.example.com/api',
  wsUrl: 'wss://api.example.com/ws?v=1.0',
});

const chart = createChart(document.getElementById('chart')!, {
  dataProvider: provider,
  theme: 'dark',
  interval: '1h',
});

chart.setSymbol('BINANCE:BTCUSDT');
```

容器需有明確高度（`height: 480px` 或 flex 子項 `flex:1; min-height:0`）。

**v2 全功能（Playground / Compositor，建議）**：

```typescript
import { createChart, createDemoChartOptions } from '@coderyo/core';
import {
  mountChartLayout,
  createDemoLayoutOptions,
  mountLayerCompositor,
  VENDOR_DEFAULT_PRESET,
  cloneLayoutPreset,
} from '@coderyo/ui-shell';

const layout = mountChartLayout(root, createDemoLayoutOptions({
  layerCompositorManaged: true,
  /* callbacks: onIntervalChange, onDrawingToolSelect, … */
}));
const compositor = mountLayerCompositor(layout.layoutRoot, {
  preset: cloneLayoutPreset(VENDOR_DEFAULT_PRESET),
  widgets: {
    chartMain: layout.chartMain,
    chartVolume: layout.chartVolume,
    chartIndicator: layout.indicatorHost,
  },
  hideLegacyGrid: layout.layoutGrid,
});
const chart = createChart(layout.chartMain, createDemoChartOptions({
  dataProvider: provider,
  volumeMount: layout.chartVolume,
  indicatorHost: layout.indicatorHost,
  symbol: 'BINANCE:BTCUSDT',
  interval: '1h',
}));
```

**Legacy v1 grid（已棄用）**：`createChart(layout.chartHost, …)` 僅用於未遷移的 grid 整合。

---

## 3. `createChart` / `IChart`

### `createChart(target, options)`

| 參數 | 型別 | 說明 |
|------|------|------|
| `target` | `HTMLElement \| string` | 容器元素或 CSS 選擇器 |
| `options` | `CreateChartOptions` | 見下表 |

**回傳**：`IChart`（方法鏈式回傳同一實例包裝）。

### `CreateChartOptions`

| 欄位 | 型別 | 預設 | 說明 |
|------|------|------|------|
| `dataProvider` | `DataProvider` | — | **必填** |
| `symbol` | `string` | 無 | 省略則空白圖，需呼叫 `setSymbol` |
| `interval` | `Interval` | `'1h'` | K 線週期 |
| `theme` | `'dark' \| 'light'` | `'dark'` | 主題 |
| `features` | `ChartFeatures` | 最小預設 | 見 [§4](#4-chartfeatures) |
| `chartId` | `string` | `'default'` | 繪圖 storage key、Bridge 識別 |
| `indicatorHost` | `HTMLElement` | — | MACD/RSI/KDJ 子窗格宿主（來自 layout） |
| `volumeMount` | `HTMLElement` | — | P2：成交量 pane 獨立容器（Layer Compositor）；須為空節點 |
| `symbolResolver` | `SymbolResolver` | — | 商品解析／搜尋 |
| `scaleMode` | `'linear' \| 'log'` | `'linear'` | 價格軸 |
| `showGrid` | `boolean` | `false` | 網格線 |
| `width` / `height` | `number` | — | 容器像素尺寸 |
| `drawingDefaults.returnToCursorAfterDraw` | `boolean` | `false` | 畫完切回游標工具 |
| `bridge` | `BridgeAdapter` | — | 內建 `wireChartBridge` |
| `bridgeOutboundEvents` | `BridgeOutboundType[]` | 全部 | Bridge 出站白名單 |
| `bridgeCrosshairThrottleMs` | `number` | `0` | 十字線節流（毫秒） |
| `fetchPolicy` | `FetchPolicy` | — | **已棄用**，用 `features.fetchPolicy` |
| `indicatorConfig` | `IndicatorConfig` | — | **已棄用**，用 `features.indicators` |
| `chartStorage` | `ChartStorageAdapter` | `localStorage` | `indicatorPersist` 使用的 storage 後端 |

### `IChart` 方法

| 方法 | 回傳 | 說明 |
|------|------|------|
| `setSymbol(symbol)` | `IChart` | 切換商品並重新 bootstrap |
| `setInterval(interval)` | `IChart` | 切換週期 |
| `setTheme(theme)` | `IChart` | 主題 |
| `setShowGrid(show)` | `IChart` | 網格 |
| `setLogScale(enabled)` | `IChart` | 對數價格軸 |
| `fitContent()` | `IChart` | 適配可見 K 線 |
| `scrollToRealtime()` | `IChart` | 捲到最新 |
| `getVisibleRange()` | `ChartVisibleRange \| null` | 目前可見時間範圍（`fromMs` / `toMs`） |
| `getBarSpace()` | `number` | K 線柱寬（px，對應 LWC `barSpacing`） |
| `setBarSpace(px)` | `IChart` | 設定縮放柱寬 |
| `setVisibleRange(range)` | `IChart` | 還原可見時間範圍 |
| `scrollToTimestamp(tsMs, animationMs?)` | `IChart` | 將指定時間對齊視窗右緣 |
| `reloadHistory()` | `Promise<IChart>` | 重新拉取近期歷史，**不**重置捲動/縮放 |
| `setLocale(locale)` | `IChart` | 切換 `@coderyo/i18n` 語系 |
| `subscribeBars(handler)` | `() => void` | 訂閱 `barUpdate`，回傳 unsubscribe |
| `resize(size?)` | `IChart` | `{ width?, height? }`；**不**清除 `setChartPaneResizeFocus` |
| `setChartPaneResizeFocus(pane)` | `IChart` | `'main' \| 'volume' \| 'indicator' \| 'all'`；限制 LWC `resize` 目標（TimeScaleBus 仍同步全部） |
| `setFullscreen(enabled)` | `IChart` | 全螢幕容器 |
| `exportImage(opts?)` | `Promise<Blob>` | PNG；`pixelRatio` 預設 `2` |
| `on(event, handler)` | `IChart` | 訂閱事件 |
| `off(event, handler)` | `IChart` | 取消訂閱 |
| `searchSymbols(query)` | `Promise<SymbolSearchHit[]>` | 需 provider 或 resolver |
| `setDrawingTool(tool)` | `IChart` | 見 [§9](#9-繪圖-api) |
| `deleteSelectedDrawing()` | `boolean` | 刪除選中繪圖 |
| `copySelectedDrawing()` | `DrawingRecord \| null` | 複製 |
| `toggleLockSelectedDrawing()` | `boolean` | 鎖定切換 |
| `updateSelectedDrawingStyle(patch)` | `void` | 樣式 |
| `deselectDrawing()` | `void` | 取消選取 |
| `setIndicatorConfig(config)` | `void` | `null` 關閉所有指標窗格 |
| `listIndicatorLayers()` | `IndicatorLayerInfo[]` | 目前啟用的內建指標圖層（見 §10） |
| `disableIndicatorLayer(id)` | `IndicatorConfig` | 關閉單一圖層（`ma` / `macd` / `volume` 等） |
| `clearAllIndicators()` | `IndicatorConfig` | 關閉所有指標窗格與主圖疊加，回傳套用後的 config |
| `clearAllDrawings()` | `number` | 刪除目前 symbol/interval 下全部繪圖，回傳刪除數量 |
| `setReturnToCursorAfterDraw(v)` | `IChart` | 繪圖行為 |
| `updateLastPrice(price, timeMs?)` | `IChart` | 整合方 push 最新價（可不訂閱 WS） |
| `setFeatures(patch)` | `IChart` | 執行期更新 feature |
| `getFeatures()` | `ResolvedChartFeatures` | 目前 feature 快照 |
| `hasActiveSymbol()` | `boolean` | 是否已 `setSymbol` |
| `destroy()` | `void` | 銷毀圖表與訂閱 |

### `wireChartBridge(options)`

進階：自行持有 `ChartController` 時可手動接 Bridge。

```typescript
import { wireChartBridge } from '@coderyo/core';

const teardown = wireChartBridge({
  controller,
  chart,
  bridge,
  chartId: 'main',
  outboundEvents: ['chart.ready', 'chart.crosshair'],
  crosshairThrottleMs: 50,
});
// chart.destroy() 或 teardown()
```

---

## 4. `ChartFeatures`

執行期可透過 `chart.setFeatures({ ... })` 合併更新；變更後觸發 `featuresChange`。

### 預設（`DEFAULT_CHART_FEATURES`）

```typescript
{
  fetchPolicy: 'lazy-left-only',
  streamMode: 'bar',
  gaps: { whitespace: false, fillVisibleHoles: false },
  drawings: { layer: false, persist: true },
  indicators: null,
  indicatorPersist: false,
  pineEnabled: false,
  protobuf: false,
  telemetry: false,
  tickStream: false,
}
```

### 欄位說明

| 欄位 | 型別 | 說明 |
|------|------|------|
| `fetchPolicy` | `'lazy-left-only' \| 'fill-visible-holes'` | 向左懶加載；後者由 `gaps.fillVisibleHoles` 強制 |
| `streamMode` | `'bar' \| 'tick' \| 'bar+tick'` | WS 訂閱模式 |
| `gaps.whitespace` | `boolean` | 資料缺口插入 LWC whitespace |
| `pineWorker` | `boolean` | Pine VM 使用 Worker（預設 `true`） |
| `gaps.fillVisibleHoles` | `boolean` | `true` 時使用 `fill-visible-holes` 拉洞 |
| `drawings.layer` | `boolean` | 繪圖互動層；`false` 時 API 仍可用 |
| `drawings.persist` | `boolean` | `localStorage` 持久化 |
| `indicators` | `IndicatorConfig \| null` | `null` = 無 MA / 無子窗格 |
| `indicatorPersist` | `boolean` | 指標參數寫入 storage（`loadIndicatorConfig` / `saveIndicatorConfig`，key 見 `@coderyo/indicators`） |
| `smoothPriceUpdate` | `boolean` | 最後一根 K 線 + 價格線平滑插值（預設 `false`） |
| `smoothPriceDurationMs` | `number` | 平滑動畫時長（預設 `150`） |
| `pineEnabled` / `protobuf` / `telemetry` / `tickStream` | `boolean` | `tickStream` 啟用 WS tick；其餘多為預留 |

輔助：

- `resolveChartFeatures(partial?)` → 完整解析
- `PENDING_SYMBOL` → `''`（內部空白商品占位）

---

## 5. 圖表事件 `ChartEvent`

```typescript
chart.on('symbolChange', (info) => { /* SymbolInfo */ });
chart.off('symbolChange', handler);
```

| 事件 | payload 摘要 |
|------|----------------|
| `connectionChange` | `ConnectionState` |
| `barUpdate` | `Bar` |
| `error` | `{ code?, message? }` 或 unknown |
| `visibleRangeChange` | `{ from, to }`（毫秒時間） |
| `symbolChange` | `SymbolInfo` 或 `{ symbol }` |
| `intervalChange` | `Interval` |
| `crosshairChange` | `CrosshairPayload \| null` |
| `destroyed` | `{ chartId }` |
| `drawingSelectionChange` | `{ id, record }` |
| `drawingContextMenu` | `{ clientX, clientY, drawing }` |
| `requestCursorTool` | — |
| `featuresChange` | `ResolvedChartFeatures` |
| `telemetry` | `{ event, ... }`（需 `features.telemetry`） |

---

## 6. `mountChartLayout`

可選殼層（**Tier 2**）；**所有 UI 開關預設 `false`**。殼層與 `IChart` **刻意解耦**——每個 UI 動作需由整合方接 callback（見 [EMBEDDING.md — 殼層與圖表接線](./EMBEDDING.md#殼層與圖表接線端到端)）。

### v2 圖層版面（建議）

Playground 使用 **Layer Compositor**（`LayoutPreset` v2）而非 v1 grid。完整 API 見 **[API-LAYER.md](./API-LAYER.md)**。要點：

- `layerCompositorManaged: true` — 十字線圖例等由 compositor 控制 `visible`
- `handleDrawingSelection` / `bindLayerCompositorController` / `syncCompositorShellVisibility` — 繪圖屬性與 shell / legend 圖層同步
- `chartMain` + `chartVolume` + `indicatorHost` → `createChart({ volumeMount, indicatorHost })`（勿用 legacy `chartHost` 別名掛載 LWC）

### v1 12×12 Grid（deprecated，仍匯出）

`layout` / `layoutEditor` / `LayoutSchema` v1 仍可用於**非 compositor**整合方與 `layoutSchemaToPreset()` 遷移。Playground 與 `layerCompositorManaged: true` 使用 compositor shell（P5 不刪除 v1 公開 API，見 [LAYER-COMPOSITOR-PLAN.md](./LAYER-COMPOSITOR-PLAN.md)）。

### 基本接線

先 `mountChartLayout` 再 `createChart`；callback 使用 `chartRef`：

```typescript
const chartRef: { current: IChart | null } = { current: null };

const layout = mountChartLayout(root, {
  showTopBar: true,
  showLeftToolbar: true,
  onSymbolSelect: (s) => chartRef.current?.setSymbol(s),
  onIntervalChange: (i) => chartRef.current?.setInterval(i),
  onDrawingToolSelect: (tool) => chartRef.current?.setDrawingTool(tool),
  onDrawingStyleChange: (patch) => chartRef.current?.updateSelectedDrawingStyle(patch),
});

const chart = createChart(layout.chartMain, {
  dataProvider: provider,
  indicatorHost: layout.indicatorHost,
  features: { drawings: { layer: true } },
});
chartRef.current = chart;
```

### 回傳值

| 屬性 | 說明 |
|------|------|
| `chartHost` | 傳入 `createChart` 的容器 |
| `indicatorHost` | 傳入 `createChart` 的 `indicatorHost` |
| `topBar` / `statusBar` / `crosshairLegend` | UI 元件 |
| `propertiesPanel` | 繪圖屬性側欄 |
| `setActiveDrawingTool(tool)` | 同步工具列狀態 |
| `setLayoutFeatures(patch)` | 執行期開關殼層 |
| `getLayoutFeatures()` | 目前 layout 設定 |
| `detachContextMenu()` | 卸載右鍵選單 |
| `handleDrawingSelection` | 繪圖選取 + 屬性面板（compositor-safe） |
| `bindLayerCompositorController` | compositor 掛載後綁定；`setLayoutFeatures` 自動同步 shell/legend |
| `syncCompositorShellVisibility` | `layerCompositorManaged` 時同步 shell 圖層可見性（頁面切換等） |

### `ChartLayoutOptions`（主要欄位）

| 欄位 | 預設 | 說明 |
|------|------|------|
| `showTopBar` | `false` | 頂欄（週期、商品、設定） |
| `showLeftToolbar` | `false` | 桌機左側繪圖工具 |
| `showBottomToolbar` | `false` | 手機底部工具列 |
| `showCrosshairLegend` | `false` | 十字線 OHLC 浮層 |
| `showStatusBar` | `false` | 底部狀態列 |
| `showPropertiesPanel` | `false` | 繪圖屬性 |
| `showContextMenu` | `false` | 右鍵選單 |
| `showSettings` | `false` | TopBar 齒輪 |
| `showShortcuts` | `false` | `?` 快捷鍵說明 |
| `symbolInput` | `'manual'` | `'manual' \| 'search' \| 'none'` |
| `onSymbolSearch` | — | 有則可啟用搜尋 UI |
| `activeDrawingTool` | `'cursor'` | 初始工具 |
| `contextMenuActions` | — | 自訂右鍵項目 |
| `settings` | — | 網格、指標、畫完回游標 |
| `layerCompositorManaged` | `false` | `true` 時十字線圖例由 compositor 驅動（見 [API-LAYER.md](./API-LAYER.md)） |
| `layout` | 預設 schema | **已棄用** — 請用 `mountLayerCompositor` |
| `layoutEditor` | `false` | **已棄用** — 請用 compositor `enableLayerEditor` |

`Interval` 清單：`1s` `5s` `15s` `30s`（`SUB_SECOND_INTERVALS`）+ `1m` … `1W`（`DEFAULT_INTERVALS`）；Playground 用 `EXTENDED_INTERVALS`。

---

## 7. `DataProvider`

整合方實作或採用閘道客戶端。

### 介面

```typescript
interface DataProvider {
  getCapabilities?(): Promise<DataProviderCapabilities>;
  getHistory(query: HistoryQuery): Promise<{
    bars: Bar[];
    nextCursor?: string;
    hasMore?: boolean;
  }>;
  subscribe(params: SubscribeParams, handlers: RealtimeHandlers): Promise<Subscription>;
  unsubscribe(subscriptionId: string): Promise<void>;
  searchSymbols?(query: string): Promise<SymbolSearchHit[]>;
  requestWsHistory?(params: WsHistoryParams): Promise<Bar[]>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}
```

### `Bar`

| 欄位 | 型別 | 說明 |
|------|------|------|
| `t` | `number` | **毫秒** UTC 開盤時間 |
| `o` `h` `l` `c` | `number` | OHLC |
| `v` | `number?` | 成交量 |

### `HistoryQuery`

| mode | 用途 |
|------|------|
| `range` | `{ symbol, interval, from, to }` 毫秒區間 |
| `cursor` | 分頁 `{ limit, cursor? }` |
| `loadMore` | 見下表 |

**重要：`loadMore` 也用於首次 bootstrap**

`ChartController` 在 `setSymbol` 後第一次拉歷史時**不是** `range`，而是：

```typescript
{ mode: 'loadMore', symbol, interval, endTime: Date.now(), limit: 500 }
```

自訂 `DataProvider` 若對 `loadMore` 一律回空陣列，圖表會沒有歷史 K 線。之後使用者向左平移時，VirtualWindow 會以更早的 `endTime` 再發 `loadMore`（懶加載更舊資料）。

| `loadMore` 情境 | `endTime` | 整合方應回傳 |
|-----------------|-----------|--------------|
| 首次載入 / `setSymbol` | `Date.now()`（或接近現在） | 最近 `limit` 根 K 線 |
| 向左平移 | 目前可見區間左側時間 | 更舊的 K 線或 `[]`（無更多） |

### `SubscribeParams`

```typescript
{
  symbol: string;
  interval: Interval;
  channels?: ('bar' | 'tick')[];
  streamMode?: 'bar' | 'tick' | 'bar+tick';
}
```

### `createGatewayDataProvider`

```typescript
import { createGatewayDataProvider } from '@coderyo/data';

const provider = createGatewayDataProvider({
  restBaseUrl: 'https://api.example.com/api',
  wsUrl: 'wss://api.example.com/ws?v=1.0',
  auth: {
    getHeaders: async () => ({ Authorization: 'Bearer …' }),
  },
  reconnect: { initialDelayMs: 500, maxDelayMs: 30_000, maxAttempts: 10 },
});
```

### `SymbolResolver`

```typescript
import { createPassthroughSymbolResolver } from '@coderyo/data';

const resolver = createPassthroughSymbolResolver((q) => provider.searchSymbols!(q));
// createChart({ ..., symbolResolver: resolver })
```

---

## 8. WebView Bridge

### 建立

```typescript
import { createDefaultBridge, BRIDGE_SCHEMA_VERSION } from '@coderyo/bridge';

const bridge = createDefaultBridge({ target: window.parent, origin: '*' });
bridge.post({ type: 'custom', payload: {} });
bridge.onMessage((msg) => { /* host.* */ });
```

### Web → Native（出站）

| type | payload（主要欄位） |
|------|---------------------|
| `chart.ready` | `chartId`, `bridgeSchemaVersion`, `apiVersion`, `version` |
| `chart.resize` | `chartId`, `width`, `height` |
| `chart.connectionChange` | `chartId`, `state` |
| `chart.crosshair` | `chartId`, `time`, `price`, `ohlcv`, `symbol`, `interval` |
| `chart.visibleRange` | `chartId`, `from`, `to` |
| `chart.symbol` | `chartId`, `symbol` |
| `chart.interval` | `chartId`, `interval` |
| `chart.error` | `chartId`, `code`, `message` |
| `chart.destroyed` | `chartId` |

### Native → Web（入站）

| type | payload |
|------|---------|
| `host.setSymbol` | `{ symbol: string }` |
| `host.setInterval` | `{ interval: string }` |
| `host.setTheme` | `{ theme: 'dark' \| 'light' }` |
| `host.setShowGrid` | `{ showGrid: boolean }` |
| `host.fitContent` | — |
| `host.scrollToRealtime` | — |
| `host.resize` | `{ width?, height? }` |
| `host.setLogScale` | `{ enabled: boolean }` |
| `host.setBarSpace` | `{ px: number }` |
| `host.setVisibleRange` | `{ fromMs, toMs }` |
| `host.scrollToTimestamp` | `{ tsMs, animationMs? }` |
| `host.reloadHistory` | — |
| `host.setLocale` | `{ locale: string }` |
| `host.setFeatures` | `{ features: ChartFeatures }` |
| `host.setIndicatorConfig` | `{ config: IndicatorConfig }` |
| `host.clearAllIndicators` | — |
| `host.clearAllDrawings` | — |
| `host.setDrawingTool` | `{ tool: DrawingTool }` |
| `host.setChartPaneResizeFocus` | `{ pane: 'main' \| 'volume' \| 'indicator' \| 'all' }` — 無效 `pane` 觸發 outbound `chart.error`（`INVALID_PANE`） |
| `host.destroy` | — |

**P2 掛載**：`volumeMount` / `indicatorHost` 僅能透過 `createChart` 選項在建立時指定（Bridge 不動態掛載 pane）。

入站訊息需通過 `isBridgeInbound(msg)` 校驗（`@coderyo/bridge`）。

---

## 9. 繪圖 API

### `DrawingTool`

`'cursor' | 'trendline' | 'hline' | 'vline' | 'rectangle' | 'fibonacci' | 'text'`

- `features.drawings.layer === false` 時不顯示互動層，但 `setDrawingTool` 等仍可用。
- 持久化 key：`tradview:drawings:v1:{chartId}:{symbol}:{interval}`（可關 `drawings.persist`）。

### `DrawingRecord`（摘要）

```typescript
{
  id: string;
  type: string;
  symbol: string;
  interval: string;
  points: Array<{ t: number; price: number }>;
  meta?: Record<string, unknown>;
}
```

---

## 10. 指標 `IndicatorConfig`

僅在 `features.indicators` 或 `setIndicatorConfig` 傳入非 `null` 時啟用 MA 與子窗格。

```typescript
interface IndicatorConfig {
  source: 'close' | 'hlc3';
  maPeriod: number;
  volMaPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  kdjPeriod: number;
  kdjKSmooth: number;
  kdjDSmooth: number;
  showMacd: boolean;
  showRsi: boolean;
  showKdj: boolean;
  showMa: boolean;
  showVolMa: boolean;
  showVolume: boolean;
  showEma: boolean;
  emaPeriod: number;
  showBoll: boolean;
  bollPeriod: number;
  bollMult: number;
}
```

預設參數：`DEFAULT_INDICATOR_CONFIG`（`@coderyo/core` 或 `@coderyo/indicators` 匯出）。

### 輔助函式（`@coderyo/core` 再匯出）

| 函式 | 說明 |
|------|------|
| `clearedIndicatorConfig(base?)` | 關閉所有指標窗格與主圖疊加 |
| `hasVisibleIndicatorPanes(config)` | MACD / RSI / KDJ 子窗格是否可見 |
| `hasMainChartOverlays(config)` | MA / EMA / BOLL / 量 MA 是否啟用 |
| `hasAnyActiveIndicators(config)` | 上述任一為真 |
| `loadIndicatorConfig(storage, symbol, interval)` | 從 storage 讀取（`indicatorPersist` 內建使用） |
| `saveIndicatorConfig(storage, symbol, interval, config)` | 寫入 storage |
| `createLocalChartStorage()` | 預設 `localStorage` 適配器 |
| `listActiveIndicatorLayers(config)` | 列出啟用中的內建圖層（`@coderyo/indicators`） |
| `disableIndicatorLayer(config, id)` | 關閉單一圖層，回傳新 config |

### `IChart` 指標圖層（1.0.x）

```typescript
const layers = chart.listIndicatorLayers();
// [{ id: 'ma', label: 'MA (20)', target: 'main' }, …]

chart.disableIndicatorLayer('rsi');
```

等同於讀取目前 config → `disableIndicatorLayer` → `setIndicatorConfig`。當 `features.indicators === null`（預設）時，`listIndicatorLayers()` 回傳 `[]`，`disableIndicatorLayer` 為 no-op 並回傳 `clearedIndicatorConfig()`。`IndicatorLayerId`：`ma` | `ema` | `boll` | `volMa` | `volume` | `macd` | `rsi` | `kdj`。

`features.indicatorPersist: true` 時，圖表在 `setSymbol` / `setInterval` 會自動載入，在 `setIndicatorConfig` 會自動儲存。

---

## 11. CDN 全域 `TradView`

```html
<script src="https://github.com/CodeRyoStudio/tradview/releases/download/v1.0.0-rc.4/tradview.min.js"></script>
<script>
  const provider = TradView.createGatewayDataProvider({
    restBaseUrl: '/api',
    wsUrl: 'wss://' + location.host + '/ws?v=1.0',
  });
  const chart = TradView.createChart('#chart', { dataProvider: provider });
  chart.setSymbol('BINANCE:BTCUSDT').setInterval('1h');
</script>
```

| 全域屬性 | 說明 |
|----------|------|
| `TradView.createChart` | 同 npm |
| `TradView.createGatewayDataProvider` | 同 npm |
| `TradView.createDefaultBridge` | 同 npm |
| `TradView.mountChartLayout` | 同 npm |
| `TradView.TRADVIEW_API_VERSION` | `1` |
| `TradView.TRADVIEW_VERSION` | 例如 `'1.0.0-rc.4'` |
| `TradView.BRIDGE_SCHEMA_VERSION` | `1` |

---

## 12. 常數與型別匯出

### `@coderyo/core`

`createChart`, `wireChartBridge`, `IChart`, `CreateChartOptions`, `ChartController`, `ChartEvent`, `ChartFeatures`, `ResolvedChartFeatures`, `DEFAULT_CHART_FEATURES`, `resolveChartFeatures`, `PENDING_SYMBOL`, `createDemoChartFeatures`, `createDemoChartOptions`, `TRADVIEW_API_VERSION`, `TRADVIEW_VERSION`, `listActiveIndicatorLayers`, `disableIndicatorLayer`, `IndicatorLayerId`, `IndicatorLayerInfo`

僅允許從套件根匯入：`import { … } from '@coderyo/core'`（見 `public-exports.test.ts`）。

### `@coderyo/data`

`Bar`, `Interval`, `HistoryQuery`, `DataProvider`, `createGatewayDataProvider`, `SymbolResolver`, `createPassthroughSymbolResolver`, `SymbolSearchHit`, …

### `@coderyo/bridge`

`BridgeAdapter`, `createDefaultBridge`, `BRIDGE_SCHEMA_VERSION`, `BridgeOutboundType`, `BridgeInboundType`, `isBridgeInbound`

### `@coderyo/ui-shell`

`mountChartLayout`, `createDemoLayoutOptions`, `mountLayerCompositor`, `LayerController`, `mountLayerPanel`, … — 圖層章節見 [API-LAYER.md](./API-LAYER.md)。

### `@coderyo/indicators`

`IndicatorConfig`, `DEFAULT_INDICATOR_CONFIG`, `listActiveIndicatorLayers`, `disableIndicatorLayer`, `IndicatorLayerId`, `IndicatorLayerInfo`, …

---

## 相關文件

| 文件 | 內容 |
|------|------|
| [API-LAYER.md](./API-LAYER.md) | Layer compositor、preset、controller |
| [API-FRAMEWORK-PLAN.md](./API-FRAMEWORK-PLAN.md) | 三層 API 正式化計畫 |
| [EMBEDDING.md](./EMBEDDING.md) | 嵌入步驟與 feature 矩陣 |
| [API-FREEZE.md](./API-FREEZE.md) | RC 凍結範圍 |
| [DESIGN.md](./DESIGN.md) | 架構、REST/WS 協議 |
| [RELEASE.md](./RELEASE.md) | 發布與版本 bump |