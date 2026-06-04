# Layer Compositor 計畫書

> 版本：0.2 · 日期：2026-06-04 · 狀態：**P0–P4 完成 · P5 遷移路徑（Playground v2-only）**

## 1. 目標

將 TradView Playground / ui-shell 從 **12×12 Grid 版面** 升級為 **自由浮動圖層（Layer）模型**：

- 所有 UI 元件（外殼、圖表 pane、繪圖、圖例）皆為可定位圖層，**可重疊（9a）**。
- 支援 **群組綁定**（整組移動、縮放、顯隱、鎖定）。
- **整合方** 發佈 `LayoutPreset` 範本；**使用者** 可修改並 **另存新範本（10a）**。
- **桌面**：自由編輯 + 圖層列表面板。
- **手機（P4）**：多 Page 導航，每頁一組圖層（類手機桌面分頁），不強制自由拖移。

**取代** Playground / compositor 整合路徑上的 `layout-schema` v1 定位；v1 grid **仍保留**供非 compositor 整合方與 `layoutSchemaToPreset()` 一次性遷移（P5 不刪除公開 v1 API）。

---

## 2. 需求定案（使用者已選）

| 項目 | 決策 |
|------|------|
| 範圍 | C — 外殼 + chart pane + overlay |
| 操作 | 位置、大小、z-index、顯隱、鎖定、圖層列表排序 |
| 綁定 | UI 群組：移動、縮放、顯隱、鎖定（不含商品/週期） |
| 版面 | 自由浮動，可重疊 |
| 範本 | 整合方 + 使用者；可改可另存 |
| 圖表 pane | **可重疊（9a）**；需「作用中 pane」焦點 |
| 手機 | 多 Page，可新增空白頁（**layout-only**：單一 LWC 實例；切頁只切換圖層子集，非獨立 chart workspace） |
| 首要場景 | 多套版面範本供選擇 |

---

## 3. 資料模型（LayoutPreset v2）

```ts
LayoutPreset {
  version: 2
  id, name, author, readonly?, forkedFrom?
  pages: Page[]           // { id, title }
  layers: LayerNode[]     // { id, pageId, type, frame, zIndex, visible, locked, groupId? }
  groups: BindGroup[]     // { id, name?, layerIds[] }
}

LayerFrame { x, y, w, h }  // 0..1 相對於 page 根容器（響應式）
LayerType = shell.* | chart.* | overlay.* | group
```

儲存鍵：`tradview:preset:v2:{id}` · 索引：`tradview:preset:v2:index`

---

## 4. 分期交付

| 階段 | 內容 | 驗收 |
|------|------|------|
| **P0** | 型別、normalize、preset 存取、預設範本、圖層列表 UI、Playground 範本選擇 | 可切換範本、圖層顯隱/鎖/z 排序 |
| **P1** | `LayerCompositor` 掛載外殼 widget；拖移/縮放；群組變換 | 頂欄/工具列可自由擺放 |
| **P2** | chart pane 圖層化 + 焦點 pane + TimeScaleBus | 主圖/量/指標可重疊調整 |
| **P3** | overlay.drawing / crosshairLegend 納入圖層樹 | 範圍 C 完整 |
| **P4** | 手機 Page 導航、新增頁 | 窄螢幕分頁體驗 |
| **P5** | Playground / `layerCompositorManaged` 改用 compositor shell；v1 grid 僅遷移 | Playground 無 12×12 定位；非 compositor 路徑仍可用 v1 |

---

## 5. 架構

```
mountChartLayout
  ├─ legacy: createLayoutGrid (v1)     … 非 compositor 整合方；遷移用
  └─ layer: mountLayerCompositor (v2)  … Playground / layerCompositorManaged

LayerCompositor
  ├─ applyPreset() → 絕對定位各 widget 根節點
  ├─ LayerController (mutate preset, events)
  └─ mountLayerPanel() (列表 UI)

ChartController / PaneOrchestrator
  └─ 容器由 layer type=chart.* 提供（P2）
```

---

## 6. 風險與緩解

