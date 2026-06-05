import type { Bar } from '@coderyo/data';
import { isVolumePaneVisible, sma, type IndicatorConfig } from '@coderyo/indicators';
import type { LineSeriesSpec } from './line-series-renderer.js';

/** Lite parity: `#58a6ff` vol MA on volume pane (`pane-orchestrator.ts`). */
const VOL_MA_COLOR: [number, number, number, number] = [
  88 / 255,
  166 / 255,
  255 / 255,
  1,
];

/** SMA on bar volume (`c` ← `v`), aligned 1:1 with lite `volMaOverlayLine`. */
export function computeVolMaValues(
  bars: readonly Bar[],
  period: number,
): (number | null)[] {
  const volBars = bars.map((b) => ({ ...b, c: b.v ?? 0 }));
  return sma(volBars as Bar[], period, 'close');
}

/** Volume-pane vol MA line spec when `showVolMa` and volume pane visible. */
export function buildVolMaLineSpec(
  bars: readonly Bar[],
  config: IndicatorConfig,
): LineSeriesSpec | null {
  if (bars.length === 0 || !config.showVolMa || !isVolumePaneVisible(config)) {
    return null;
  }
  return {
    values: computeVolMaValues(bars, config.volMaPeriod),
    color: VOL_MA_COLOR,
    lineWidth: 1,
  };
}