# Bridge schema 2 — `host.layer.*` examples

Native hosts must read `chart.ready.bridgeSchemaVersion === 2` and use `layerApi.hostEvents` from the ready payload. All `host.layer.*` messages require `chartId` in the payload.

## React Native (WebView)

```javascript
// Sync main pane on every page to group "prices"
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
// Active page only: main pane independent (groupId "" clears sync)
webView.postMessage(JSON.stringify({
  type: 'host.layer.setSyncGroup',
  payload: {
    chartId: 'default',
    pane: 'main',
    groupId: '',
    allPages: false,
  },
}));
```

```javascript
// Hide volume pane on all pages
webView.postMessage(JSON.stringify({
  type: 'host.layer.setVisible',
  payload: {
    chartId: 'default',
    pane: 'volume',
    visible: false,
    allPages: true,
  },
}));
```

```javascript
// Switch active layout page (lazy time-scale bus on first visit)
webView.postMessage(JSON.stringify({
  type: 'host.layer.setActivePage',
  payload: {
    chartId: 'default',
    pageId: 'page-2',
  },
}));
```

```javascript
// Merge remote layout (omit replace or replace: false; preset.revision required)
webView.postMessage(JSON.stringify({
  type: 'host.layer.setPreset',
  payload: {
    chartId: 'default',
    replace: false,
    preset: {
      version: 2,
      revision: 4,
      id: 'remote-layout',
      name: 'Remote',
      author: 'integrator',
      pages: [{ id: 'page-2', title: 'Alt' }],
      layers: [],
      groups: [],
    },
  },
}));
```

## Android (Kotlin + WebView)

```kotlin
import android.webkit.WebView
import org.json.JSONObject

fun postLayerSyncGroup(webView: WebView, chartId: String = "default") {
    val payload = JSONObject()
        .put("type", "host.layer.setSyncGroup")
        .put(
            "payload",
            JSONObject()
                .put("chartId", chartId)
                .put("pane", "main")
                .put("groupId", "prices")
                .put("allPages", true),
        )
    val js = "window.postMessage(${payload}, '*');"
    webView.post { webView.evaluateJavascript(js, null) }
}

fun postSetActivePage(webView: WebView, pageId: String, chartId: String = "default") {
    val payload = JSONObject()
        .put("type", "host.layer.setActivePage")
        .put(
            "payload",
            JSONObject()
                .put("chartId", chartId)
                .put("pageId", pageId),
        )
    webView.post { webView.evaluateJavascript("window.postMessage(${payload}, '*');", null) }
}
```

Register `@JavascriptInterface` only if you use a custom bridge; `postMessage` matches Playground and iOS examples. Read `bridgeSchemaVersion` from the first `chart.ready` before sending `host.layer.*`.

## iOS (WKWebView)

```swift
let payload: [String: Any] = [
  "type": "host.layer.setPreset",
  "payload": [
    "chartId": "default",
    "replace": false,
    "preset": [
      "version": 2,
      "revision": 4,
      "id": "remote-layout",
      "name": "Remote",
      "author": "integrator",
      "pages": [["id": "page-2", "title": "Alt"]],
      "layers": [],
      "groups": [],
    ],
  ],
]
if let data = try? JSONSerialization.data(withJSONObject: payload),
   let json = String(data: data, encoding: .utf8) {
  webView.evaluateJavaScript("window.postMessage(\(json), '*')")
}
```

## Subscribe to outbound layer deltas (optional)

```javascript
window.addEventListener('message', (ev) => {
  const msg = ev.data;
  if (msg?.type === 'chart.layerSyncGroupChanged') {
    console.log('sync changed', msg.payload);
  }
  if (msg?.type === 'chart.layerPageChanged') {
    console.log('page changed', msg.payload);
  }
  if (msg?.type === 'chart.layerVisibleChanged') {
    console.log('visible changed', msg.payload);
  }
});
```

## Errors

| code | When |
|------|------|
| `MISSING_CHART_ID` | `chartId` omitted on `host.layer.*` |
| `CHART_NOT_FOUND` | `chartId` not registered on this WebView |
| `LAYER_BRIDGE_NOT_REGISTERED` | No `layerBridge` / `registerChartLayerBridge` |
| `SCHEMA_MISMATCH` | Unknown `host.layer.*` event type |
| `INVALID_PANE` | `pane` not `main` \| `volume` \| `indicator` |
| `INVALID_PAYLOAD` | Missing `pane`, or `layerId` on `setSyncGroup` |
| `PANE_NOT_FOUND` | No matching pane layers in scope |
| `STALE_PRESET_REVISION` | `preset.revision` &lt; Web current revision |
| `INVALID_PRESET` | Normalize / `setPreset` failed |

`host.setChartPaneResizeFocus` remains independent from sync groups (P2 resize focus).

See [ADR-bridge-layer-sync.md](../docs/ADR-bridge-layer-sync.md) for full contract.