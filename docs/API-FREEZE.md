# TradView API Freeze — `1.0.0`

| 欄位 | 值 |
|------|-----|
| 套件版本 | `1.0.0`（見 repo 根目錄 `VERSION`） |
| Embed API | `apiVersion: 1`（`TRADVIEW_API_VERSION`） |
| Bridge schema | `bridgeSchemaVersion: 1` |
| 協議 | REST/WS **JSON v1.0**（Protobuf v1.1 不在 1.0 範圍） |
| 凍結日 | 2026-06-03 |

RC 之後至 `1.0.0` 正式版：僅允許 **bugfix** 與 **向後相容** 的欄位新增；**breaking** 變更累積到 `2.0.0` 或事前 ADR。

整合方 API 參考：[API.md](./API.md)。

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

`clearedIndicatorConfig`, `hasVisibleIndicatorPanes`, `hasMainChartOverlays`, `hasAnyActiveIndicators`, `DEFAULT_INDICATOR_CONFIG`, `loadIndicatorConfig`, `saveIndicatorConfig`, `createLocalChartStorage`, `ChartStorageAdapter`

---

## 3. Bridge（schema 1，向後相容擴充）

### 新增 inbound `host.*`

`host.setLogScale`, `host.setBarSpace`, `host.setVisibleRange`, `host.scrollToTimestamp`, `host.reloadHistory`, `host.setLocale`, `host.setFeatures`, `host.setIndicatorConfig`, `host.clearAllIndicators`, `host.clearAllDrawings`, `host.setDrawingTool`

### 新增 outbound

`chart.barUpdate` — `{ chartId, t, c }`

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