export type IndicatorSource = 'close' | 'hlc3';

export interface IndicatorConfig {
  source: IndicatorSource;
  maPeriod: number;
  showEma: boolean;
  emaPeriod: number;
  showBoll: boolean;
  bollPeriod: number;
  bollMult: number;
  volMaPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  rsiPeriod: number;
  kdjPeriod: number;
  kdjKSmooth: number;
  kdjDSmooth: number;
  showMacd: boolean;
  showRsi: boolean;
  showKdj: boolean;
  showMa: boolean;
  showVolMa: boolean;
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  source: 'close',
  maPeriod: 20,
  showEma: false,
  emaPeriod: 12,
  showBoll: false,
  bollPeriod: 20,
  bollMult: 2,
  volMaPeriod: 5,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  rsiPeriod: 14,
  kdjPeriod: 9,
  kdjKSmooth: 3,
  kdjDSmooth: 3,
  showMacd: true,
  showRsi: true,
  showKdj: true,
  showMa: true,
  showVolMa: true,
};

/** Hide all indicator panes and main-chart overlays (MA / EMA / BOLL / vol MA). */
export function clearedIndicatorConfig(base: IndicatorConfig = DEFAULT_INDICATOR_CONFIG): IndicatorConfig {
  return {
    ...base,
    showMacd: false,
    showRsi: false,
    showKdj: false,
    showEma: false,
    showBoll: false,
    showMa: false,
    showVolMa: false,
  };
}

export function indicatorConfigStorageKey(symbol: string, interval: string): string {
  return `tradview:indicators:${symbol}:${interval}`;
}