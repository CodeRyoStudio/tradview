# DESIGN v2 — Chart scale subsystem (WebGL)

> **Status:** Implementation spec for R15 (scale parity).  
> **Renderer:** `@coderyo/renderer-webgl` only for axes; LWC axes remain in `renderer-lite` for legacy path.

---

## Goals

- Every chart workspace pane exposes **full TradingView-like axes**: price + time on main, independent price on volume and each indicator pane (MACD / RSI / KDJ).
- **WebGL-only** axis drawing (2D overlay canvas); no LWC axis widgets on the WebGL path.
- **TV-close defaults** for tick density, label format, and interaction (drag scale, dbl-click reset, wheel on axis, last price tag, crosshair readout on axis).
- **Freeze-friendly API:** integrators may change **colors, fonts, price-axis position (left/right)** only — tick algorithms and format rules are fixed.
- **Symbol-driven price format** via `SymbolInfo.priceScale` / `minMove` (and log-scale labels like TV).
- **User timezone** (persisted in ui-shell preferences).
- **`showGrid: false`** still renders axes (grid and axes are separate, TV split).
- **Optional multi-chart time link** (workspace toggle).

## Non-goals

- Custom tick count, custom format strings, or per-tick styling APIs.
- LWC / `renderer-lite` axis rewrite in this phase.
- Left price scale on indicator panes (right-only default; left is main-chart option only).
- Percent / indexed-to-100 scale modes (future).

---

## Requirements matrix (user questionnaire)

| Area | Requirement | Implementation owner |
|------|-------------|----------------------|
| Scope | Main + volume + each indicator pane has **independent price axis** | `PaneScaleHost` per pane band |
| Renderer | **webgl only** | `scale-renderer.ts` 2D overlay |
| Price axis | Drag scale, dbl-click reset, wheel on axis, last-price label, crosshair readout | `scale-interaction.ts` + `scale-renderer.ts` |
| Time axis | Drag pan, dbl-click fit, wheel zoom, dynamic ticks/format, crosshair time, optional sync | `time-scale-engine.ts` + workspace link |
| Price format | `priceFormat` / `minMove`; log labels like TV | `price-scale-engine.ts` + symbol info from core |
| Timezone | User-selectable, persisted | `ui-shell` prefs + `setTimezone` |
| Visual | TV-default pixels; API = colors/fonts/position only | `PriceScaleOptions` / `TimeScaleOptions` |
| Grid | `showGrid` off → axes on | `WebGLChartPane` grid vs `PaneScaleHost` |
| Multi-chart | Optional time link toggle | `ChartWorkspace` + `linkCharts` pref |
| Release | Shippable, not placeholder | unit + integration tests |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ChartController / WebGLChartRenderBackend                     │
│  setTimezone · applyPriceScaleOptions · applyTimeScaleOptions│
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│ WebGLPaneOrchestrator                                       │
│  symbol format · timezone · scale options · time link       │
└─────┬───────────────────────────────┬───────────────────────┘
      │                               │
┌─────▼──────────────┐     ┌──────────▼───────────────────────┐
│ WebGLChartPane      │     │ WebGLIndicatorPane (×N)         │
│  main (+ embedded   │     │  independent price scale each   │
│   vol when no mount)│     │  optional time band (synced)    │
└─────┬──────────────┘     └──────────┬───────────────────────┘
      │         ┌─────────────────────┘
      │  ┌──────▼──────────────┐
      │  │ WebGLVolumePane      │  (`volumeMount`: own canvas + vol axis)
      │  └──────┬──────────────┘
      │                               │
      └──────────────┬────────────────┘
                     │
         ┌───────────▼───────────┐
         │ PaneScaleHost         │
         │  ScaleRenderer        │
         │  ScaleInteraction     │
         │  PriceScaleEngine     │
         │  TimeScaleEngine      │
         └───────────────────────┘
```

### PriceScaleEngine

- Input: visible `PriceRange` (auto from bars or user override), plot height, `PriceScaleMode`, `SymbolPriceFormat`.
- Output: tick prices + pixel Y positions (nice-number step algorithm, ~40–56px min spacing).
- Log mode: ticks computed in log space; labels show **actual prices** (TV-like).

### TimeScaleEngine

- Input: `ChartViewport`, bars, plot width, median bar interval, IANA timezone.
- Output: tick bar indices + labels (`Intl.DateTimeFormat` with dynamic granularity).
- Density: target ≥72px between labels; format switches at day / hour / minute thresholds.

### ScaleRenderer

- 2D canvas overlay (`pointer-events: none` for drawing; interaction on chart host).
- Layers: axis border, ticks, labels, last-price pill, crosshair readouts.

### ScaleInteraction

- Hit regions: price gutter (`rightPaddingPx`), bottom time band (`TIME_AXIS_CSS_PX`).
- Price: vertical drag → scale range override; wheel → zoom range; dbl-click → clear override.
- Time: horizontal drag → `viewport.pan`; wheel → `zoomBarSpacing`; dbl-click → `fitLatest`.
- Delegates plot-area events to existing `ChartInteraction` via hit-test gate.

---

## API surface (freeze-friendly)

Exposed on `IChart` / `ChartController` / `WebGLChartRenderBackend` / `WebGLPaneOrchestrator`:

```ts
setTimezone(timeZone: string): void;
applyPriceScaleOptions(opts: Partial<PriceScaleOptions>): void;
applyTimeScaleOptions(opts: Partial<TimeScaleOptions>): void;
```

```ts
interface PriceScaleOptions {
  position?: 'left' | 'right';  // default 'right'
  textColor?: string;
  borderColor?: string;
  font?: string;
  lastPriceBackground?: string;
  lastPriceTextColor?: string;
}

