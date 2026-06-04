# Android sample (V2-PROD @ GA)

Minimal **Bridge 3** WebView shell loading playground `workspace.html`.

## Build

```bash
cd apps/sample-android
./gradlew :app:assembleDebug
./gradlew :app:connectedDebugAndroidTest   # optional (emulator)
```

Point `MainActivity.PLAYGROUND_URL` at your dev server (`pnpm dev:playground` → `http://10.0.2.2:5173/workspace.html` on emulator).

## CI

Root workflow job `android-sample` runs `:app:assembleDebug` + `:app:assembleDebugAndroidTest` (compile).

See [MIGRATION-bridge-3.md](../../docs/MIGRATION-bridge-3.md) and [EMBEDDING.md](../../docs/EMBEDDING.md).