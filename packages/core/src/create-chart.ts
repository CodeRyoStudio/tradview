import type { DataProvider } from '@tradview/data';
import { ChartController, type ChartOptions } from './chart-controller.js';

export interface CreateChartOptions extends Omit<ChartOptions, 'dataProvider'> {
  dataProvider: DataProvider;
}

export interface IChart {
  setSymbol(symbol: string): IChart;
  setInterval(interval: import('@tradview/data').Interval): IChart;
  setTheme(theme: 'dark' | 'light'): IChart;
  setLogScale(enabled: boolean): IChart;
  fitContent(): IChart;
  scrollToRealtime(): IChart;
  resize(size?: { width?: number; height?: number }): IChart;
  setFullscreen(enabled: boolean): IChart;
  exportImage(opts?: { pixelRatio?: number }): Promise<Blob>;
  on(event: import('./chart-controller.js').ChartEvent, handler: (p?: unknown) => void): IChart;
  off(event: import('./chart-controller.js').ChartEvent, handler: (p?: unknown) => void): IChart;
  destroy(): void;
}

function wrap(controller: ChartController): IChart {
  return {
    setSymbol: (s) => {
      void controller.setSymbol(s);
      return wrap(controller);
    },
    setInterval: (i) => {
      void controller.setInterval(i);
      return wrap(controller);
    },
    setTheme: (t) => {
      controller.setTheme(t);
      return wrap(controller);
    },
    setLogScale: (enabled) => {
      controller.setLogScale(enabled);
      return wrap(controller);
    },
    fitContent: () => {
      controller.fitContent();
      return wrap(controller);
    },
    scrollToRealtime: () => {
      controller.scrollToRealtime();
      return wrap(controller);
    },
    resize: (s) => {
      controller.resize(s);
      return wrap(controller);
    },
    setFullscreen: (e) => {
      controller.setFullscreen(e);
      return wrap(controller);
    },
    exportImage: (o) => controller.exportImage(o),
    on: (e, h) => {
      controller.on(e, h);
      return wrap(controller);
    },
    off: (e, h) => {
      controller.off(e, h);
      return wrap(controller);
    },
    destroy: () => controller.destroy(),
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
  return wrap(new ChartController(el, options));
}