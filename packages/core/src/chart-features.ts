import type { RealtimeStreamMode } from '@coderyo/data';
import type { IndicatorConfig } from '@coderyo/indicators';
import type { FetchPolicy } from '@coderyo/virtual-window';

export interface ChartGapsFeatures {
  whitespace?: boolean;
  fillVisibleHoles?: boolean;
}

export interface ChartDrawingsFeatures {
  /** Show interactive drawing overlay (default false). API remains available when false. */
  layer?: boolean;
  /** Persist drawings to localStorage (default true when layer/API used). */
  persist?: boolean;
}

export interface ChartFeatures {
  fetchPolicy?: FetchPolicy;
  streamMode?: RealtimeStreamMode;
  gaps?: ChartGapsFeatures;
  drawings?: ChartDrawingsFeatures;
  /** Pass config to enable MA + indicator panes; omit/null = no indicators. */
  indicators?: IndicatorConfig | null;
  /** Save indicator params to storage (default false). */
  indicatorPersist?: boolean;
  /** Ease last candle OHLC + price line to new values (~150ms). */
  smoothPriceUpdate?: boolean;
  smoothPriceDurationMs?: number;
  /** Post-1.0 hooks — default false, no-op until implemented. */
  pineEnabled?: boolean;
  protobuf?: boolean;
  telemetry?: boolean;
  tickStream?: boolean;
}

export interface ResolvedChartFeatures {
  fetchPolicy: FetchPolicy;
  streamMode: RealtimeStreamMode;
  gaps: Required<ChartGapsFeatures>;
  drawings: Required<ChartDrawingsFeatures>;
  indicators: IndicatorConfig | null;
  indicatorPersist: boolean;
  smoothPriceUpdate: boolean;
  smoothPriceDurationMs: number;
  pineEnabled: boolean;
  protobuf: boolean;
  telemetry: boolean;
  tickStream: boolean;
}

export const DEFAULT_CHART_FEATURES: ResolvedChartFeatures = {
  fetchPolicy: 'lazy-left-only',
  streamMode: 'bar',
  gaps: { whitespace: false, fillVisibleHoles: false },
  drawings: { layer: false, persist: true },
  indicators: null,
  indicatorPersist: false,
  smoothPriceUpdate: false,
  smoothPriceDurationMs: 150,
  pineEnabled: false,
  protobuf: false,
  telemetry: false,
  tickStream: false,
};

export function resolveChartFeatures(partial?: ChartFeatures): ResolvedChartFeatures {
  const d = DEFAULT_CHART_FEATURES;
  return {
    fetchPolicy: partial?.fetchPolicy ?? d.fetchPolicy,
    streamMode: partial?.streamMode ?? d.streamMode,
    gaps: {
      whitespace: partial?.gaps?.whitespace ?? d.gaps.whitespace,
      fillVisibleHoles: partial?.gaps?.fillVisibleHoles ?? d.gaps.fillVisibleHoles,
    },
    drawings: {
      layer: partial?.drawings?.layer ?? d.drawings.layer,
      persist: partial?.drawings?.persist ?? d.drawings.persist,
    },
    indicators: partial?.indicators !== undefined ? partial.indicators : d.indicators,
    indicatorPersist: partial?.indicatorPersist ?? d.indicatorPersist,
    smoothPriceUpdate: partial?.smoothPriceUpdate ?? d.smoothPriceUpdate,
    smoothPriceDurationMs: partial?.smoothPriceDurationMs ?? d.smoothPriceDurationMs,
    pineEnabled: partial?.pineEnabled ?? d.pineEnabled,
    protobuf: partial?.protobuf ?? d.protobuf,
    telemetry: partial?.telemetry ?? d.telemetry,
    tickStream: partial?.tickStream ?? d.tickStream,
  };
}

export function mergeChartFeatures(
  current: ResolvedChartFeatures,
  patch: ChartFeatures,
): ResolvedChartFeatures {
  return resolveChartFeatures({
    fetchPolicy: patch.fetchPolicy ?? current.fetchPolicy,
    streamMode: patch.streamMode ?? current.streamMode,
    gaps: { ...current.gaps, ...patch.gaps },
    drawings: { ...current.drawings, ...patch.drawings },
    indicators: patch.indicators !== undefined ? patch.indicators : current.indicators,
    indicatorPersist: patch.indicatorPersist ?? current.indicatorPersist,
    smoothPriceUpdate: patch.smoothPriceUpdate ?? current.smoothPriceUpdate,
    smoothPriceDurationMs: patch.smoothPriceDurationMs ?? current.smoothPriceDurationMs,
    pineEnabled: patch.pineEnabled ?? current.pineEnabled,
    protobuf: patch.protobuf ?? current.protobuf,
    telemetry: patch.telemetry ?? current.telemetry,
    tickStream: patch.tickStream ?? current.tickStream,
  });
}

/** Empty chart until integrator calls setSymbol. */
export const PENDING_SYMBOL = '';