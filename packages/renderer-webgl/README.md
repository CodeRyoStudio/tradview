# @coderyo/renderer-webgl

WebGL2 chart renderer for TradView V2.

## Phase beta (V2-R5–R8)

- `WebGLPaneOrchestrator` — main + volume + MACD/RSI/KDJ + **MA/EMA/BOLL overlays** (V2-R6)
- **LOD** via `lodDecimateBars` + `maxRenderPoints` (V2-R8)
- **Perf**: `getRenderPerfStats()`, `runRenderBenchmark()`; `pnpm bench:webgl`; demo `?bench=1`
- Demo: `apps/playground/webgl-demo.html` (not wired to `@coderyo/core` until V2-R12)

## Usage

```ts
import { WebGLPaneOrchestrator } from '@coderyo/renderer-webgl';

const chart = new WebGLPaneOrchestrator({ debug: false });
chart.mount(document.getElementById('chart')!);
chart.setBars(bars);
// ResizeObserver keeps layout in sync; call chart.destroy() on teardown.
```

## Tests

```bash
pnpm --filter @coderyo/renderer-webgl test
pnpm check:webgl-size   # V2-R2: dist/index.js ≤ 40 KB raw (after build)
```

**CI policy (`phase_alpha`)**: Viewport, price-scale, interaction, and export allowlist run under happy-dom on every `pnpm test`. WebGL GPU paths (`webgl-integration.test.ts`) require a browser with WebGL2 — they are skipped in default CI; validate locally or in a future browser job before rc cuts.

Package version stays **`1.1.x`** until `VERSION=2.0.0-rc.N` (monorepo `sync-versions`); API is alpha until then.