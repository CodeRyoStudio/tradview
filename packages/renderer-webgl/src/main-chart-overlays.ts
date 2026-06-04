import type { Bar } from '@coderyo/data';
import {
  boll,
  ema,
  hasMainChartOverlays,
  sma,
  type IndicatorConfig,
} from '@coderyo/indicators';
import type { LineSeriesSpec } from './line-series-renderer.js';

const MA_COLOR: [number, number, number, number] = [240 / 255, 180 / 255, 41 / 255, 1];
const EMA_COLOR: [number, number, number, number] = [126 / 255, 231 / 255, 135 / 255, 1];
const BOLL_UPPER: [number, number, number, number] = [139 / 255, 148 / 255, 158 / 255, 1];
const BOLL_MID: [number, number, number, number] = [139 / 255, 148 / 255, 158 / 255, 0.55];
const BOLL_LOWER: [number, number, number, number] = [139 / 255, 148 / 255, 158 / 255, 1];

function barsForSource(bars: readonly Bar[], source: IndicatorConfig['source']): Bar[] {
  if (source === 'close') return bars as Bar[];
  return bars.map((b) => ({ ...b, c: (b.h + b.l + b.c) / 3 }));
}

/** Build main-pane overlay line specs (MA / EMA / BOLL) aligned 1:1 with `bars` indices (V2-R6). */
export function buildMainOverlayLineSpecs(
  bars: readonly Bar[],
  config: IndicatorConfig,
): LineSeriesSpec[] {
  if (bars.length === 0 || !hasMainChartOverlays(config)) return [];

  const src = barsForSource(bars, config.source);
  const lines: LineSeriesSpec[] = [];

  if (config.showMa) {
    lines.push({
      values: sma(src, config.maPeriod, 'close'),
      color: MA_COLOR,
      lineWidth: 1.5,
    });
  }
  if (config.showEma) {
    lines.push({
      values: ema(src, config.emaPeriod, 'close'),
      color: EMA_COLOR,
      lineWidth: 1.5,
    });
  }
  if (config.showBoll) {
    const bands = boll(src, config.bollPeriod, config.bollMult);
    lines.push(
      { values: bands.upper, color: BOLL_UPPER, lineWidth: 1 },
      { values: bands.middle, color: BOLL_MID, lineWidth: 1 },
      { values: bands.lower, color: BOLL_LOWER, lineWidth: 1 },
    );
  }

  return lines;
}