# TradView API Freeze — `1.0.0-rc.4`

| 欄位 | 值 |
|------|-----|
| 套件版本 | `1.0.0-rc.4`（見 repo 根目錄 `VERSION`） |
| Embed API | `apiVersion: 1`（`TRADVIEW_API_VERSION`） |
| Bridge schema | `bridgeSchemaVersion: 1` |
| 協議 | REST/WS **JSON v1.0**（Protobuf 為 v1.1，**不在 RC 凍結範圍**） |
| 凍結日 | 2026-06-03 |

RC 之後至 `1.0.0` 正式版：僅允許 **bugfix** 與 **向後相容** 的欄位新增；**breaking** 變更累積到 `2.0.0` 或事前 ADR。

整合方 API 參考：[API.md](./API.md)。

---

## 1. npm / CDN 交付物

| 產物 | 說明 |
|------|------|
| `@coderyo/core@1.0.0-rc.4` | **MIT**，整合主入口 `createChart` |
| `@coderyo/data` | **MIT**，協議型別 + `createGatewayDataProvider` |
| `@coderyo/bridge` | **MIT**，WebView `postMessage` |
| `@coderyo/series` / `virtual-window` / `renderer-lite` / `indicators` / `i18n` / `interaction` / `pine-lite` | **MIT**，子模組（進階整合可直連） |
| `@coderyo/ui-shell` / `@coderyo/drawings` | **UNLICENSED**，商業授權；CDN 含 ui-shell 視為商業版 |
| `tradview.min.js` | UMD 全域 `TradView`；gzip **≤ 400 KB**（CI `pnpm check:cdn-size`） |

---

## 2. 凍結：`createChart` / `IChart`（`apiVersion: 1`）

### `CreateChartOptions`（已實作且凍結）

| 選項 | 說明 |
|------|------|
| `dataProvider` | **必填** |
| `symbol` / `interval` | 可省略 `symbol` → 空白圖直到 `setSymbol` |
| `features` | `ChartFeatures`；**最小預設**（見 [EMBEDDING.md](./EMBEDDING.md)） |
| `theme` | `'dark' \| 'light'` |
| `width` / `height` | 容器尺寸 |
| `chartId` | 繪圖儲存與 bridge 識別 |
| `indicatorHost` | 指標窗宿主元素 |
| `symbolResolver` | 可選 |
| `fetchPolicy` | **已棄用**，請用 `features.fetchPolicy` |
| `scaleMode` | `'linear' \| 'log'` |
| `showGrid` | 預設 `false` |
| `drawingDefaults.returnToCursorAfterDraw` | 預設 `false` |
| `indicatorConfig` | **已棄用**，請用 `features.indicators` |
| `bridge` | 可選 `BridgeAdapter` |
| `bridgeOutboundEvents` | Bridge outbound 白名單 |
| `bridgeCrosshairThrottleMs` | 十字線節流 |

### `ChartFeatures`（RC 新增，向後相容）

`fetchPolicy`, `streamMode`, `gaps.whitespace`, `gaps.fillVisibleHoles`, `drawings.layer`, `drawings.persist`, `indicators`, `indicatorPersist`, `pineEnabled`, `protobuf`, `telemetry`, `tickStream` — 預設見 `DEFAULT_CHART_FEATURES`。

### `IChart` 方法（已實作且凍結）

`setSymbol`, `setInterval`, `setTheme`, `setShowGrid`, `setLogScale`, `fitContent`, `scrollToRealtime`, `resize`, `setFullscreen`, `exportImage`, `on`, `off`, `searchSymbols`, `setDrawingTool`, `deleteSelectedDrawing`, `copySelectedDrawing`, `toggleLockSelectedDrawing`, `updateSelectedDrawingStyle`, `deselectDrawing`, `setIndicatorConfig`, `setReturnToCursorAfterDraw`, **`setFeatures`**, **`getFeatures`**, **`hasActiveSymbol`**, `destroy`

### `ChartEvent`（已實作且凍結）

