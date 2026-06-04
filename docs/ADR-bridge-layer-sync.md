# ADR: Bridge Schema 2 — `host.layer.*` 遠端圖層控制

| 欄位 | 值 |
|------|-----|
| 狀態 | **Accepted**（兩輪問卷定案；doc-first 待 PR-B1） |
| 日期 | 2026-06-04 |
| 決策者 | 整合方 + 架構（使用者問卷定案） |
| 相關 | [API-LAYER.md](./API-LAYER.md), [API-FREEZE.md](./API-FREEZE.md), [API.md](./API.md), [API-FRAMEWORK-PLAN.md](./API-FRAMEWORK-PLAN.md) |

---

## 1. 背景

TradView 1.0.x 已在 **Web 側** 完成：

- `LayoutPreset` v2 + `LayerController`
- 時間軸分組：`syncTimeScaleGroupId` + `bindLayerTimeScaleSync` / `IChart.applyTimeScaleSyncFromLayers(layers, pageId?)`
- Bridge schema **1** 僅含 `host.setChartPaneResizeFocus`（P2 resize），**不含**遠端改圖層或 sync 組

原生 App（WebView）需要能遠端調整版面與同步行為，且接受 **Bridge schema 2** 為 breaking 變更。

---

## 2. 決策摘要（問卷定案）

| 主題 | 決策 |
|------|------|
| Bridge 範圍 | **`host.layer.*` 一族**：sync、visible、page、preset 等可遠端改 |
| Schema | **`bridgeSchemaVersion: 2`**（breaking；宿主需協商版本） |
| 多 Page | 支援 **`allPages: true`**：同一指令套到所有頁的對應 pane / 圖層 |
| 清除 sync 組 | **`groupId: ""`**（與 `LayerController.setLayerSyncGroup` 一致） |
| vs resize focus | **`host.setChartPaneResizeFocus` 與 sync 獨立**（focus 只門控 resize + IChart 視窗 API 綁定 bus） |
| 交付順序 | **doc-first**：本 ADR + contract 測試骨架 → 再實作 `wireChartBridge` |
| 文件產物 | **本 ADR**（不強制先改 API.md 全文；實作時同步 FREEZE/API §8） |

### 2.1 第二輪問卷定案（2026-06-04）

| 主題 | 決策 |
|------|------|
| `setPreset` merge | **`replace: false` 可 merge `pages` + `layers` + `groups`**（未提及欄位保留） |
| `allPages` + time-scale | **Lazy-on-visit**：`allPages` 只改 preset；**首次切到該頁**才 `applyTimeScaleSyncFromLayers` 註冊 bus |
| 出站通知 | **細分事件**：`chart.layerSyncGroupChanged` / `chart.layerPageChanged` / `chart.layerVisibleChanged` |
| `setSyncGroup` 定位 | **Schema 2.0 僅 `pane` + `allPages`**（不暴露 `layerId`） |
| Schema 1 過渡 | **Hard cut**：bundle 只宣告 `bridgeSchemaVersion: 2`，舊宿主必須升級 |
| Playground 驗收 | **Bridge 除錯面板**：可編輯 JSON payload 送出 `host.layer.*` |

### 2.2 第三輪問卷定案（2026-06-04）

| 主題 | 決策 |
|------|------|
| 版本發布 | **`@coderyo/bridge@2.0.0`**（major）；**`@coderyo/core` / `@coderyo/ui-shell@1.1.x`**；`TRADVIEW_API_VERSION` 仍 **1** |
| `visitedPageIds` 重置 | **`setSymbol` / `setInterval`** 時清空（新商品/週期視為新上下文） |
| `setPreset` merge 衝突 | **`preset.revision`（整數）**；宿主 revision **小於** Web 現值 → 拒絕 + `chart.error` `STALE_PRESET_REVISION` |
| 出站節流 | **立即 post**（原生自行 debounce） |
| 多圖 | **所有 `host.layer.*` 必須帶 `chartId`** |
| 除錯面板 | **JSON 編輯 + 入出站 log**（可複製） |
| 無效 `pane` | **`chart.error` `INVALID_PANE`**，不變更 preset |

---

## 3. 非目標

- 不在 Bridge 上推送完整 DOM / 拖曳座標串流（仍由 Web compositor 處理指標編輯）
- 不改 `createChart` 動態掛載 pane（`volumeMount` / `indicatorHost` 仍僅建立時設定）
- 不將商品/週期綁進圖層群組（UI bind group only）
- Schema 1 宿主 **不** 由本 bundle 向後相容（hard cut）

---

