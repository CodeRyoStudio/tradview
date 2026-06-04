import type { Bar } from '@coderyo/data';
import {
  DEFAULT_INDICATOR_CONFIG,
  hasVisibleIndicatorPanes,
  type IndicatorConfig,
} from '@coderyo/indicators';
import { lodDecimateBars } from '@coderyo/series';
import { WebGLChartPane, type WebGLChartPaneOptions } from './webgl-chart-pane.js';
import { WebGLIndicatorStack } from './webgl-indicator-stack.js';
import { ViewportSyncBus } from './viewport-sync-bus.js';
import { WebGLDrawingLayer } from './webgl-drawing-layer.js';
import type { DrawingTool } from '@coderyo/drawings';

/** Layout: main candles ~60%, volume ~15%, indicators ~25% when indicator panes visible. */
const CHART_SECTION_RATIO_WITH_INDICATORS = 0.75;
const VOLUME_RATIO_IN_CHART_SECTION = 15 / 75;
const DEFAULT_VOLUME_RATIO_SOLO = 0.22;

export interface LodStats {
  inputCount: number;
  outputCount: number;
}

export interface RenderPerfStats {
  lastRenderMs: number;
  benchAvgMs?: number;
}

export interface WebGLDrawingsOptions {
  /** Enable 2D drawing overlay (default false). */
  enabled?: boolean;
  chartId?: string;
  symbol?: string;
  interval?: string;
}

export interface WebGLPaneOrchestratorOptions extends WebGLChartPaneOptions {
  /** Initial CSS size when mount container has zero layout. */
  initialWidth?: number;
  initialHeight?: number;
  indicatorConfig?: IndicatorConfig;
  onIndicatorConfigChange?: (config: IndicatorConfig) => void;
  /** Max bars sent to GPU after LOD decimation (V2-R8, §11.5). */
  maxRenderPoints?: number;
  /** Drawing overlay (V2-R9–R11, phase_gamma). */
  drawings?: WebGLDrawingsOptions;
}

/**
 * Beta-scope orchestrator: main + volume (WebGLChartPane) + optional MACD/RSI/KDJ stack (V2-R5).
 * API shaped for future core adapter wiring (V2-R12).
 */
export class WebGLPaneOrchestrator {
  private chartHost: HTMLElement | null = null;
  private indicatorRoot: HTMLElement | null = null;
  private pane: WebGLChartPane | null = null;
  private indicators: WebGLIndicatorStack | null = null;
  private syncBus: ViewportSyncBus | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private indicatorConfig: IndicatorConfig = DEFAULT_INDICATOR_CONFIG;
  private lastBars: Bar[] = [];
  private readonly maxRenderPoints: number;
  private lodStats: LodStats = { inputCount: 0, outputCount: 0 };
  private perfStats: RenderPerfStats = { lastRenderMs: 0 };
  private readonly onIndicatorConfigChange?: (config: IndicatorConfig) => void;
  private drawingLayer: WebGLDrawingLayer | null = null;

  constructor(private readonly options: WebGLPaneOrchestratorOptions = {}) {
    this.maxRenderPoints = options.maxRenderPoints ?? 4000;
    this.indicatorConfig = options.indicatorConfig ?? DEFAULT_INDICATOR_CONFIG;
    this.onIndicatorConfigChange = options.onIndicatorConfigChange;
  }

  mount(container: HTMLElement): void {
    if (this.pane) {
      this.destroy();
    }
    this.container = container;
    container.style.display = container.style.display || 'flex';
    container.style.flexDirection = 'column';
    container.style.width = container.style.width || '100%';
    container.style.height = container.style.height || '100%';
    container.style.minHeight = '0';

    this.chartHost = document.createElement('div');
    this.chartHost.style.cssText = 'flex:1;min-height:0;width:100%;position:relative;';
    this.indicatorRoot = document.createElement('div');
    this.indicatorRoot.style.cssText = 'flex:0 0 auto;min-height:0;width:100%;display:none;';

    container.append(this.chartHost, this.indicatorRoot);

    this.pane = new WebGLChartPane(this.chartHost, {
      ...this.options,
      volumeHeightRatio: this.volumeRatioForLayout(),
    });
    this.syncBus = new ViewportSyncBus(this.pane.viewport);
    this.pane.attachSyncBus(this.syncBus);

    if (this.options.drawings?.enabled) {
      this.drawingLayer = new WebGLDrawingLayer({
        parent: this.chartHost,
        interactionHost: this.pane.getChartCanvas(),
        chartId: this.options.drawings.chartId ?? 'webgl-demo',
        symbol: this.options.drawings.symbol ?? 'DEMO',
        interval: this.options.drawings.interval ?? '1h',
        getViewport: () => this.pane?.viewport ?? null,
        getBars: () => this.lastBars,
        getLayout: () => this.pane?.getLayoutMetrics() ?? null,
      });
    }

    this.applyIndicatorLayout();
    this.observeResize();
    this.syncSize();
  }

  setBars(bars: readonly Bar[]): void {
    const inputCount = bars.length;
    const renderBars = lodDecimateBars(bars as Bar[], this.maxRenderPoints);
    this.lodStats = { inputCount, outputCount: renderBars.length };
    this.lastBars = renderBars;
    this.pane?.setData(this.lastBars);
    this.drawingLayer?.redraw();
    if (hasVisibleIndicatorPanes(this.indicatorConfig)) {
      this.indicators?.setBars(this.lastBars);
      this.syncBus?.propagate();
    }
  }

