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

export { WebGLPaneOrchestrator } from './webgl-pane-orchestrator.js';
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
export type { LodStats, RenderPerfStats } from './webgl-pane-orchestrator.js';

export { DEFAULT_CHART_THEME, mergeTheme } from './theme.js';
export type { ChartThemeColors } from './theme.js';

export {
  priceRangeForBars,
  maxVolumeForBars,
  priceToY,
} from './price-scale.js';
export type { PriceRange } from './price-scale.js';