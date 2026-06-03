# TradView Release — RC / 正式版流程

## 目前版本

- **RC**：`1.0.0-rc.3`（`VERSION` 檔為單一真相來源）
- **API**：`apiVersion: 1`（見 [API-FREEZE.md](./API-FREEZE.md)）

---

## 1. 發布前檢查（維護者）

```bash
pnpm install
pnpm check:rc
```

`check:rc` 會執行：`version:sync` → `build` → `test` → `typecheck` → `lint` → `build:cdn` → `check:cdn-size`。

---

## 2. Git 標籤

```bash
git add -A
git commit -m "chore(release): 1.0.0-rc.1"
git tag -a v1.0.0-rc.1 -m "TradView 1.0.0-rc.1"
git push origin main
git push origin v1.0.0-rc.1
```

推送 `v*` 標籤會觸發 [.github/workflows/release.yml](../.github/workflows/release.yml) 建置 CDN 產物並上傳 GitHub Release 附件（需 repo `contents: write`）。

---

## 3. 發布 npm（可選）

需已登入 npm（`npm login`）且對 `@coderyo` scope 有發布權。

```bash
pnpm check:rc
pnpm -r publish --access public --tag rc --no-git-checks
```

- **MIT 包**：`@coderyo/core`, `data`, `bridge`, `series`, …
- **UNLICENSED 包**：`@coderyo/ui-shell`, `@coderyo/drawings` — 發布前確認授權策略；整合方需商業許可。

安裝範例：

```bash
npm install @coderyo/core@1.0.0-rc.1
```

---

## 4. CDN 分發

RC 建議優先使用 **GitHub Release 附件** `tradview.min.js`（由 CI 產出）。

自建 CDN：

```bash
pnpm build:cdn
# 產物：bundle/cdn/dist/tradview.min.js
pnpm check:cdn-size
```

HTML：

```html
<script src="https://YOUR_CDN/tradview.min.js"></script>
<script>
  const chart = TradView.createChart('#chart', {
    dataProvider: TradView.createGatewayDataProvider({ /* ... */ }),
    symbol: 'BINANCE:BTCUSDT',
    interval: '1h',
  });
</script>
```

---

## 5. 版本 bump 慣例

1. 編輯根目錄 `VERSION`（例如 `1.0.0-rc.2` 或 `1.0.0`）
2. `pnpm version:sync`
3. 更新 `CHANGELOG.md`
4. `pnpm check:rc`
5. 標籤 + push +（可選）npm publish

| 階段 | 範例 tag | npm dist-tag |
|------|----------|--------------|
| RC | `v1.0.0-rc.1` | `rc` |
| 正式 | `v1.0.0` | `latest` |

---

## 6. 從 RC 到 `1.0.0` 正式版

- [API-FREEZE.md](./API-FREEZE.md) 凍結面 **不得 breaking**
- 關閉 RC 已知缺口中列為 **1.0.0 必須** 的項目（依產品優先級）
- `VERSION` → `1.0.0`；`pnpm publish -r --tag latest`

---

## 7. 整合方文件

- 嵌入：[EMBEDDING.md](./EMBEDDING.md)
- 架構與協議：[DESIGN.md](./DESIGN.md)