  getLodStats(): LodStats {
    return { ...this.lodStats };
  }

  getRenderPerfStats(): RenderPerfStats {
    return { ...this.perfStats };
  }

  /**
   * Run `iterations` full renders and store average ms in perf stats (V2-R7 bench).
   */
  runRenderBenchmark(iterations = 60): number {
    if (!this.pane) return 0;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      this.pane.render();
    }
    const avg = (performance.now() - t0) / iterations;
    this.perfStats = { ...this.perfStats, benchAvgMs: avg };
    return avg;
  }

  setIndicatorConfig(config: IndicatorConfig): void {
    this.indicatorConfig = config;
    this.pane?.setIndicatorConfig(config);
    this.applyIndicatorLayout();
    this.onIndicatorConfigChange?.(config);
    if (!this.indicators && hasVisibleIndicatorPanes(config)) {
      this.createIndicatorStack();
    }
    this.indicators?.setConfig(config);
    if (hasVisibleIndicatorPanes(config) && this.lastBars.length > 0) {
      this.indicators?.setBars(this.lastBars);
      this.syncBus?.propagate();
    }
    this.syncSize();
  }

  resize(width: number, height: number): void {
    if (!this.chartHost || !this.indicatorRoot) return;
    const indicatorsVisible = hasVisibleIndicatorPanes(this.indicatorConfig);
    const chartH = indicatorsVisible
      ? Math.floor(height * CHART_SECTION_RATIO_WITH_INDICATORS)
      : height;
    const indH = indicatorsVisible ? height - chartH : 0;

    this.chartHost.style.flex = indicatorsVisible ? 'none' : '1';
    this.chartHost.style.height = indicatorsVisible ? `${chartH}px` : '';
    this.indicatorRoot.style.flex = indicatorsVisible ? `0 0 ${indH}px` : '0 0 auto';
    this.indicatorRoot.style.height = indicatorsVisible ? `${indH}px` : '0';

    this.pane?.resize(width, chartH);
    this.drawingLayer?.syncOverlaySize(width, chartH);
    this.pane?.render();
    if (indicatorsVisible) {
      this.indicators?.resize();
    }
  }

  render(): void {
    const t0 = performance.now();
    this.pane?.render();
    if (hasVisibleIndicatorPanes(this.indicatorConfig)) {
      this.indicators?.resize();
    }
    this.drawingLayer?.redraw();
    this.perfStats = { ...this.perfStats, lastRenderMs: performance.now() - t0 };
  }

  setDrawingTool(tool: DrawingTool): void {
    this.drawingLayer?.setTool(tool);
  }

  getDrawingTool(): DrawingTool {
    return this.drawingLayer?.getTool() ?? 'cursor';
  }

  setDrawingsLayerVisible(visible: boolean): void {
    this.drawingLayer?.setLayerVisible(visible);
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.drawingLayer?.destroy();
    this.drawingLayer = null;
    this.indicators?.destroy();
    this.indicators = null;
    this.pane?.destroy();
    this.pane = null;
    this.syncBus = null;
    this.chartHost = null;
    this.indicatorRoot = null;
    this.container?.replaceChildren();
    this.container = null;
  }

  /** Exposed for tests and demo HUD. */
  getViewport() {
    return this.pane?.viewport ?? null;
  }

  getIndicatorConfig(): IndicatorConfig {
    return this.indicatorConfig;
  }

  /** Indicator pane viewports (tests). */
  getIndicatorViewports(): import('./chart-viewport.js').ChartViewport[] {
    return this.indicators?.getPaneViewports() ?? [];
  }

  private volumeRatioForLayout(): number {
    return hasVisibleIndicatorPanes(this.indicatorConfig)
      ? VOLUME_RATIO_IN_CHART_SECTION
      : (this.options.volumeHeightRatio ?? DEFAULT_VOLUME_RATIO_SOLO);
  }

  private applyIndicatorLayout(): void {
    if (!this.indicatorRoot || !this.pane) return;
    const visible = hasVisibleIndicatorPanes(this.indicatorConfig);
    this.indicatorRoot.style.display = visible ? 'flex' : 'none';
    this.pane.setVolumeHeightRatio(this.volumeRatioForLayout());
    if (visible && !this.indicators) {
      this.createIndicatorStack();
    }
    if (!visible) {
      this.indicators?.destroy();
      this.indicators = null;
    }
  }

  private createIndicatorStack(): void {
    if (!this.indicatorRoot || !this.syncBus) return;
    this.indicators = new WebGLIndicatorStack(this.indicatorRoot, {
      theme: this.options.theme,
      debug: this.options.debug,
      config: this.indicatorConfig,
      syncBus: this.syncBus,
      onConfigChange: (config) => {
        this.indicatorConfig = config;
        this.onIndicatorConfigChange?.(config);
        this.applyIndicatorLayout();
        this.syncSize();
      },
    });
  }

  private observeResize(): void {
    if (!this.container || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    this.resizeObserver.observe(this.container);
  }

  private syncSize(): void {
    if (!this.container || !this.pane) return;
    const rect = this.container.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (this.options.initialWidth ?? 800);
    const h = rect.height > 0 ? rect.height : (this.options.initialHeight ?? 480);
    this.resize(w, h);
  }
}