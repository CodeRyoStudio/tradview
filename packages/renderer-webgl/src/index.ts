export const PACKAGE_NAME = '@coderyo/renderer-webgl' as const;

export { ChartViewport, DEFAULT_BAR_SPACING, clampBarSpacing } from './chart-viewport.js';
export type { ChartViewportOptions } from './chart-viewport.js';

export { WebGL2Context, hasWebGL2 } from './webgl2-context.js';
export type { WebGL2ContextOptions, CanvasSize } from './webgl2-context.js';

export { CandlestickRenderer } from './candlestick-renderer.js';
export type { CandlestickRenderParams, PaneRect } from './candlestick-renderer.js';

export { VolumeRenderer } from './volume-renderer.js';
export type { VolumeRenderParams } from './volume-renderer.js';

export { WebGLChartPane } from './webgl-chart-pane.js';
export type { WebGLChartPaneOptions } from './webgl-chart-pane.js';

export { WebGLVolumePane } from './webgl-volume-pane.js';
export type { WebGLVolumePaneOptions } from './webgl-volume-pane.js';

export { WebGLPaneOrchestrator, isLayeredPaneMount } from './webgl-pane-orchestrator.js';
export type { WebGLPaneOrchestratorOptions } from './webgl-pane-orchestrator.js';

export { LineSeriesRenderer } from './line-series-renderer.js';
export type {
  LineSeriesRenderParams,
  LineSeriesSpec,
  HistogramSeriesSpec,
} from './line-series-renderer.js';

export { WebGLIndicatorStack } from './webgl-indicator-stack.js';
export type { WebGLIndicatorStackOptions } from './webgl-indicator-stack.js';

export { WebGLIndicatorPane } from './webgl-indicator-pane.js';
export type { WebGLIndicatorPaneId, WebGLIndicatorPaneOptions } from './webgl-indicator-pane.js';

export { ViewportSyncBus } from './viewport-sync-bus.js';

export { buildMainOverlayLineSpecs } from './main-chart-overlays.js';
export type {
  LodStats,
  RenderPerfStats,
  WebGLDrawingsOptions,
} from './webgl-pane-orchestrator.js';
export { WebGLDrawingLayer } from './webgl-drawing-layer.js';
export {
  barIndexForTimeMs,
  createChartCoordinateMapper,
  timeMsAtBarIndex,
} from './chart-coordinates.js';
export {
  buildLogicalBarLayout,
  remapGapTimesAfterDecimation,
  timeMsAtLogicalIndex,
  barIndicesInLogicalRange,
} from './logical-bar-layout.js';
export type { LogicalBarLayout } from './logical-bar-layout.js';
export { detectIndicatorBarMutation } from './indicator-bar-mutation.js';
export type {
  ChartCoordinateMapper,
  ChartCoordinateMapperOptions,
  MainPaneLayout,
} from './chart-coordinates.js';

export { DEFAULT_CHART_THEME, mergeTheme } from './theme.js';
export type { ChartThemeColors } from './theme.js';

export {
  priceRangeForBars,
  maxVolumeForBars,
  priceToY,
  yToPrice,
} from './price-scale.js';
export type { PriceRange, PriceScaleMode } from './price-scale.js';
export {
  installWebGL2TestContext,
  installWebGL2TestHarness,
  isWebGL2TestContextInstalled,
} from './webgl2-test-context.js';
export { pinePlotsToLineSpecs, type PinePlotLineInput } from './pine-overlay-lines.js';

/** Scale styling helpers (freeze-friendly); tick engines are internal. */
export {
  DEFAULT_PRICE_SCALE_OPTIONS,
  DEFAULT_TIME_SCALE_OPTIONS,
  DEFAULT_INDICATOR_PRICE_FORMAT,
  symbolFormatFromInfo,
  mergePriceScaleOptions,
  mergeTimeScaleOptions,
} from './scale/scale-types.js';
export type {
  PriceScaleOptions,
  TimeScaleOptions,
  SymbolPriceFormat,
} from './scale/scale-types.js';