## 4. Schema 2 版本協商

### 4.1 出站 `chart.ready`（擴充）

```json
{
  "type": "chart.ready",
  "payload": {
    "chartId": "default",
    "bridgeSchemaVersion": 2,
    "apiVersion": 1,
    "version": "1.0.x",
    "layerApi": {
      "presetVersion": 2,
      "hostEvents": [
        "host.layer.setSyncGroup",
        "host.layer.setVisible",
        "host.layer.setActivePage",
        "host.layer.setPreset",
        "host.layer.applyTimeScaleSync"
      ],
      "outboundLayerEvents": [
        "chart.layerSyncGroupChanged",
        "chart.layerPageChanged",
        "chart.layerVisibleChanged"
      ]
    }
  }
}
```

- **`bridgeSchemaVersion: 2` only**（hard cut）：`chart.ready` 不再回傳 `1`；宿主必須依 `2` 發送 `host.layer.*`
- 保留 §6 所列 **非 layer** 的 `host.setSymbol` 等（併入 schema 2 型別表）
- 無效 payload / 未知 `host.layer.*` → `chart.error`

### 4.2 入站命名空間

所有圖層相關入站事件使用前綴 **`host.layer.`**，payload 一律含：

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `chartId` | `string` | **是** | 多 chart 同 WebView 時必填；缺省 → `chart.error` `MISSING_CHART_ID` |
| `allPages` | `boolean` | 否 | 預設 `false`；`true` 時套用到**所有 page** 上符合條件的圖層 |

---

## 5. `host.layer.*` 事件定義

### 5.1 `host.layer.setSyncGroup`

設定 chart pane 的 `syncTimeScaleGroupId`。**Schema 2.0 僅接受 `pane`（必填）**，不暴露 `layerId`。

```json
{
  "type": "host.layer.setSyncGroup",
  "payload": {
    "pane": "main",
    "groupId": "prices",
    "allPages": true
  }
}
```

| 欄位 | 說明 |
|------|------|
| `pane` | **必填**。`"main" \| "volume" \| "indicator"` → `chart.main` / `chart.volume` / `chart.indicator` |
| `groupId` | 非空字串 = 同步組 id；**`""` = 獨立 pane**（preset 清除 + renderer `null` patch） |
| `allPages` | 預設 `false`。`true`：所有 `pageId` 上該 `pane` 類型圖層皆設同一 `groupId` |

**Web 行為（必須）：**

1. 依 `pane`（+ `allPages`）更新 preset 內對應圖層的 `syncTimeScaleGroupId`
2. **Lazy-on-visit（見 §5.6）**：若 `allPages: true`，**不**立即對非 active 頁註冊 bus；僅對 **activePage** 執行 `applyTimeScaleSyncFromLayers`（或 `bindLayerTimeScaleSync` 觸發）
3. 出站 `chart.layerSyncGroupChanged`（§5.7）
4. **不**自動變更 `host.setChartPaneResizeFocus`

**錯誤：**

| code | 條件 |
|------|------|
| `INVALID_PAYLOAD` | 缺少 `pane` 或含已廢棄 `layerId` |
| `PANE_NOT_FOUND` | 作用範圍內無該 pane 類型圖層 |
| `INVALID_PANE` | `pane` 非 `main` \| `volume` \| `indicator` |
| `MISSING_CHART_ID` | 未提供 `chartId` |
| `SCHEMA_MISMATCH` | 宿主未協商 schema 2 |

---

### 5.2 `host.layer.setVisible`

```json
{
  "type": "host.layer.setVisible",
  "payload": {
    "pane": "volume",
    "visible": false,
    "allPages": true
  }
}
```

- **`pane` 必填**（同 §5.1）；`allPages` 可選
- 觸發 compositor `apply()` + `syncCompositorShellVisibility`（若 `layerCompositorManaged`）
- 出站 `chart.layerVisibleChanged`

---

### 5.3 `host.layer.setActivePage`

```json
{
  "type": "host.layer.setActivePage",
  "payload": {
    "pageId": "page-2"
  }
}
```

- 等同 `LayerController.setActivePage(pageId)`
- **Lazy-on-visit**：若該 `pageId` 尚未 apply 過 bus，此時執行 `applyTimeScaleSyncFromLayers(layers, pageId)` 並標記已訪問
- 出站 `chart.layerPageChanged`
- **不**帶 `allPages`（無意義）

---

### 5.4 `host.layer.setPreset`

原生推送 **完整或部分** LayoutPreset v2（整合方負責合法性）。

