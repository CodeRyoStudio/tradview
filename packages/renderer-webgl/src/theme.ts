/** Default dark-theme colors (TradingView-adjacent). */
export interface ChartThemeColors {
  background: [number, number, number, number];
  grid: [number, number, number, number];
  bullish: [number, number, number, number];
  bearish: [number, number, number, number];
  volumeBullish: [number, number, number, number];
  volumeBearish: [number, number, number, number];
}

export const DEFAULT_CHART_THEME: ChartThemeColors = {
  background: [13 / 255, 17 / 255, 23 / 255, 1],
  grid: [48 / 255, 54 / 255, 61 / 255, 0.35],
  bullish: [38 / 255, 166 / 255, 154 / 255, 1],
  bearish: [239 / 255, 83 / 255, 80 / 255, 1],
  volumeBullish: [38 / 255, 166 / 255, 154 / 255, 0.55],
  volumeBearish: [239 / 255, 83 / 255, 80 / 255, 0.55],
};

export function mergeTheme(partial?: Partial<ChartThemeColors>): ChartThemeColors {
  if (!partial) return DEFAULT_CHART_THEME;
  return { ...DEFAULT_CHART_THEME, ...partial };
}