interface TimeScaleOptions {
  textColor?: string;
  borderColor?: string;
  font?: string;
}
```

**Not exposed:** tick count, format strings, tick algorithms, timezone format templates.

### Symbol price format (caller-supplied)

```ts
interface SymbolPriceFormat {
  precision?: number;
  minMove?: number;
}
```

Derived from `SymbolInfo` on `setSymbol` / resolve.

---

## Multi-chart optional time-scale link

- Preference: `tradview:settings:linkCharts` (`'1'` = enabled).
- `ChartWorkspace.setLinkGroup({ sync: { visibleRange: true } })` when enabled.
- Independent buses per chart when disabled (default).

---

## Independent price axes per indicator pane

- `WebGLIndicatorPane` mounts its own `PaneScaleHost` with range from visible indicator values (`valueRange` in line renderer).
- Time viewport follows `ViewportSyncBus` when pane sync group matches main.

---

## UAT checklist

- [x] Main chart: 5+ dynamic price ticks; labels respect `minMove` / precision (unit: `scale-engine.test.ts`)
- [x] Log scale: tick labels are readable prices (not log raw) (unit: `scale-engine.test.ts`)
- [x] Volume pane: independent volume ticks (K/M/B) — embedded band or `volumeMount` (`WebGLVolumePane`; unit: `formatVolumeLabel`, `webgl-pane-orchestrator.volume.test.ts`)
- [x] Volume mount: `volumeMount` → separate pane; main canvas volume ratio 0; default time sync with main (`webgl-pane-orchestrator.volume.test.ts`)
- [x] `showVolume: false` / `disableIndicatorLayer('volume')`: explicit off; main full height; layered mount hidden (unit: `webgl-chart-pane.volume.test.ts`, orchestrator volume tests)
- [x] MACD / RSI / KDJ: each shows its own price axis; panes stay aligned when sync on (unit: `webgl-indicator-pane.scale.test.ts`, `webgl-indicator-pane.sync.test.ts`)
- [x] Price gutter: drag scales, dbl-click resets auto-scale, wheel zooms (unit: `scale-interaction.test.ts`, `chart-interaction.test.ts`)
- [x] Time band: drag pans, dbl-click fits, wheel zooms; labels change with zoom level (unit: `scale-interaction.test.ts`, `scale-engine.test.ts` tick density)
- [x] Crosshair: price on price axis, time on time axis (unit: `scale-renderer.test.ts`)
- [x] Last price tag visible on price axis (unit: `scale-renderer.test.ts`)
- [x] `showGrid: false` → no grid lines, axes remain (unit: `webgl-chart-pane.volume.test.ts`)
- [x] Timezone setting changes time labels without reload (unit: `scale-engine.test.ts`)
- [x] Link charts toggle syncs visible range across workspace charts (unit: `packages/core/tests/chart-workspace.test.ts`)
- [x] Vol MA on volume pane (embedded + `volumeMount`), not main chart (unit: `volume-overlays.test.ts`, `webgl-chart-pane.volume.test.ts`; manual UAT: visual line on volume band)
- [x] No regression: plot pan/zoom still works in plot area (unit: `chart-interaction.test.ts`, `webgl-chart-pane.viewport.test.ts`)

---

## PR phases (reference only)

| Phase | Scope |
|-------|--------|
| **R15a** | Engines + unit tests (price/time ticks, format) |
| **R15b** | ScaleRenderer + PaneScaleHost; replace MVP overlay |
| **R15c** | ScaleInteraction + ChartInteraction integration |
| **R15d** | Core/workspace/ui-shell API + prefs |
| **R15e** | UAT, port-parity tests, docs freeze note |

---

## File map

| Path | Role |
|------|------|
| `packages/renderer-webgl/src/scale/scale-types.ts` | Options + defaults |
| `packages/renderer-webgl/src/scale/price-scale-engine.ts` | Tick + format |
| `packages/renderer-webgl/src/scale/time-scale-engine.ts` | Tick + TZ format |
| `packages/renderer-webgl/src/scale/scale-renderer.ts` | Draw |
| `packages/renderer-webgl/src/scale/scale-interaction.ts` | Pointer |
| `packages/renderer-webgl/src/scale/pane-scale-host.ts` | Facade |
| `packages/renderer-webgl/src/chart-axis-format.ts` | Legacy re-exports |
| `packages/renderer-webgl/src/webgl-volume-pane.ts` | Layered volume pane (`volumeMount`) |

**Removed:** static 5-tick `ChartAxisOverlay` MVP.