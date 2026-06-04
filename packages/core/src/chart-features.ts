import type { Interval, RealtimeStreamMode } from '@coderyo/data';
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

export type ChartRendererBackend = 'lite' | 'webgl';

export interface ChartFeatures {
  /** Chart render backend (default `webgl` @ GA; `lite` explicit opt-in). */
  renderer?: ChartRendererBackend;
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
  /** Pine-lite script source (requires pineEnabled). */
  pineScript?: string | null;
  /** Post-1.0 hooks — default false. */
  pineEnabled?: boolean;
  protobuf?: boolean;
  telemetry?: boolean;
  tickStream?: boolean;
  /** Run Pine-lite VM in a Web Worker when available (default true). */
  pineWorker?: boolean;
  /**
   * On interval/symbol reload, set bar spacing (px) for the interval (default true).
   * Does not choose how many bars are visible — use history limit / setVisibleRange.
   */
  autoBarSpacingOnInterval?: boolean;
  /** Override default bar spacing per interval (integrator). */
  barSpacingByInterval?: Partial<Record<Interval, number>>;
}

export interface ResolvedChartFeatures {
  renderer: ChartRendererBackend;
  fetchPolicy: FetchPolicy;
  streamMode: RealtimeStreamMode;
  gaps: Required<ChartGapsFeatures>;
  drawings: Required<ChartDrawingsFeatures>;
  indicators: IndicatorConfig | null;
  indicatorPersist: boolean;
  smoothPriceUpdate: boolean;
  smoothPriceDurationMs: number;
  pineScript: string | null;
  pineEnabled: boolean;
  protobuf: boolean;
  telemetry: boolean;
  tickStream: boolean;
  pineWorker: boolean;
  autoBarSpacingOnInterval: boolean;
  barSpacingByInterval?: Partial<Record<Interval, number>>;
}

export const DEFAULT_CHART_FEATURES: ResolvedChartFeatures = {
  renderer: 'webgl',
  fetchPolicy: 'lazy-left-only',
  streamMode: 'bar',
  gaps: { whitespace: false, fillVisibleHoles: false },
  drawings: { layer: false, persist: true },
  indicators: null,
  indicatorPersist: false,
  smoothPriceUpdate: false,
  smoothPriceDurationMs: 150,
  pineScript: null,
  pineEnabled: false,
  protobuf: false,
  telemetry: false,
  tickStream: false,
  pineWorker: true,
  autoBarSpacingOnInterval: true,
  barSpacingByInterval: undefined,
};

export function resolveChartFeatures(partial?: ChartFeatures): ResolvedChartFeatures {
  const d = DEFAULT_CHART_FEATURES;
  return {
    renderer: partial?.renderer ?? d.renderer,
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
    pineScript: partial?.pineScript !== undefined ? partial.pineScript : d.pineScript,
    pineEnabled: partial?.pineEnabled ?? d.pineEnabled,
    protobuf: partial?.protobuf ?? d.protobuf,
    telemetry: partial?.telemetry ?? d.telemetry,
    tickStream: partial?.tickStream ?? d.tickStream,
    pineWorker: partial?.pineWorker ?? d.pineWorker,
    autoBarSpacingOnInterval: partial?.autoBarSpacingOnInterval ?? d.autoBarSpacingOnInterval,
    barSpacingByInterval: partial?.barSpacingByInterval ?? d.barSpacingByInterval,
  };
}

export function mergeChartFeatures(
  current: ResolvedChartFeatures,
  patch: ChartFeatures,
): ResolvedChartFeatures {
  return resolveChartFeatures({
    renderer: patch.renderer ?? current.renderer,
    fetchPolicy: patch.fetchPolicy ?? current.fetchPolicy,
    streamMode: patch.streamMode ?? current.streamMode,
    gaps: { ...current.gaps, ...patch.gaps },
    drawings: { ...current.drawings, ...patch.drawings },
    indicators: patch.indicators !== undefined ? patch.indicators : current.indicators,
    indicatorPersist: patch.indicatorPersist ?? current.indicatorPersist,
    smoothPriceUpdate: patch.smoothPriceUpdate ?? current.smoothPriceUpdate,
    smoothPriceDurationMs: patch.smoothPriceDurationMs ?? current.smoothPriceDurationMs,
    pineScript: patch.pineScript !== undefined ? patch.pineScript : current.pineScript,
    pineEnabled: patch.pineEnabled ?? current.pineEnabled,
    protobuf: patch.protobuf ?? current.protobuf,
    telemetry: patch.telemetry ?? current.telemetry,
    tickStream: patch.tickStream ?? current.tickStream,
    pineWorker: patch.pineWorker ?? current.pineWorker,
    autoBarSpacingOnInterval:
      patch.autoBarSpacingOnInterval ?? current.autoBarSpacingOnInterval,
    barSpacingByInterval: patch.barSpacingByInterval ?? current.barSpacingByInterval,
  });
}

/** Empty chart until integrator calls setSymbol. */
export const PENDING_SYMBOL = '';