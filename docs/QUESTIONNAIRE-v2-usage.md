# TradView 2.x 使用情境釐清問卷

> **用途**：在排下一版（2.0.2+ / 2.1）前，把「誰在用、怎麼嵌、哪些已夠、哪些還欠」一次說清楚。  
> **填寫人**：產品 / 整合方 / 原生殼層負責人（可分段填）。  
> **對照**：已發 `@coderyo/*@2.0.1`；CDN 見 [v2.0.1 Release](https://github.com/CodeRyoStudio/tradview/releases/tag/v2.0.1)。

填完後請把勾選結果貼回 issue / 對話，或直接在檔案裡改 `[ ]` → `[x]` 後 commit。

---

## 0. 基本資訊

| 欄位 | 填寫 |
|------|------|
| 填寫日期 | |
| 專案／產品名稱 | |
| 目標上線版本 | `2.0.1` 直接用 / `2.0.2` patch / `2.1` minor |
| 主要整合方式 | 見 §1（可複選） |

---

## 1. 你是哪一種整合方？（必選，可複選）

勾選**所有**符合的項目：

- [ ] **A1** — 單圖：一個 `createChart` + 一個 DOM 容器  
- [ ] **A2** — 多圖 workspace：`ChartWorkspace` + compositor 槽位（2～4 格或更多）  
- [ ] **A3** — CDN 單檔 `<script src="…/tradview.min.js">`（無 bundler）  
- [ ] **A4** — npm ESM：`@coderyo/core` + `@coderyo/renderer-webgl`（Vite/Webpack 等）  
- [ ] **A5** — 原生 WebView：Android / iOS 載入 `workspace.html` + Bridge 3  
- [ ] **A6** — 僅後端／資料層：自訂 `DataProvider`，圖表由別團隊嵌  
- [ ] **A7** — 內部 Playground / demo 級，非對外產品  

**預設渲染器**（GA 預設為 WebGL；不勾 = 接受預設）：

- [ ] 必須 **WebGL only**（不接受 `features.renderer: 'lite'`）  
- [ ] 需要保留 **lite/LWC** 作為 fallback（舊機 / 除錯）  

---

## 2. 已交付能力 — 請確認「夠不夠用」

對每項勾：**[S] 滿足** / **[P] 勉強可用** / **[N] 不滿足** / **[—] 不用**

基準版本：**2.0.1**（R15 刻度 + Volume 問卷結論）。

### 2.1 主圖與視窗

| # | 能力 | S / P / N / — | 備註（不滿足時請寫現象） |
|---|------|---------------|-------------------------|
| 2.1.1 | 主圖 K 線 + 拖曳平移（橫向） | | |
| 2.1.2 | 主圖區 **垂直價格平移**（TV 式） | | |
| 2.1.3 | `setData` / 即時 tick **不重置**使用者 pan/zoom | | |
| 2.1.4 | 對數價格軸 `setLogScale` | | |
| 2.1.5 | 價格軸：拖曳縮放、雙擊還原、滾輪、最後價標籤 | | |
| 2.1.6 | 時間軸：拖曳、雙擊 fit、滾輪、動態刻度 | | |
| 2.1.7 | 十字線：價格在價軸、時間在時間軸 | | |
| 2.1.8 | `showGrid: false` 仍顯示座標軸 | | |
| 2.1.9 | 時區 `setTimezone` + ui-shell 設定持久化 | | |

### 2.2 成交量（Volume 問卷結論）

| # | 能力 | S / P / N / — | 備註 |
|---|------|---------------|------|
| 2.2.1 | 預設 **顯示 volume**；需 **明確關閉** 才隱藏 | | |
| 2.2.2 | `volumeMount` → **獨立 pane**（非僅主圖底帶） | | |
| 2.2.3 | 無 `volumeMount` 時：嵌入底帶 **或** 隱藏（依 config） | | |
| 2.2.4 | 缺 `v`：**warn only**，主圖仍顯示 | | |
| 2.2.5 | Volume 時間軸 **預設與主圖同步**；可拆 sync group | | |
| 2.2.6 | **Vol MA** 疊在 volume pane（非主圖）；WebGL ≈ lite | | |
| 2.2.7 | Volume 獨立 **量價刻度**（K/M/B） | | |

### 2.3 指標窗與多圖

| # | 能力 | S / P / N / — | 備註 |
|---|------|---------------|------|
| 2.3.1 | MACD / RSI / KDJ 各 pane **獨立價格軸** | | |
| 2.3.2 | 指標窗與主圖 **時間同步**（sync on 時） | | |
| 2.3.3 | `ChartWorkspace` 多圖 + **連結時間軸** toggle | | |
| 2.3.4 | `applyPriceScaleOptions` / `applyTimeScaleOptions`（色／字體／主圖價軸左右） | | |
| 2.3.5 | `exportImage` 截圖（含軸 overlay） | | |

### 2.4 資料與協議

| # | 能力 | S / P / N / — | 備註 |
|---|------|---------------|------|
| 2.4.1 | Mock gateway / `pnpm demo` 本地開發 | | |
| 2.4.2 | 自訂 REST+WS `DataProvider` | | |
| 2.4.3 | `features.protobuf` + WS `tradview-protobuf` | | |
| 2.4.4 | `examples/adapters/csv-rest` 參考 adapter | | |

---

## 3. 已知缺口 — 請排優先級（必選）

對每項勾 **一個**：  
**P0** = 擋上線　**P1** = 下一個 minor 要做　**P2** = 可延後　**—** = 我們不需要

| # | 缺口說明 | 文件／程式依據 | P0 / P1 / P2 / — |
|---|----------|----------------|------------------|
| 3.1 | **WebGL `gaps.whitespace`**：session 留白目前傳參但未繪製 | 附錄 A；`setBars(_gaps)` 被忽略 | |
| 3.2 | **Bridge 細項**：指標參數、清空指標/畫線、繪圖工具、全螢幕、截圖等專用 `host.*` | `DESIGN.md` §ui-shell 對照「未覆蓋」 | |
| 3.3 | **iOS Sample App**（Android 已有） | `SDK.md` tripwire | |
| 3.4 | **CDN 拆包** `tradview-webgl.min.js`（去 LWC 主路徑） | `API-FREEZE-2.0` → 2.1 | |
| 3.5 | **`postgres-ws` 參考 adapter** | `DESIGN-v2` G2-7 tripwire | |
| 3.6 | **指標窗增量 `series.update`**（效能；現多為全量 `setBars`） | 附錄 A | |
| 3.7 | **PR-19 CDN 授權／域名白名單**（商業層） | `DESIGN-v2` 北極星 | |
| 3.8 | **Pixel-perfect E2E**（視覺回歸） | `DESIGN-v2` §10.4 | |
| 3.9 | **WebGL 軸文字 MSDF**（現 2D canvas 標籤） | OQ-V2-1 | |
| 3.10 | **百分比／indexed-to-100 價格軸** | R15 non-goals → 若需要請升 P0 | |
| 3.11 | **指標 pane 左側價格軸** | R15 non-goals → 若需要請升 P0 | |
| 3.12 | **lite 路徑刻度 parity**（僅 WebGL 有 R15 軸） | R15 non-goals | |

---

## 4. 使用情境細問（依 §1 勾選填寫）

> 沒勾到的區塊可整段跳過。

### 4.A 單圖（A1）

- 成交量呈現：  
  - [ ] 只要 `volumeMount` 獨立窗  
  - [ ] 只要主圖嵌入底帶  
  - [ ] 兩種都要（不同商品／版面切換）  
  - [ ] 常完全關閉 volume  
- 是否需要 **連結另一張圖的時間軸**？ [ ] 是　[ ] 否  
- 缺 volume 資料時期望：  
  - [ ] 維持現狀（warn + 主圖照顯示）  
  - [ ] 改為自動隱藏 volume pane  

### 4.B 多圖 workspace（A2）

- 同時幾張圖？ [ ] 2　[ ] 3　[ ] 4　[ ] 4+  
- 需要同步的維度（複選）：  
  - [ ] symbol　[ ] interval　[ ] visibleRange　[ ] crosshair  
- **連結圖表**預設： [ ] 開　[ ] 關　[ ] 由使用者設定記憶  
- 各圖 volume： [ ] 每圖獨立　[ ] 僅主圖有　[ ] 不要 volume  

### 4.C CDN（A3）

- 腳本來源：  
  - [ ] GitHub Release `v2.0.1` 直鏈  
  - [ ] 自建 CDN 鏡像  
  - [ ] 內網離線包  
- 可接受單檔 gzip **~235KB**（含 lite+webgl）？ [ ] 是　[ ] 否 → 請填上限 ______ KB  
- 是否需要 **UMD 內 `ChartWorkspace`**？ [ ] 要　[ ] 不要（僅 npm）  
- 是否需要 **授權金鑰／域名白名單**（3.7）？ [ ] 要　[ ] 不要  

### 4.D npm（A4）

- 套件載入： [ ] 僅 core　[ ] core + ui-shell + bridge  
- Tree-shaking：是否需要未來 **`@coderyo/renderer-webgl` 單獨 entry**？ [ ] 是　[ ] 否  
- TypeScript：是否依賴 `IChart` 上 R15 新方法？ [ ] 是　[ ] 否  

### 4.E 原生 WebView（A5）

- 平台： [ ] Android　[ ] iOS　[ ] 兩者  
- Bridge： [ ] 已上 schema 3　[ ] 仍混 schema 2  
- 需要專用 `host.*`（對照 §3.2）請列出：  
  ```
  （例：host.setIndicatorConfig、host.exportImage、…）
  ```
- 離線／內網： [ ] 需要 bundled `tradview.min.js` 離線　[ ] 線上 CDN 即可  

### 4.F 資料層（A6）

- 行情協議： [ ] JSON WS　[ ] Protobuf WS　[ ] 僅 REST 輪詢  
- 是否需要 **第二個官方 adapter**（postgres）？ [ ] 要　[ ] 不要  
- Session / 休市 **留白**（3.1）對你們商品是否必須？ [ ] 必須　[ ] 可選　[ ] 不需要  

---

## 5. 刻度／軸客製邊界（R15 已凍結 — 請確認接受度）

R15 **只允許**：價軸左右、色、字體；**不允許**自訂 tick 演算法／格式字串。

- [ ] **接受** — 與 TradingView 預設行為一致即可  
- [ ] **不接受** — 請具體列出必須開放的 API：  
  ```
  （例：自訂 tick 數、自訂 price format 字串、…）
  ```

其他：

- 主圖價軸預設： [ ] 右　[ ] 左  
- 指標 pane 價軸： [ ] 僅右（現狀）　[ ] 需要左（→ 3.11 升 P0）  

---

## 6. 文件與支援期望

| # | 項目 | 需要？ |
|---|------|--------|
| 6.1 | 更新 `API.md` CDN 範例為 **v2.0.1** + `apiVersion: 2` | [ ] |
| 6.2 | 中文嵌入指南（`EMBEDDING.md` 補 volume/scale 範例） | [ ] |
| 6.3 | Bridge 3 遷移 checklist 代填服務 | [ ] |
| 6.4 | 視覺 UAT 錄屏／截圖對照 lite vs WebGL | [ ] |

---

## 7. 一頁摘要（填完後由負責人填寫）

| 項目 | 內容 |
|------|------|
| 整合型態（§1） | |
| §2 不滿足項（N）編號 | |
| §3 P0 清單 | |
| §3 P1 清單 | |
| 建議下一版版本號 | `2.0.2` / `2.1` / 其他：____ |
| 可明確不做（—） | |
| 其他備註 | |

---

## 8. 維護者對照（無需填寫）

| 區塊 | 對應規格 |
|------|----------|
| §2.1–2.3 | [DESIGN-v2-scale.md](./DESIGN-v2-scale.md) UAT |
| §2.2 | Volume 使用者問卷（對話結論） |
| §3 | [DESIGN-v2.md](./DESIGN-v2.md) 附錄 A、G2、tripwire |
| §5 | R15 API freeze |

*問卷版本：2026-06-05 · 對齊 release **v2.0.1***