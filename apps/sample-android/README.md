# Android sample (V2-PROD stub)

GA requires **≥1** native sample with Bridge schema 3 smoke. This directory is a **compile stub** until the full WebView integration lands.

## Intended layout

```
apps/sample-android/
  app/src/main/...   # WebView + TradView bridge@3
  build.gradle.kts
```

## CI gate (planned)

- `./gradlew :app:assembleDebug`
- Post `host.workspace.createChart` with `containerId` matching WebView DOM slots

See [MIGRATION-bridge-3.md](../../docs/MIGRATION-bridge-3.md) and [EMBEDDING.md](../../docs/EMBEDDING.md).