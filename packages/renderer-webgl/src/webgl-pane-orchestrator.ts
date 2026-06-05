import type { Bar } from '@coderyo/data';
import {
  DEFAULT_INDICATOR_CONFIG,
  hasVisibleIndicatorPanes,
  isVolumePaneVisible,
  type IndicatorConfig,
} from '@coderyo/indicators';
import { lodDecimateBars } from '@coderyo/series';
import { WebGLChartPane, type WebGLChartPaneOptions } from './webgl-chart-pane.js';
import { WebGLVolumePane } from './webgl-volume-pane.js';
import { WebGLIndicatorStack } from './webgl-indicator-stack.js';
import { ViewportSyncBus } from './viewport-sync-bus.js';
import { WebGLDrawingLayer } from './webgl-drawing-layer.js';
import type { DrawingTool } from '@coderyo/drawings';
import { pinePlotsToLineSpecs, type PinePlotLineInput } from './pine-overlay-lines.js';
import type { PriceRange, PriceScaleMode } from './price-scale.js';
import type {
  PriceScaleOptions,
  SymbolPriceFormat,
  TimeScaleOptions,
} from './scale/scale-types.js';
import { DEFAULT_INDICATOR_PRICE_FORMAT } from './scale/scale-types.js';

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

/** Mirrors core {@link PaneSyncGroupPatch} without depending on renderer-lite. */
export type WebGLPaneSyncGroupPatch = {
  main?: string | null;
  volume?: string | null;
  indicator?: string | null;
};

/** Layer compositor: volume renders in `volumeMount`, not embedded in main canvas. */
export function isLayeredPaneMount(
  opts: Pick<WebGLPaneOrchestratorOptions, 'volumeMount'>,
): boolean {
  return !!opts.volumeMount;
}

export interface WebGLPaneOrchestratorOptions extends WebGLChartPaneOptions {
  /** P2: separate volume layer host (independent resize; optional time sync). */
  volumeMount?: HTMLElement;
  /** Initial CSS size when mount container has zero layout. */
  initialWidth?: number;
  initialHeight?: number;
  indicatorConfig?: IndicatorConfig;
  onIndicatorConfigChange?: (config: IndicatorConfig) => void;
  /** Max bars sent to GPU after LOD decimation (V2-R8, §11.5). */
  maxRenderPoints?: number;
  /** Drawing overlay (V2-R9–R11, phase_gamma). */
  drawings?: WebGLDrawingsOptions;
  timeZone?: string;
  /** Fired when main pane viewport changes (pan/zoom / time-axis). */
  onViewportChange?: () => void;
}

/**
 * WebGL orchestrator: main chart + volume (embedded or `volumeMount`) + indicator stack.
 */
export class WebGLPaneOrchestrator {
  private readonly layeredVolume: boolean;
  private chartHost: HTMLElement | null = null;
  private volumeHost: HTMLElement | null = null;
  private indicatorRoot: HTMLElement | null = null;
  private pane: WebGLChartPane | null = null;
  private volumePane: WebGLVolumePane | null = null;
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
  private paneSyncPatch: WebGLPaneSyncGroupPatch = {};
  private indicatorFollowsMain = true;
  private volumeFollowsMain = true;
  private timeZone: string;
  private symbolFormat: SymbolPriceFormat = {};
  private didInitialFit = false;
  private skipNextInitialFit = false;

