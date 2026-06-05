# TradView iOS sample (V2-PROD)

WKWebView shell mirroring `apps/sample-android`: loads the Playground workspace demo over Bridge schema 3.

## Generate Xcode project (macOS)

This repo ships Swift sources + an [XcodeGen](https://github.com/yonaskolb/XcodeGen) spec (no checked-in `.xcodeproj`).

```bash
brew install xcodegen   # or: mint install yonaskolb/XcodeGen
cd apps/sample-ios
xcodegen generate       # writes TradViewSample.xcodeproj
open TradViewSample.xcodeproj
```

Manual alternative: create a new iOS App in Xcode, add `TradViewSample/` and `TradViewSampleUITests/` as sources, set `INFOPLIST_FILE` to `TradViewSample/Info.plist`, bundle id `com.coderyo.tradview.sample`.

## Run

1. `pnpm dev:playground` on the host machine.
2. Open `TradViewSample.xcodeproj` in Xcode (macOS).
3. Run on Simulator — default URL `http://127.0.0.1:5173/workspace.html` (`Info.plist` → `PLAYGROUND_URL`).

For Simulator → host dev server use `http://127.0.0.1:5173/workspace.html` (same machine). Physical device: set your LAN IP in `Info.plist`.

## Smoke

`TradViewSampleUITests` validates allowed playground URL paths (`BridgeSmokeTests.swift`). With the dev server running, launch the app target to exercise the WebView load.