`connectionChange`, `barUpdate`, `error`, `visibleRangeChange`, `symbolChange`, `intervalChange`, `crosshairChange`, `destroyed`, `drawingSelectionChange`, `drawingContextMenu`, `requestCursorTool`, **`featuresChange`**

### 輔助（RC 新增）

`wireChartBridge`, `resolveChartFeatures`, `DEFAULT_CHART_FEATURES`, `PENDING_SYMBOL`, `createDemoChartFeatures`, `createDemoChartOptions`

### 常數

- `TRADVIEW_API_VERSION === 1`
- `TRADVIEW_VERSION` — 套件 semver（如 `1.0.0-rc.1`）

---

## 3. 凍結：CDN 全域 `TradView`

```ts
TradView.createChart
TradView.TRADVIEW_API_VERSION
TradView.TRADVIEW_VERSION
TradView.createGatewayDataProvider
TradView.createDefaultBridge
TradView.BRIDGE_SCHEMA_VERSION
TradView.mountChartLayout
```

---

## 4. 凍結：Bridge（schema v1）

### Web → Native（chart outbound）

`chart.ready`, `chart.resize`, `chart.connectionChange`, `chart.destroyed`, `chart.crosshair`, `chart.interval`, `chart.symbol`, `chart.visibleRange`, `chart.error`

`chart.ready.payload` 含：`chartId`, `bridgeSchemaVersion`, `apiVersion`, `version`（套件 semver，RC 新增、向後相容）

### Native → Web（host inbound）

`host.setSymbol`, `host.setInterval`, `host.setTheme`, `host.setShowGrid`, `host.fitContent`, `host.scrollToRealtime`, `host.resize`, `host.destroy`

---

## 5. 凍結：`mountChartLayout`（ui-shell）

**殼層預設全關**（RC integrator 變更）：`showTopBar`, `showLeftToolbar`, `showBottomToolbar`, `showCrosshairLegend`, `showStatusBar`, `showPropertiesPanel`, `showContextMenu`, `showSettings`, `showShortcuts` 皆預設 `false`。

`ChartLayoutOptions` 另含：`activeDrawingTool`, `onDrawingToolSelect`, `symbolInput`（`'manual' \| 'search' \| 'none'`）, `settings`, TopBar 回呼等。

執行期：`setLayoutFeatures` / `getLayoutFeatures`；Demo 用 `createDemoLayoutOptions`。

---

## 6. 凍結：資料協議 v1.0 JSON

- `Bar.t` 為 **毫秒** UTC；WS/REST 歷史三模式：`range` | `cursor` | `loadMore`
- `barSeq` 為 **string**（禁止 JSON Number）
- Mock gateway 必須實作 `GET /capabilities` 與 WS `history.request`

詳見 [DESIGN.md](./DESIGN.md) §8。

---

## 7. RC 尚未凍結 / 1.0.0 前可能補上（非 breaking 承諾）

以下在 DESIGN 有描述，但 **不計入 RC API 保證**；可能以 minor/patch 加入：

| 項目 | 說明 |
|------|------|
| `pineEnabled` + Pine 執行 | 目前 compile/VM 為 stub |
| `telemetry` / `setLocale` / `subscribeBars` | 未暴露在 `IChart` |
| `fetchPolicy: fill-visible-holes` | VirtualWindow 支援，chart 預設未改 |
| WS `requestWsHistory` 自動 fallback | gateway 有，chart 路徑未接 |
| `streamMode: tick` / `TickAggregator` | 型別與 mock 有，chart 僅 `bar` |
| Protobuf / REST v1.1 Envelope | PR-02b |
| `host.setLogScale` 等擴充 host 事件 | PR-15 |
| CDN 授權金鑰 / 域名白名單 | PR-19 商業層 |
| LWC 單路徑 180 KB gzip gate | 僅 CDN 400 KB gate |
| `@coderyo/renderer-webgl` | v2 stub |

---

## 8. 驗證

```bash
pnpm check:rc
```

含：build、test、typecheck、lint、CDN build、`check:cdn-size`。