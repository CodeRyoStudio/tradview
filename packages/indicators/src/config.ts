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
  /** Volume histogram pane below main price chart. */
  showVolume: boolean;
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
  showVolume: true,
};

export function hasVisibleIndicatorPanes(config: IndicatorConfig): boolean {
  return config.showMacd || config.showRsi || config.showKdj;
}

export function hasMainChartOverlays(config: IndicatorConfig): boolean {
  return config.showMa || config.showVolMa || config.showEma || config.showBoll;
}

/** Any built-in indicator pane or main-chart overlay enabled. */
export function hasAnyActiveIndicators(config: IndicatorConfig): boolean {
  return hasVisibleIndicatorPanes(config) || hasMainChartOverlays(config);
}

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
    showVolume: false,
  };
}

export function indicatorConfigStorageKey(symbol: string, interval: string): string {
  return `tradview:indicators:${symbol}:${interval}`;
}

/** Built-in indicator layer id for per-layer remove. */
export type IndicatorLayerId =
  | 'ma'
  | 'ema'
  | 'boll'
  | 'volMa'
  | 'volume'
  | 'macd'
  | 'rsi'
  | 'kdj';

export interface IndicatorLayerInfo {
  id: IndicatorLayerId;
  label: string;
  /** Main price pane overlay vs separate indicator pane. */
  target: 'main' | 'pane';
}

/** @public List enabled built-in indicator layers for a config snapshot. */
export function listActiveIndicatorLayers(config: IndicatorConfig): IndicatorLayerInfo[] {
  const layers: IndicatorLayerInfo[] = [];
  if (config.showMa) {
    layers.push({ id: 'ma', label: `MA (${config.maPeriod})`, target: 'main' });
  }
  if (config.showEma) {
    layers.push({ id: 'ema', label: `EMA (${config.emaPeriod})`, target: 'main' });
  }
  if (config.showBoll) {
    layers.push({ id: 'boll', label: `BOLL (${config.bollPeriod})`, target: 'main' });
  }
  if (config.showVolMa) {
    layers.push({ id: 'volMa', label: `Vol MA (${config.volMaPeriod})`, target: 'main' });
  }
  if (config.showVolume) {
    layers.push({ id: 'volume', label: 'VOL', target: 'pane' });
  }
  if (config.showMacd) {
    layers.push({ id: 'macd', label: 'MACD', target: 'pane' });
  }
  if (config.showRsi) {
    layers.push({ id: 'rsi', label: `RSI (${config.rsiPeriod})`, target: 'pane' });
  }
  if (config.showKdj) {
    layers.push({ id: 'kdj', label: `KDJ (${config.kdjPeriod})`, target: 'pane' });
  }
  return layers;
}

/** @public Turn off a single built-in indicator layer; other params unchanged. */
export function disableIndicatorLayer(
  config: IndicatorConfig,
  id: IndicatorLayerId,
): IndicatorConfig {
  switch (id) {
    case 'ma':
      return { ...config, showMa: false };
    case 'ema':
      return { ...config, showEma: false };
    case 'boll':
      return { ...config, showBoll: false };
    case 'volMa':
      return { ...config, showVolMa: false };
    case 'volume':
      return { ...config, showVolume: false };
    case 'macd':
      return { ...config, showMacd: false };
    case 'rsi':
      return { ...config, showRsi: false };
    case 'kdj':
      return { ...config, showKdj: false };
    default:
      return config;
  }
}