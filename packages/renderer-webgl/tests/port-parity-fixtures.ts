import type { Bar } from '@coderyo/data';
import { intervalMs, type Interval } from '@coderyo/data';
import { clearedIndicatorConfig, DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { lodDecimateBars } from '@coderyo/series';
import {
  WebGLPaneOrchestrator,
  timeMsAtBarIndex,
  type WebGLPaneOrchestratorOptions,
} from '../src/index.js';

/** Shared LOD cap for lite/WebGL port-parity fixtures (matches orchestrator default). */
export const PORT_PARITY_MAX_POINTS = 4000;

const T0 = 1_700_000_000_000;
const STEP_MS = 3_600_000;

export interface PortParityVisibleRange {
  fromMs: number;
  toMs: number;
}

/** Deterministic OHLCV series used by port-parity and orchestrator tests. */
export function syntheticBars(count: number): Bar[] {
  const bars: Bar[] = [];
  for (let i = 0; i < count; i++) {
    const c = 100 + Math.sin(i / 8) * 5;
    bars.push({
      t: T0 + i * STEP_MS,
      o: c - 0.5,
      h: c + 1,
      l: c - 1,
      c,
      v: 1000 + i,
    });
  }
  return bars;
}

export function decimatedFixture(bars: readonly Bar[], maxPoints = PORT_PARITY_MAX_POINTS): Bar[] {
  return lodDecimateBars(bars as Bar[], maxPoints);
}

/** Lite `PaneOrchestrator.applyViewAfterDataReload` ms range after `setBars`. */
export function liteVisibleRangeAfterSetBars(
  bars: readonly Bar[],
  interval: Interval = '1h',
  maxPoints = PORT_PARITY_MAX_POINTS,
): PortParityVisibleRange {
  const renderBars = decimatedFixture(bars, maxPoints);
  return {
    fromMs: renderBars[0]!.t,
    toMs: renderBars[renderBars.length - 1]!.t + intervalMs(interval),
  };
}

/**
 * Lite `subscribeCrosshair` null branch (pane-orchestrator.ts) — contract reference for parity.
 */
export function liteCrosshairDispatch(
  listener: (payload: unknown) => void,
  param: { time?: number | null; point?: { x: number; y: number } | null },
): void {
  if (param.time == null || !param.point) {
    listener(null);
    return;
  }
  listener({ time: param.time, price: null, ohlcv: null });
}

export function mountWebGLOrchestrator(
  opts: Partial<WebGLPaneOrchestratorOptions> = {},
): { root: HTMLElement; orch: WebGLPaneOrchestrator } {
  const root = document.createElement('div');
  root.style.width = '800px';
  root.style.height = '600px';
  document.body.appendChild(root);
  const orch = new WebGLPaneOrchestrator({
    indicatorConfig: clearedIndicatorConfig(DEFAULT_INDICATOR_CONFIG),
    barSpacing: 8,
    initialWidth: 800,
    initialHeight: 600,
    maxRenderPoints: PORT_PARITY_MAX_POINTS,
    ...opts,
  });
  orch.mount(root);
  return { root, orch };
}

/** Ms visible range from WebGL viewport (same mapping as {@link WebGLChartRenderBackend}). */
export function webglVisibleRangeMs(
  orch: WebGLPaneOrchestrator,
  bars: readonly Bar[],
): PortParityVisibleRange | null {
  const vp = orch.getViewport();
  if (!vp || bars.length === 0 || vp.barCount <= 0) return null;
  const fromMs = timeMsAtBarIndex(bars, vp.visibleFrom);
  const toMs = timeMsAtBarIndex(bars, vp.visibleTo);
  if (toMs <= fromMs) return null;
  return { fromMs, toMs };
}