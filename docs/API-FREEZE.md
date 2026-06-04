# TradView API Freeze — `1.0.0`

| 欄位 | 值 |
|------|-----|
| 套件版本 | `1.0.0`（見 repo 根目錄 `VERSION`） |
| Embed API | `apiVersion: 1`（`TRADVIEW_API_VERSION`） |
| Bridge schema | `bridgeSchemaVersion: 2`（`@coderyo/bridge@2.0.0`，hard cut） |
| 協議 | REST/WS **JSON v1.0**（Protobuf v1.1 不在 1.0 範圍） |
| 凍結日 | 2026-06-03 |

RC 之後至 `1.0.0` 正式版：僅允許 **bugfix** 與 **向後相容** 的欄位新增；**breaking** 變更累積到 `2.0.0` 或事前 ADR。

整合方 API 參考：[API.md](./API.md) · 圖層章節：[API-LAYER.md](./API-LAYER.md) · 計畫：[API-FRAMEWORK-PLAN.md](./API-FRAMEWORK-PLAN.md)。

---

## 1. npm / CDN 交付物

| 產物 | 說明 |
|------|------|
| `@coderyo/core@1.0.0` | **MIT**，整合主入口 `createChart` |
| `@coderyo/data` | **MIT**，協議型別 + `createGatewayDataProvider` |
| `@coderyo/bridge` | **MIT**，WebView `postMessage` |
| `@coderyo/series` / `virtual-window` / `renderer-lite` / `indicators` / `i18n` / `interaction` / `pine-lite` | **MIT**，子模組 |
| `@coderyo/ui-shell` / `@coderyo/drawings` | **UNLICENSED**，商業授權 |
| `tradview.min.js` | UMD 全域 `TradView`；gzip **≤ 400 KB**（CI `pnpm check:cdn-size`） |

---

## 2. 凍結：`createChart` / `IChart`（`apiVersion: 1`）

### `IChart` 方法（1.0.0）

含 RC 全部方法，並新增：

| 方法 | 說明 |
|------|------|
| `getVisibleRange()` | `{ fromMs, toMs } \| null` |
| `getBarSpace()` / `setBarSpace(px)` | 縮放柱寬 |
| `setVisibleRange(range)` | 還原可見時間範圍 |
| `scrollToTimestamp(tsMs, animationMs?)` | 時間對齊視窗右緣 |
| `reloadHistory()` | 重拉近期歷史，保留 viewport |
| `setLocale(locale)` | 切換 `@coderyo/i18n` 語系 |
| `subscribeBars(handler)` | 訂閱 `barUpdate`，回傳 unsubscribe |
| `clearAllIndicators()` | 關閉所有指標，回傳 `IndicatorConfig` |
| `clearAllDrawings()` | 刪除當前 context 全部繪圖，回傳數量 |
| `setChartPaneResizeFocus(pane)` | P2：限制 LWC `resize` 目標 pane，並將 IChart 視窗 API 綁定該 pane 的時間軸同步組 |
| `listIndicatorLayers()` | 啟用中的內建指標圖層列表 |
| `disableIndicatorLayer(id)` | 關閉單一內建指標圖層 |

### `ChartEvent`（1.0.0 新增）

| 事件 | 說明 |
|------|------|
| `telemetry` | `features.telemetry === true` 時內部追蹤事件 |

### `ChartFeatures`（1.0.0 新增欄位）

| 欄位 | 預設 | 說明 |
|------|------|------|
| `pineWorker` | `true` | 瀏覽器可用時 Pine VM 跑在 Worker |
| `gaps.whitespace` | `false` | `true` 時在資料缺口插入 LWC whitespace |
| `gaps.fillVisibleHoles` | `false` | `true` → `fill-visible-holes` fetch |
| `streamMode: 'tick'` | — | 僅 tick 訂閱時用 `TickAggregator` 合成 K 線 |
| `telemetry` | `false` | 觸發 `telemetry` 事件 |
| `protobuf` | `false` | 仍為 v1.0 JSON；`true` 時提示 v1.1 未就緒 |
| `indicatorPersist` | `false` | `true` 時自動 load/save 指標參數（`ChartStorageAdapter`） |

### `@coderyo/core` 再匯出（1.0.x 擴充）

`clearedIndicatorConfig`, `hasVisibleIndicatorPanes`, `hasMainChartOverlays`, `hasAnyActiveIndicators`, `DEFAULT_INDICATOR_CONFIG`, `loadIndicatorConfig`, `saveIndicatorConfig`, `createLocalChartStorage`, `ChartStorageAdapter`, `listActiveIndicatorLayers`, `disableIndicatorLayer`, `IndicatorLayerId`, `IndicatorLayerInfo`

### 凍結：Demo 輔助（僅 Playground / 全功能範例）

| 符號 | 套件 | 說明 |
|------|------|------|
| `createDemoChartOptions` | `@coderyo/core` | 開啟 demo 級 `ChartFeatures` |
| `createDemoChartFeatures` | `@coderyo/core` | Demo feature 預設 |
| `createDemoLayoutOptions` | `@coderyo/ui-shell` | 開啟預設 TV 殼層開關 |
| `mountLayerPanel` | `@coderyo/ui-shell` | 圖層列表面板（Playground） |