  constructor(private readonly options: WebGLPaneOrchestratorOptions = {}) {
    this.layeredVolume = isLayeredPaneMount(options);
    this.timeZone =
      options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
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
      timeZone: this.timeZone,
      onViewportChange: () => this.onMainViewportChange(),
    });
    this.pane.setSymbolPriceFormat(this.symbolFormat);
    this.syncBus = new ViewportSyncBus(this.pane.viewport);
    this.pane.attachSyncBus(this.syncBus);

    if (this.layeredVolume) {
      this.mountLayeredVolume();
    }

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
        getCoordinateContext: () => {
          const p = this.pane;
          if (!p) return null;
          return {
            priceRange: p.getEffectiveMainPriceRange(),
            priceScaleMode: p.getPriceScaleMode(),
          };
        },
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
    const fitViewport =
      this.lastBars.length > 0 && !this.didInitialFit && !this.skipNextInitialFit;
    this.pane?.setData(this.lastBars, { fitViewport });
    if (fitViewport) {
      this.didInitialFit = true;
    }
    this.skipNextInitialFit = false;
    if (this.volumePane && isVolumePaneVisible(this.indicatorConfig)) {
      this.volumePane.setData(this.lastBars, this.indicatorConfig);
      if (fitViewport && this.volumeFollowsMain) {
        this.syncBus?.propagate();
      }
      this.volumePane.render();
    }
    this.drawingLayer?.redraw();
    if (hasVisibleIndicatorPanes(this.indicatorConfig)) {
      this.indicators?.setBars(this.lastBars);
      this.syncBus?.propagate();
    }
  }

  /** Skip automatic fit-to-latest on the next {@link setBars} (reload / live updates). */
  preserveViewportOnNextSetBars(): void {
    this.skipNextInitialFit = true;
    this.didInitialFit = true;
  }

  resetViewState(): void {
    this.didInitialFit = false;
    this.skipNextInitialFit = false;
    const vp = this.pane?.viewport;
    if (vp) vp.setBarCount(0);
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
    this.applyVolumeVisibility();
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
    this.volumePane?.render();
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

  getDrawingOverlayCanvas(): HTMLCanvasElement | null {
    return this.drawingLayer?.overlayCanvas ?? null;
  }

  getMainPaneLayoutMetrics() {
    return this.pane?.getLayoutMetrics() ?? null;
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
    this.teardownLayeredVolume();
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

  setLogScale(enabled: boolean): void {
    this.pane?.setLogScale(enabled);
  }

  setShowGrid(show: boolean): void {
    this.pane?.setShowGrid(show);
    this.render();
  }

  setPineOverlayLines(plots: readonly PinePlotLineInput[] | null): void {
    this.pane?.setPineOverlayLines(pinePlotsToLineSpecs(plots));
    this.render();
  }

  setTimezone(timeZone: string): void {
    this.timeZone = timeZone || 'UTC';
    this.pane?.setTimezone(this.timeZone);
    this.volumePane?.setTimezone(this.timeZone);
    this.indicators?.setTimezone(this.timeZone);
    this.render();
  }

  applyPriceScaleOptions(opts: Partial<PriceScaleOptions>): void {
    this.pane?.applyPriceScaleOptions(opts);
    if (opts.textColor != null || opts.borderColor != null || opts.font != null) {
      const { position: _p, ...shared } = opts;
      this.volumePane?.applyPriceScaleOptions(shared);
      this.indicators?.applyPriceScaleOptions(shared);
    }
    this.render();
  }

  getEffectiveMainPriceRange(): PriceRange | null {
    return this.pane?.getEffectiveMainPriceRange() ?? null;
  }

  getPriceScaleMode(): PriceScaleMode {
    return this.pane?.getPriceScaleMode() ?? 'linear';
  }

  getScaleOverlayCanvas(): HTMLCanvasElement | null {
    return this.pane?.getScaleOverlayCanvas() ?? null;
  }

  applyTimeScaleOptions(opts: Partial<TimeScaleOptions>): void {
    this.pane?.applyTimeScaleOptions(opts);
    this.volumePane?.applyTimeScaleOptions(opts);
    this.indicators?.applyTimeScaleOptions(opts);
    this.render();
  }

  setSymbolPriceFormat(format: SymbolPriceFormat): void {
    this.symbolFormat = format;
    this.pane?.setSymbolPriceFormat(format);
    this.render();
  }

  /** Indicator panes use neutral formatting; symbol OHLC format is main pane only. */
  private indicatorPriceFormat(): SymbolPriceFormat {
    return DEFAULT_INDICATOR_PRICE_FORMAT;
  }

  setCrosshairReadout(price: number | null, timeMs: number | null): void {
    this.pane?.setCrosshairReadout(price, timeMs);
    this.volumePane?.setCrosshairReadout(price, timeMs);
    this.indicators?.setCrosshairReadout(price, timeMs);
  }

  /** Layer compositor pane sync groups (main/volume share viewport; indicator optional follower). */
  setPaneSyncGroups(patch: WebGLPaneSyncGroupPatch): void {
    if (patch.main !== undefined) this.paneSyncPatch.main = patch.main;
    if (patch.volume !== undefined) {
      this.paneSyncPatch.volume = patch.volume;
      const mainG = this.paneSyncPatch.main ?? 'prices';
      const volG = patch.volume;
      const follow =
        volG != null && String(volG).length > 0 && String(volG) === String(mainG);
      if (follow !== this.volumeFollowsMain) {
        this.volumeFollowsMain = follow;
        if (this.layeredVolume) {
          this.recreateVolumePane();
        }
      }
    }
    if (patch.indicator !== undefined) {
      this.paneSyncPatch.indicator = patch.indicator;
      const mainG = this.paneSyncPatch.main ?? 'prices';
      const indG = patch.indicator;
      const follow =
        indG != null && String(indG).length > 0 && String(indG) === String(mainG);
      if (follow !== this.indicatorFollowsMain) {
        this.indicatorFollowsMain = follow;
        if (hasVisibleIndicatorPanes(this.indicatorConfig)) {
          this.recreateIndicatorStack();
        }
      }
    }
  }

  getPaneSyncPatch(): WebGLPaneSyncGroupPatch {
    return { ...this.paneSyncPatch };
  }

  private recreateIndicatorStack(): void {
    this.indicators?.destroy();
    this.indicators = null;
    const stack = this.createIndicatorStack();
    if (stack && this.lastBars.length > 0) {
      stack.setBars(this.lastBars);
      this.syncBus?.propagate();
    }
    this.applyIndicatorLayout();
    this.syncSize();
  }

  /** Indicator pane viewports (tests). */
  getIndicatorViewports(): import('./chart-viewport.js').ChartViewport[] {
    return this.indicators?.getPaneViewports() ?? [];
  }

  /** Layered volume pane viewport (tests). */
  getVolumeViewport(): import('./chart-viewport.js').ChartViewport | null {
    return this.volumePane?.viewport ?? null;
  }

  private volumeRatioForLayout(): number {
    if (this.layeredVolume) return 0;
    if (!isVolumePaneVisible(this.indicatorConfig)) return 0;
    return hasVisibleIndicatorPanes(this.indicatorConfig)
      ? VOLUME_RATIO_IN_CHART_SECTION
      : (this.options.volumeHeightRatio ?? DEFAULT_VOLUME_RATIO_SOLO);
  }

  private applyIndicatorLayout(): void {
    if (!this.indicatorRoot || !this.pane) return;
    const visible = hasVisibleIndicatorPanes(this.indicatorConfig);
    this.indicatorRoot.style.display = visible ? 'flex' : 'none';
    this.pane.setVolumeHeightRatio(this.volumeRatioForLayout());
    this.applyVolumeVisibility();
    if (visible && !this.indicators) {
      this.createIndicatorStack();
    }
    if (!visible) {
      this.indicators?.destroy();
      this.indicators = null;
    }
  }

  private createIndicatorStack(): WebGLIndicatorStack | null {
    if (!this.indicatorRoot || !hasVisibleIndicatorPanes(this.indicatorConfig)) {
      return null;
    }
    const bus = this.indicatorFollowsMain ? this.syncBus ?? undefined : undefined;
    this.indicators = new WebGLIndicatorStack(this.indicatorRoot, {
      theme: this.options.theme,
      debug: this.options.debug,
      config: this.indicatorConfig,
      timeZone: this.timeZone,
      symbolFormat: this.indicatorPriceFormat(),
      syncBus: bus,
      onConfigChange: (config) => {
        this.indicatorConfig = config;
        this.onIndicatorConfigChange?.(config);
        this.applyIndicatorLayout();
        this.syncSize();
      },
    });
    return this.indicators;
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.syncSize());
    if (this.container) this.resizeObserver.observe(this.container);
    if (this.options.volumeMount) this.resizeObserver.observe(this.options.volumeMount);
  }

  private syncSize(): void {
    if (!this.container || !this.pane) return;
    const rect = this.container.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : (this.options.initialWidth ?? 800);
    const h = rect.height > 0 ? rect.height : (this.options.initialHeight ?? 480);
    this.resize(w, h);
    this.syncVolumeSize();
  }

  private syncVolumeSize(): void {
    if (!this.volumePane || !this.options.volumeMount) return;
    const rect = this.options.volumeMount.getBoundingClientRect();
    const vw = rect.width > 0 ? rect.width : (this.options.initialWidth ?? 800);
    const vh = rect.height > 0 ? rect.height : 120;
    this.volumePane.resize(vw, vh);
  }

  /** Main pan/zoom: repaint synced layered volume without full orchestrator render. */
  private onMainViewportChange(): void {
    this.options.onViewportChange?.();
    if (
      this.layeredVolume &&
      this.volumeFollowsMain &&
      this.volumePane &&
      isVolumePaneVisible(this.indicatorConfig)
    ) {
      this.volumePane.render();
    }
  }

  private mountLayeredVolume(): void {
    const mount = this.options.volumeMount;
    if (!mount || this.volumePane) return;
    if (!mount.dataset.paneId) mount.dataset.paneId = 'volume';
    mount.style.position = mount.style.position || 'relative';
    mount.style.overflow = mount.style.overflow || 'hidden';
    mount.querySelectorAll('[data-webgl-volume-host]').forEach((el) => el.remove());
    this.volumeHost = document.createElement('div');
    this.volumeHost.dataset.webglVolumeHost = '1';
    this.volumeHost.style.cssText = 'width:100%;height:100%;min-height:48px;position:relative;';
    mount.appendChild(this.volumeHost);
    this.createVolumePane();
    this.applyVolumeVisibility();
  }

  private createVolumePane(): void {
    if (!this.volumeHost) return;
    this.volumePane?.destroy();
    const bus = this.volumeFollowsMain ? (this.syncBus ?? undefined) : undefined;
    this.volumePane = new WebGLVolumePane(this.volumeHost, {
      theme: this.options.theme,
      debug: this.options.debug,
      syncBus: bus,
      timeZone: this.timeZone,
    });
    if (this.lastBars.length > 0) {
      this.volumePane.setData(this.lastBars, this.indicatorConfig);
      if (this.volumeFollowsMain) this.syncBus?.propagate();
    }
    this.syncVolumeSize();
  }

  private recreateVolumePane(): void {
    if (!this.layeredVolume || !this.volumeHost) return;
    this.createVolumePane();
    this.volumePane?.render();
  }

  private applyVolumeVisibility(): void {
    if (!this.layeredVolume || !this.options.volumeMount) return;
    const show = isVolumePaneVisible(this.indicatorConfig);
    this.options.volumeMount.style.display = show ? '' : 'none';
    if (!show) {
      this.volumePane?.destroy();
      this.volumePane = null;
      return;
    }
    if (!this.volumePane && this.volumeHost) {
      this.createVolumePane();
    } else if (this.volumePane && this.lastBars.length > 0) {
      this.volumePane.setData(this.lastBars, this.indicatorConfig);
    }
  }

  private teardownLayeredVolume(): void {
    this.volumePane?.destroy();
    this.volumePane = null;
    this.volumeHost?.remove();
    this.volumeHost = null;
  }
}