| 風險 | 緩解 |
|------|------|
| 重疊導致 K 線難用 | 最小尺寸、作用中 pane、範本「平鋪」按鈕 |
| API breaking | `layoutPresetId` 新選項；v1 grid 自動 migrate |
| 多 LWC resize | ResizeObserver 監聽全部 pane 容器；`setChartPaneResizeFocus` 僅門控 LWC `.resize()` 呼叫 |
| 與先前 marketStack 類似問題 | chart 層不併入單一 flex 殼；每 pane 獨立 layer frame |

---

## 7. 實作檢查單

### P0 — 基礎與範本（本輪）

- [x] `layer/types.ts` — LayoutPreset v2 型別
- [x] `layer/normalize.ts` — 驗證、clamp frame、補齊缺層
- [x] `layer/preset-store.ts` — list / load / save / fork / delete
- [x] `layer/grid-to-preset.ts` — v1 LayoutSchema → v2 preset
- [x] `layer/default-presets.ts` — `vendor-default` 內建範本
- [x] `layer/compositor.ts` — 依 preset 絕對定位掛載
- [x] `layer/layer-controller.ts` — 變更 preset（visible/lock/zIndex/order）
- [x] `layer/layer-panel.ts` — 圖層列表 UI
- [x] `tests/layer-preset.test.ts`
- [x] `ui-shell` / `index.ts` 匯出
- [x] Playground：範本選擇 + 圖層面板入口
- [x] `pnpm --filter @coderyo/ui-shell test` 通過

### P1 — 外殼自由編輯

- [x] 拖移 layer frame（pointer）
- [x] 縮放把手（8 向或四角）
- [x] 群組框選 / groupId 編輯（Shift+拖曳框選 + 圖層面板核取）
- [x] 整組 move/resize/visible/lock
- [x] 使用者另存 preset（10a）UI

### P2 — 圖表 pane

- [x] `chart.main` / `volume` / `indicator.*` layer 掛載
- [x] 作用中 pane（z-index + 邊框）
- [x] 可選 `syncTimeScale` 群組欄位 + `applyTimeScaleSyncFromLayers` / `setLayerSyncGroup`
- [x] 與 `PaneOrchestrator` 重構接線

### P3 — Overlay 圖層

- [x] `overlay.drawing` / `overlay.crosshairLegend`
- [x] pointer-events 策略（legend/drawing wrap `none`；繪圖 canvas 在 chart.main 內由 DrawingManager 切換）

### P4 — 手機 Page

- [x] `PageNavigator` UI
- [x] 新增/刪除/重新命名頁
- [x] 每頁獨立 `pageId` 圖層子集

### P5 — Compositor 預設路徑（遷移，非刪除 v1）

- [x] Playground / `layerCompositorManaged` 使用 `createCompositorShell`（無 12×12 定位）
- [x] `layoutEditor` / `setLayoutSchema` 在 compositor 模式下為 no-op
- [x] `layoutSchemaToPreset()` 保留；v1 `LayoutSchema` 仍自 `@coderyo/ui-shell` 匯出
- [x] Playground 僅 v2 compositor
- [ ] 可選後續：內部化 v1（非 Playground 路徑）— **不在本輪範圍**

---

## 8. PR 切分建議

| PR | 標題 | 階段 |
|----|------|------|
| PR-L1 | feat(ui-shell): LayoutPreset v2 types + store | P0 |
| PR-L2 | feat(ui-shell): LayerCompositor mount + layer panel | P0 |
| PR-L3 | feat(playground): preset picker | P0 |
| PR-L4 | feat(ui-shell): shell layer drag/resize + groups | P1 |
| PR-L5 | feat(renderer): chart pane as layers | P2 |
| PR-L6 | feat(ui-shell): mobile page navigator | P4 |
| PR-L7 | chore (deferred): optional v1 internalization — out of P5 scope; v1 retained for non-compositor embeds | P5+ |

---

## 9. 本輪完成定義（P0 Done）

1. 內建 `vendor-default` 與 grid 遷移結果一致（視覺近似）。
2. Playground 可從下拉選單切換至少 2 個 preset（內建 + 使用者 fork）。
3. 圖層面板可切換 visible / lock、調整 z-index、拖曳排序。
4. 單元測試覆蓋 normalize、store（含 fork/save/delete）、grid 遷移。