### 凍結：`@coderyo/ui-shell` 圖層公開面（Tier 3）

`mountLayerCompositor`, `LayerController`, `mountLayerPanel`, `LayerCompositorHandle`, `LayoutPreset`, `BUILTIN_PRESETS`, `VENDOR_DEFAULT_PRESET`, `cloneLayoutPreset`, `normalizeLayoutPreset`, `loadPreset`, `savePreset`, `listPresets`, `presetStorageKey`, `forkPreset`, `resolvePreset`, `deleteUserPreset`, `layoutSchemaToPreset`, `handleDrawingSelection`（layout 回傳）, `syncCompositorShellVisibility`, `layerCompositorManaged`（layout 選項）

| `syncTimeScaleGroupId`（`LayerNode`） | 圖層 preset：同組同步時間軸；空/省略 = 該 pane 獨立 |
| `bindLayerTimeScaleSync(chart, controller, opts?)` | 一次綁定 chart ↔ controller；preset / 分頁 / sync 組變更時自動 `applyTimeScaleSyncFromLayers` |
| `IChart.applyTimeScaleSyncFromLayers(layers, pageId?)` | 將 preset 同步組套用到 `PaneOrchestrator` 多 bus；`pageId` 限定作用中分頁 |
| `LayerController.setLayerSyncGroup(layerId, groupId)` | 執行期修改圖層同步組（`''` = 獨立） |
| `LayoutPreset.revision` | 整數 ≥ 1；`mergeLayoutPreset` / Bridge `host.layer.setPreset` |
| `mergeLayoutPreset` | `replace: false` 時 upsert pages/layers/groups |
| `DEFAULT_SYNC_TIME_SCALE_GROUP` | 可選預設字串；**normalize 不會**自動填入 |

---

## 3. Bridge（schema 2，hard cut）

### `chart.ready`（schema 2）

- `bridgeSchemaVersion: 2` only（不再回傳 `1`）
- `layerApi`: `{ presetVersion: 2, hostEvents[], outboundLayerEvents[] }`

### Inbound `host.layer.*`（皆需 `chartId`）

`host.layer.setSyncGroup`, `host.layer.setVisible`, `host.layer.setActivePage`, `host.layer.setPreset`, `host.layer.applyTimeScaleSync`

- `setSyncGroup`：**僅** `pane` + `allPages`（拒絕 `layerId`）
- `setPreset`：`preset.revision` 整數 ≥ 1；預設 merge（`replace` 省略或 `false`）；錯誤碼 `CHART_NOT_FOUND` | `LAYER_BRIDGE_NOT_REGISTERED` | `MISSING_CHART_ID`

### 保留 inbound `host.*`（non-layer）

`host.setSymbol`, `host.setInterval`, `host.setTheme`, `host.setShowGrid`, `host.fitContent`, `host.scrollToRealtime`, `host.setLogScale`, `host.setBarSpace`, `host.setVisibleRange`, `host.scrollToTimestamp`, `host.reloadHistory`, `host.setLocale`, `host.setFeatures`, `host.setIndicatorConfig`, `host.clearAllIndicators`, `host.clearAllDrawings`, `host.setDrawingTool`, `host.setChartPaneResizeFocus`, `host.resize`, `host.destroy`

**P2 createChart**（文件化，非 Bridge 動態掛載）：`volumeMount`, `indicatorHost`

### Outbound

| 事件 | 說明 |
|------|------|
| `chart.barUpdate` | `{ chartId, t, c }` |
| `chart.layerSyncGroupChanged` | `{ chartId, pane, groupId, allPages, activePageId }` |
| `chart.layerPageChanged` | `{ chartId, pageId, previousPageId }` |
| `chart.layerVisibleChanged` | `{ chartId, pane, visible, allPages }` |

### LayoutPreset v2 擴充

| 欄位 | 說明 |
|------|------|
| `revision` | 整數 ≥ 1；Bridge `setPreset` 防呆（`STALE_PRESET_REVISION`） |

範例：[examples/bridge-layer-sync.md](../examples/bridge-layer-sync.md) · ADR：[ADR-bridge-layer-sync.md](./ADR-bridge-layer-sync.md)

---

## 4. 資料行為（1.0.0）

- Chart `getHistory` 路徑：若 `capabilities.wsHistory` 且 provider 實作 `requestWsHistory`，優先 WS，失敗退化 REST
- 分頁恢復 / `window.focus` / WS `connected`：REST `range` 補齊自最後一根至現在的 K 線
- Pine-lite builtins：`sma`, `ema`, `rsi`, `highest`, `lowest`, `crossover`, `crossunder`

---

## 5. 刻意不在 1.0.0（留 v1.1 / v2 / 商業層）

| 項目 | 說明 |
|------|------|
| Protobuf / REST v1.1 Envelope | PR-02b |
| CDN 授權金鑰 / 域名白名單 | PR-19 商業層 |
| LWC 單路徑 180 KB gzip gate | 僅 CDN 400 KB gate |
| `@coderyo/renderer-webgl` 實作 | v2 stub |
| 完整 Pine v5 / `input()` / `strategy` | Non-Goal |

---

## 6. 驗證

```bash
pnpm check:rc
```