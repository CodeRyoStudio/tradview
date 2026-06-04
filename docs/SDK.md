# TradView SDK — integrator guide (@ 2.0.0-rc.4)

| Field | Value |
|-------|-------|
| npm | `@coderyo/core@2`, `@coderyo/ui-shell@2`, `@coderyo/bridge@3`, `@coderyo/renderer-webgl@2` |
| Embed API | `TRADVIEW_API_VERSION = 2` |
| Bridge | `BRIDGE_SCHEMA_VERSION = 3` |

## Quick start (single chart)

```typescript
import { createChart } from '@coderyo/core';
import { createGatewayDataProvider } from '@coderyo/data/client';

const chart = createChart(document.getElementById('chart')!, {
  dataProvider: createGatewayDataProvider({ restBaseUrl: '/api', wsUrl: 'wss://host/ws' }),
  symbol: 'BINANCE:BTCUSDT',
  interval: '1h',
});
```

Default renderer is **WebGL** (`features.renderer: 'webgl'`). Opt into LWC: `features: { renderer: 'lite' }`.

## Multi-chart workspace (V2-A)

```typescript
import { ChartWorkspace } from '@coderyo/core';
import { createDefaultBridge } from '@coderyo/bridge';
import { createWorkspaceChartSlots } from '@coderyo/ui-shell';

const bridge = createDefaultBridge({
  origin: 'https://your-app.example',
  allowInboundOrigins: ['https://your-app.example'],
});

const { slots } = createWorkspaceChartSlots(container, { layout: 'grid2' });
const ws = new ChartWorkspace({
  workspaceId: 'main',
  dataProvider,
  bridge,
});

for (const slot of slots) {
  ws.createChart(slot.chartId, slot.element, { dataProvider, chartId: slot.chartId, symbol: '…', interval: '1h' });
}

ws.setLinkGroup({
  id: 'default',
  chartIds: slots.map((s) => s.chartId),
  sync: { symbol: true, interval: true, crosshair: true },
});
```

`sync.crosshair` uses `IChart.setCrosshair({ timeMs, price })` — cursor alignment without scrolling the viewport.

## Bridge schema 3

- Inbound: `host.*` (chart-scoped, requires `chartId`) + `host.workspace.*`
- Outbound: `chart.ready`, `chart.workspaceReady`, `chart.crosshair`, `chart.linkStateChanged`, …
- Schema 2 inbound → `chart.error` `UNSUPPORTED_BRIDGE_SCHEMA`

See [bridge-schema-3.md](./bridge-schema-3.md), [MIGRATION-bridge-3.md](./MIGRATION-bridge-3.md).

## Layout (compositor v2)

Use `mountChartLayout` with `layerCompositorManaged: true`. v1 12×12 grid API removed — migrate via `@coderyo/ui-shell/migrate`.

## Native samples

- Android: `apps/sample-android` (WebView → `workspace.html` on emulator `10.0.2.2:5173`)
- iOS: planned 2.0.1 tripwire

## References

- [DESIGN-v2.md](./DESIGN-v2.md)
- [API-FREEZE-2.0.md](./API-FREEZE-2.0.md)
- [EMBEDDING.md](./EMBEDDING.md)