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
};

export function indicatorConfigStorageKey(symbol: string, interval: string): string {
  return `tradview:indicators:${symbol}:${interval}`;
}