import type { LineSeriesSpec } from './line-series-renderer.js';

/** Pine plot line shape from {@link @coderyo/renderer-lite} PaneOrchestrator. */
export interface PinePlotLineInput {
  title: string;
  color?: string;
  values: (number | null)[];
}

const PALETTE: [number, number, number, number][] = [
  [88 / 255, 166 / 255, 255 / 255, 1],
  [210 / 255, 168 / 255, 255 / 255, 1],
  [255 / 255, 123 / 255, 114 / 255, 1],
  [255 / 255, 166 / 255, 87 / 255, 1],
];

function hexToRgba(hex: string): [number, number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

/** Map Pine-lite plot lines to WebGL main-pane overlay specs (V2 Appendix A). */
export function pinePlotsToLineSpecs(plots: readonly PinePlotLineInput[] | null): LineSeriesSpec[] {
  if (!plots?.length) return [];
  return plots.map((plot, i) => ({
    values: plot.values,
    color: (plot.color ? hexToRgba(plot.color) : null) ?? PALETTE[i % PALETTE.length]!,
    lineWidth: 1,
  }));
}