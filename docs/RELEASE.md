# TradView Release — RC / 正式版流程

## 目前版本

- **GA**：**`2.0.1`**（`VERSION` 檔為單一真相來源；`@coderyo/bridge` 獨立為 `3.0.0`）
- **上一 GA**：`2.0.0` / `1.1.1`（1.x 線）
- **API**：`apiVersion: 1` @ 1.1.x；V2 目標 `apiVersion: 2` @ GA（見 [API-FREEZE-2.0.md](./API-FREEZE-2.0.md) draft）
- **V2 規劃**：[DESIGN-v2.md](./DESIGN-v2.md)

### RC 里程碑（`2.0.0-rc.*`）

| Tag | 已交付（摘要） |
|-----|----------------|
| **rc.1** | WebGL `phase_alpha`（V2-R1–R4b）、`apps/playground/webgl-demo.html`、PR-02b-1（proto/REST types）、PR-L7a（grid `@deprecated`） |
| **rc.2** | PR-L7b、PR-02b-2、**V2-R5–R8** WebGL `phase_beta`（指標窗 + 主圖 MA/EMA/BOLL + LOD + bench；仍不接 `createChart`） |

`VERSION` 維持 **`2.0.0-rc.2`** 直至下一 RC bump；勿為 rc.1 單獨改 VERSION。

---

## 1. 發布前檢查（維護者）

```bash
pnpm install
pnpm check:rc
```

`check:rc` 依根目錄 `VERSION` 執行（見 `scripts/rc-version-gates.mjs`）：

`version:sync` → `build` → `test` → `test:scripts` → `typecheck` → `lint` → `check:webgl-size` → `build:cdn` → `check:cdn-size` →（可選）`check:lwc-size`

| 步驟 | 說明 |
|------|------|
| `test` | 含 `@coderyo/core` 的 **`arch-boundary.test.ts`**（禁止 core → ui-shell）；**勿**在 `check:rc` 重複跑 `arch:boundary` |
| `test:scripts` | `scripts/check-rc.test.mjs` — RC 步驟與 LWC skip 邏輯 |
| `check:webgl-size` | `@coderyo/renderer-webgl` `dist/index.js` raw ≤ **170 KB**（R2 40 + R5–R8 **≤40** + R11 **≤50**）；`TRADVIEW_WEBGL_MAX_KB` 可覆寫 |
| `bench:webgl` | 列印 bundle 大小；GPU 幀時請用 `webgl-demo.html?bench=1` |
| `check:lwc-size` | **僅**當 `VERSION` **不**匹配 `2.0.0` / `2.0.0-rc.N` 時執行（V2 WebGL 線跳過 LWC gate）。@ **`2.0.0-rc.2`**，`pnpm check:rc` → `test:scripts` 驗證此 skip 邏輯 |

手動邊界檢查（除錯用）：`pnpm arch:boundary`（與 `pnpm test` 內 core 測試相同）。

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