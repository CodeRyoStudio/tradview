import type { BridgeAdapter } from '@tradview/bridge';
import type { DrawingRecord, DrawingStyleMeta } from '@tradview/drawings';
import type { IndicatorConfig } from '@tradview/indicators';
import type { DataProvider } from '@tradview/data';
import { wireChartBridge, TRADVIEW_API_VERSION } from './bridge-wire.js';
import { ChartController, type ChartOptions } from './chart-controller.js';

export { TRADVIEW_API_VERSION };

export interface CreateChartOptions extends Omit<ChartOptions, 'dataProvider'> {
  dataProvider: DataProvider;
  bridge?: BridgeAdapter;
  chartId?: string;
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
  setIndicatorConfig(config: IndicatorConfig): void;
  setReturnToCursorAfterDraw(v: boolean): void;
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
    });
  }
  return chart;
}