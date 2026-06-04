# npm Trusted Publishing（方法 A）

透過 [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers) 讓 GitHub Actions 用 OIDC 發布，**不需本機 OTP**，也**不必**在 GitHub 存 `NPM_TOKEN`。

## 1. 在每個套件網頁設定（一次性）

對下列 **13 個** 套件，各開啟 **Settings** → **Trusted publishing** → **GitHub Actions**，填入相同內容：

| 欄位 | 值 |
|------|-----|
| Organization or user | `CodeRyoStudio` |
| Repository | `tradview` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` |

執行 `node scripts/print-trusted-publisher-links.mjs` 可列印各套件設定連結。

## 2. 觸發 CI 發布

1. 確認 `main` 上 `VERSION` 與各 `package.json` 版本正確（例如 1.1.0 / bridge 2.0.0）
2. GitHub → [Actions → Release](https://github.com/CodeRyoStudio/tradview/actions/workflows/release.yml)
3. **Run workflow** → branch `main` → Run

或推送新標籤 `v*`（會同時建 GitHub Release 與跑 `publish-npm`）。

## 常見錯誤

- **`404 Not Found` on PUT `@coderyo/...`**：該套件尚未設定 Trusted Publisher，或 GitHub 欄位填錯（必須是 `CodeRyoStudio` / `tradview` / `release.yml`）。
- 設定時請用 **擁有 @coderyo 套件發布權** 的 npm 帳號登入 [npmjs.com](https://www.npmjs.com)。

## 3. 驗證

```bash
npm view @coderyo/core version
npm view @coderyo/bridge version
```

預期：`1.1.0` 與 `2.0.0`（dist-tag `latest`）。

## 疑難排解

| 錯誤 | 處理 |
|------|------|
| `ENEEDAUTH` / Unable to authenticate | 該套件尚未設 Trusted Publisher，或 workflow 檔名不是 `release.yml` |
| 403 on one package | 只漏設那一個套件的 Trusted publishing |
| Provenance 警告 | 公開 repo + OIDC 會自動產生 provenance，可忽略 |

**注意**：每個 npm 套件只能綁 **一組** Trusted Publisher；本 monorepo 全部指向同一 `release.yml`。