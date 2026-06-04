# TradView Release — RC / 正式版流程

## 目前版本

- **正式**：`1.1.0`（`VERSION` 檔為單一真相來源；`@coderyo/bridge` 獨立為 `2.0.0`）
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

## 3. 發布 npm（建議：CI + 網頁授權，無本機 OTP）

本機 `pnpm publish` 若帳號開啟 2FA，會要求 OTP。建議改用 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 的 **`publish-npm`** job（推送 `v*` 標籤或手動 **Run workflow**），在 **npm 網站** 完成一次性授權即可。

### 方式 A — Trusted Publishing（推薦，不需 GitHub Secret）

完整步驟見 **[TRUSTED-PUBLISHING.md](./TRUSTED-PUBLISHING.md)**。列出連結：`node scripts/print-trusted-publisher-links.mjs`。

對 **每一個** 要發布的套件，在 [npmjs.com](https://www.npmjs.com) → 套件 → **Settings** → **Trusted publishing** → **GitHub Actions**，填：

| 欄位 | 值 |
|------|-----|
| Organization or user | `CodeRyoStudio` |
| Repository | `tradview` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` |

需設定的套件（與 monorepo 一致）：

`@coderyo/bridge`（2.x 獨立版本）、`@coderyo/core`、`@coderyo/data`、`@coderyo/series`、`@coderyo/virtual-window`、`@coderyo/renderer-lite`、`@coderyo/renderer-webgl`、`@coderyo/interaction`、`@coderyo/pine-lite`、`@coderyo/indicators`、`@coderyo/i18n`、`@coderyo/drawings`、`@coderyo/ui-shell`

設定完成後：

1. GitHub → **Actions** → **Release** → **Run workflow**（可重跑 **1.1.0**，無需重打標籤）
2. 或推送新標籤 `v*`，會自動執行 `publish-npm`

說明：[npm Trusted publishing](https://docs.npmjs.com/trusted-publishers)

### 方式 B — 網頁建立 Automation Token（適合懶得逐包設 Trusted Publisher）

1. [npmjs.com](https://www.npmjs.com) → 頭像 → **Access Tokens** → **Generate New Token** → **Granular Access Token**
2. 權限：`@coderyo/*` **Read and write**；勾選 **Bypass 2FA for automation**（僅限 CI）
3. GitHub repo → **Settings** → **Secrets** → **Actions** → 新增 `NPM_TOKEN`
4. 再跑 **Release** workflow（同上）

CI 會優先使用 OIDC；若未設 Trusted Publisher 則使用 `NPM_TOKEN`。

### 本機發布（需 OTP，一般不建議）

```bash
pnpm check:rc
pnpm -r publish --access public --tag latest --no-git-checks --otp=******
```

- **MIT 包**：`@coderyo/core`, `data`, `bridge`, `series`, …
- **UNLICENSED 包**：`@coderyo/ui-shell`, `@coderyo/drawings` — 發布前確認授權策略；整合方需商業許可。

安裝範例：

```bash
npm install @coderyo/core@1.1.0 @coderyo/bridge@2.0.0
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