```json
{
  "type": "host.layer.setPreset",
  "payload": {
    "chartId": "default",
    "preset": {
      "version": 2,
      "revision": 3,
      "id": "remote-layout",
      "name": "Remote",
      "author": "integrator",
      "pages": [{ "id": "page-1", "title": "Chart" }],
      "layers": [],
      "groups": []
    },
    "replace": true
  }
}
```

| 欄位 | 說明 |
|------|------|
| `chartId` | **必填**（§4.2） |
| `replace` | `true`：整份覆蓋（`setPreset(normalize(preset))`）。`false`：**merge** 現有 preset 的 `pages`、`layers`、`groups`（以 id 為鍵；payload 未提及的條目 **保留**） |
| `preset.revision` | **必填**（整數 ≥ 1）。Web 維護 `controller.presetRevision`（或等價）；若 `payload.revision < current` → **`STALE_PRESET_REVISION`**，preset 不變 |

**Merge 規則（`replace: false`）：**

- `pages`：payload 內 page 依 `id` upsert；未列出的 page **保留**
- `layers`：依 `id` upsert；未列出的 layer **保留**
- `groups`：依 `id` upsert；未列出的 group **保留**
- merge 後一律 `normalizeLayoutPreset`，再 `setPreset`；成功後 `currentRevision = payload.revision`

**Web 行為：** revision 校驗 → setPreset → compositor `apply()` → active page lazy apply（§5.6）→ 視變更 **立即** 出站 §5.7

**錯誤：** `STALE_PRESET_REVISION` | `INVALID_PRESET`（normalize 失敗）

---

### 5.5 `host.layer.applyTimeScaleSync`

不修改 preset，僅依當前 preset **重新套用** bus（除錯 / 宿主在 Web 外改完 preset 後刷新）。

```json
{
  "type": "host.layer.applyTimeScaleSync",
  "payload": {
    "pageId": "page-1",
    "allPages": false
  }
}
```

| 欄位 | 說明 |
|------|------|
| `pageId` | 省略 = `controller.activePageId` |
| `allPages` | `true`：將 **所有 pageId** 標記為「待 apply」；仍只對 **當前 activePage** 立即執行 bus 註冊；其餘頁在 **首次 setActivePage** 時 apply（§5.6） |

---

### 5.6 Lazy-on-visit（時間軸 bus）

Web 維護 `visitedPageIds: Set<string>`（每 chart 實例）：

| 時機 | 行為 |
|------|------|
| `host.layer.setSyncGroup`（含 `allPages`） | 只改 **preset**；對 **activePage** 立即 `applyTimeScaleSyncFromLayers`；`allPages` 時其餘頁 **不** 觸碰 registry |
| `host.layer.setActivePage` | compositor 切頁；若 `pageId ∉ visitedPageIds`，執行 apply 並加入 set |
| `host.layer.applyTimeScaleSync` | 對指定 `pageId`（或 active）強制 apply 並標記 visited；`allPages: true` 僅標記全部 visited 意圖，仍 **不** eager 註冊非 active 頁的 LWC bus |
| `host.setSymbol` / `host.setInterval` | **清空 `visitedPageIds`**（第三輪定案）；下次切頁重新 lazy apply |

**理由：** 多頁 preset 可能有多組 sync，但僅 active 頁有掛載的 LWC；商品/週期切換視為新資料上下文，避免沿用舊 bus 註冊狀態。

---

### 5.7 出站事件（原生訂閱）

| 事件 | payload（精簡） | 觸發 |
|------|------------------|------|
| `chart.layerSyncGroupChanged` | `{ chartId, pane, groupId, allPages, activePageId }` | `setSyncGroup` 成功 |
| `chart.layerPageChanged` | `{ chartId, pageId, previousPageId }` | `setActivePage` 成功 |
| `chart.layerVisibleChanged` | `{ chartId, pane, visible, allPages }` | `setVisible` 成功 |

- **不**預設推送整份 preset（避免 payload 過大）
- **不節流**：每次成功操作立即 `post`（宿主自行 debounce）
- `groupId` 出站時 `""` 表示獨立

---

## 6. Schema 1 → 2 遷移（Hard cut）

| 項目 | 說明 |
|------|------|
| `chart.ready` | **僅** `bridgeSchemaVersion: 2` |
| 保留的 non-layer `host.*` | `host.setSymbol`, `host.setInterval`, `host.setChartPaneResizeFocus`, …（併入 schema 2 型別 union） |
| Schema 1 宿主 | **不支援**；需升級 postMessage 契約與事件表 |
| `host.layer.*` | 僅 schema 2 |

