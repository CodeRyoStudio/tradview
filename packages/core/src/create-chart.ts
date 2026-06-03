import type { BridgeAdapter } from '@tradview/bridge';
import type { BridgeOutboundType } from '@tradview/bridge';
import type { DrawingRecord, DrawingStyleMeta } from '@tradview/drawings';
import type { IndicatorConfig } from '@tradview/indicators';
import type { DataProvider } from '@tradview/data';
import { wireChartBridge, TRADVIEW_API_VERSION } from './bridge-wire.js';
import { ChartController, type ChartOptions } from './chart-controller.js';
import type { ChartFeatures, ResolvedChartFeatures } from './chart-features.js';
import { TRADVIEW_VERSION } from './version.js';

export { TRADVIEW_API_VERSION, TRADVIEW_VERSION };
export type { ChartFeatures, ResolvedChartFeatures } from './chart-features.js';
export { resolveChartFeatures, DEFAULT_CHART_FEATURES, PENDING_SYMBOL } from './chart-features.js';
export { createDemoChartFeatures, createDemoChartOptions } from './demo-presets.js';

export interface CreateChartOptions extends Omit<ChartOptions, 'dataProvider'> {
  dataProvider: DataProvider;
  bridge?: BridgeAdapter;
  chartId?: string;
  /** If set, only these bridge outbound events are posted. */
  bridgeOutboundEvents?: BridgeOutboundType[];
  bridgeCrosshairThrottleMs?: number;
}

export interface IChart {
  setSymbol(symbol: string): IChart;
  setInterval(interval: import('@tradview/data').Interval): IChart;
  setTheme(theme: 'dark' | 'light'): IChart;
  setShowGrid(show: boolean): IChart;
  setLogScale(enabled: boolean): IChart;
  fitContent(): IChart;
  scrollToRealtime(): IChart;
  resize(size?: { width?: number; height?: number }): IChart;
  setFullscreen(enabled: boolean): IChart;
  exportImage(opts?: { pixelRatio?: number }): Promise<Blob>;
  on(event: import('./chart-controller.js').ChartEvent, handler: (p?: unknown) => void): IChart;
  off(event: import('./chart-controller.js').ChartEvent, handler: (p?: unknown) => void): IChart;
  searchSymbols(query: string): Promise<import('@tradview/data').SymbolSearchHit[]>;
  setDrawingTool(tool: import('@tradview/drawings').DrawingTool): IChart;
  deleteSelectedDrawing(): boolean;
  copySelectedDrawing(): DrawingRecord | null;
  toggleLockSelectedDrawing(): boolean;
  updateSelectedDrawingStyle(patch: DrawingStyleMeta): void;
  deselectDrawing(): void;
  setIndicatorConfig(config: IndicatorConfig | null): void;
  setReturnToCursorAfterDraw(v: boolean): void;
  setFeatures(patch: ChartFeatures): IChart;
  getFeatures(): ResolvedChartFeatures;
  hasActiveSymbol(): boolean;
  destroy(): void;
}

function wrap(controller: ChartController, beforeDestroy?: () => void): IChart {
  return {
    setSymbol: (s) => {
      void controller.setSymbol(s);
      return wrap(controller, beforeDestroy);
    },
    setInterval: (i) => {
      void controller.setInterval(i);
      return wrap(controller, beforeDestroy);
    },
    setTheme: (t) => {
      controller.setTheme(t);
      return wrap(controller, beforeDestroy);
    },
    setShowGrid: (show) => {
      controller.setShowGrid(show);
      return wrap(controller, beforeDestroy);
    },
    setLogScale: (enabled) => {
      controller.setLogScale(enabled);
      return wrap(controller, beforeDestroy);
    },
    fitContent: () => {
      controller.fitContent();
      return wrap(controller, beforeDestroy);
    },
    scrollToRealtime: () => {
      controller.scrollToRealtime();
      return wrap(controller, beforeDestroy);
    },
    resize: (s) => {
      controller.resize(s);
      return wrap(controller, beforeDestroy);
    },
    setFullscreen: (e) => {
      controller.setFullscreen(e);
      return wrap(controller, beforeDestroy);
    },
    exportImage: (o) => controller.exportImage(o),
    on: (e, h) => {
      controller.on(e, h);
      return wrap(controller, beforeDestroy);
    },
    off: (e, h) => {
      controller.off(e, h);
      return wrap(controller, beforeDestroy);
    },
    searchSymbols: (q) => controller.searchSymbols(q),
    setDrawingTool: (tool) => {
      controller.setDrawingTool(tool);
      return wrap(controller, beforeDestroy);
    },
    deleteSelectedDrawing: () => controller.deleteSelectedDrawing(),
    copySelectedDrawing: () => controller.copySelectedDrawing(),
    toggleLockSelectedDrawing: () => controller.toggleLockSelectedDrawing(),
    updateSelectedDrawingStyle: (p) => {
      controller.updateSelectedDrawingStyle(p);
      return wrap(controller, beforeDestroy);
    },
    deselectDrawing: () => {
      controller.deselectDrawing();
      return wrap(controller, beforeDestroy);
    },
    setIndicatorConfig: (c) => {
      controller.setIndicatorConfig(c);
      return wrap(controller, beforeDestroy);
    },
    setReturnToCursorAfterDraw: (v) => {
      controller.setReturnToCursorAfterDraw(v);
      return wrap(controller, beforeDestroy);
    },
    setFeatures: (patch) => {
      controller.setFeatures(patch);
      return wrap(controller, beforeDestroy);
    },
    getFeatures: () => controller.getFeatures(),
    hasActiveSymbol: () => controller.hasActiveSymbol(),
    destroy: () => {
      controller.destroy();
      beforeDestroy?.();
    },
  };
}

export function createChart(
  target: HTMLElement | string,
  options: CreateChartOptions,
): IChart {
  const el =
    typeof target === 'string'
      ? (document.querySelector(target) as HTMLElement | null)
      : target;
  if (!el) throw new Error('Chart container not found');
  const controller = new ChartController(el, options);
  let bridgeTeardown: (() => void) | undefined;
  const chart = wrap(controller, () => bridgeTeardown?.());
  if (options.bridge) {
    bridgeTeardown = wireChartBridge({
      controller,
      chart,
      bridge: options.bridge,
      chartId: options.chartId,
      outboundEvents: options.bridgeOutboundEvents,
      crosshairThrottleMs: options.bridgeCrosshairThrottleMs,
    });
  }
  return chart;
}