**遷移步驟（宿主）：**

1. 解析 `chart.ready.bridgeSchemaVersion === 2`
2. 訂閱 §5.7 出站（可選）
3. 改用 `pane` + `allPages` 發送 `host.layer.setSyncGroup`（勿再送 `layerId`）

---

## 7. 與現有 Web API 對照

```
Native host.layer.setSyncGroup { pane, groupId, allPages }
    → 解析為每個目標 layerId → LayerController.setLayerSyncGroup(layerId, groupId)
    → bindLayerTimeScaleSync (已綁定時)
    → IChart.applyTimeScaleSyncFromLayers(layers, activePageId)
    → PaneOrchestrator.setPaneSyncGroups({ main?, volume?, indicator? })
         // undefined = 該頁無此 pane；null = 獨立；string = 同組
```

`host.setChartPaneResizeFocus` **不**隨 `setSyncGroup` 改變。

---

## 8. Contract 測試骨架（doc-first）

實作前在 `packages/bridge/tests/` 新增：

| 檔案 | 內容 |
|------|------|
| `layer-events.schema2.test.ts` | `EXPECTED_INBOUND_SCHEMA2` 含所有 `host.layer.*`；與 `events.ts` exhaustive parity |
| `bridge-wire.layer.test.ts` | mock `LayerController` + `IChart`：setSyncGroup `""` → `setPaneSyncGroups` 含 `null`；`allPages` 更新多頁 |

`chart.ready` 測試斷言 `bridgeSchemaVersion: 2` 與 `layerApi.hostEvents` 列表。

---

## 9. 實作順序（PR 建議）

| PR | 內容 |
|----|------|
| PR-B1 | `events.ts` schema 2 型別 + contract 骨架（測試先紅） |
| PR-B2 | `wireChartBridge` layer 分支 + lazy visit 狀態 |
| PR-B3 | Playground **Bridge 除錯面板**（JSON 編輯 + **入出站 log** 可複製） |
| PR-B4 | `API-FREEZE` / `API.md` §8 表格式同步 |
| PR-B5 | 原生範例 snippet（`examples/bridge-layer-sync.md`） |

---

## 10. 開放問題

**無**（三輪問卷已關閉）。後續變更需新 ADR 修訂。

---

## 10.1 版本與套件（第三輪）

| 套件 | 版本策略 |
|------|----------|
| `@coderyo/bridge` | **2.0.0**（`BRIDGE_SCHEMA_VERSION = 2`） |
| `@coderyo/core` | **1.1.x**（`wireChartBridge` layer 分支） |
| `@coderyo/ui-shell` | **1.1.x**（preset `revision` 欄位、merge、debug 面板） |
| `TRADVIEW_API_VERSION` | 維持 **1**（圖表 API 不 breaking；Bridge 子系統 breaking） |

實作時同步 `API-FREEZE.md`：Bridge 章節標 schema 2；layer revision 為 LayoutPreset v2 擴充欄位。

---

## 11. 參考範例（原生 → Web）

```javascript
// React Native WebView
webView.postMessage(JSON.stringify({
  type: 'host.layer.setSyncGroup',
  payload: {
    chartId: 'default',
    pane: 'main',
    groupId: 'prices',
    allPages: true,
  },
}));
```

```javascript
// 僅 active 頁 main 獨立（不影響其他頁）
postMessage(JSON.stringify({
  type: 'host.layer.setSyncGroup',
  payload: { pane: 'main', groupId: '', allPages: false },
}));
```

```javascript
// merge 遠端版面（保留未提及的圖層）
postMessage(JSON.stringify({
  type: 'host.layer.setPreset',
  payload: {
    replace: false,
    preset: {
      version: 2,
      pages: [{ id: 'page-2', title: 'Alt' }],
      layers: [{ id: 'm2', pageId: 'page-2', type: 'chart.main', widgetKey: 'chartMain', frame: { x:0,y:0,w:1,h:0.7 }, zIndex: 0 }],
      groups: [],
    },
  },
}));
```

---

## 12. 決策記錄

| 日期 | 決策 |
|------|------|
| 2026-06-04 | 問卷 R1：full `host.layer.*`、schema 2、allPages、空字串清除、focus 獨立、ADR doc-first |
| 2026-06-04 | 問卷 R2：merge pages+layers+groups、lazy-on-visit、delta 出站、pane-only、hard cut、Playground debug 面板 |
| 2026-06-04 | 問卷 R3：bridge@2.0.0、revision 防呆、chartId 必填、symbol/interval 清 visited、出站立即、debug log |