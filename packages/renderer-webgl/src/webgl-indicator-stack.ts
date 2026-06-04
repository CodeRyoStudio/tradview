import type { Bar } from '@coderyo/data';
import {
  DEFAULT_INDICATOR_CONFIG,
  hasVisibleIndicatorPanes,
  type IndicatorConfig,
} from '@coderyo/indicators';
import { WebGLIndicatorPane, type WebGLIndicatorPaneId } from './webgl-indicator-pane.js';
import type { ViewportSyncBus } from './viewport-sync-bus.js';
import type { ChartThemeColors } from './theme.js';

export interface WebGLIndicatorStackOptions {
  theme?: Partial<ChartThemeColors>;
  debug?: boolean;
  config?: IndicatorConfig;
  syncBus?: ViewportSyncBus;
  onConfigChange?: (config: IndicatorConfig) => void;
}

const PANE_DEFS: Array<{ id: WebGLIndicatorPaneId; label: string; showKey: keyof IndicatorConfig }> =
  [
    { id: 'macd', label: 'MACD', showKey: 'showMacd' },
    { id: 'rsi', label: 'RSI', showKey: 'showRsi' },
    { id: 'kdj', label: 'KDJ', showKey: 'showKdj' },
  ];

/**
 * MACD / RSI / KDJ indicator pane stack (WebGL), mirroring renderer-lite {@link IndicatorPaneStack}.
 */
export class WebGLIndicatorStack {
  private config: IndicatorConfig = DEFAULT_INDICATOR_CONFIG;
  private readonly panes = new Map<WebGLIndicatorPaneId, WebGLIndicatorPane>();
  private readonly wraps = new Map<WebGLIndicatorPaneId, HTMLElement>();
  private bars: Bar[] = [];
  private readonly syncBus?: ViewportSyncBus;
  private readonly onConfigChange?: (config: IndicatorConfig) => void;
  private readonly theme?: Partial<ChartThemeColors>;
  private readonly debug: boolean;

  constructor(
    private readonly root: HTMLElement,
    opts: WebGLIndicatorStackOptions = {},
  ) {
    this.config = opts.config ?? DEFAULT_INDICATOR_CONFIG;
    this.syncBus = opts.syncBus;
    this.onConfigChange = opts.onConfigChange;
    this.theme = opts.theme;
    this.debug = opts.debug ?? false;
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.minHeight = '0';
    this.root.style.overflow = 'hidden';
    this.rebuildLayout();
  }

  setConfig(config: IndicatorConfig): void {
    this.config = config;
    this.rebuildLayout();
    if (!hasVisibleIndicatorPanes(this.config)) {
      this.clearBars();
    } else if (this.bars.length > 0) {
      this.setBars(this.bars);
    }
  }

  setBars(bars: readonly Bar[]): void {
    this.bars = bars.slice();
    if (!hasVisibleIndicatorPanes(this.config)) return;
    for (const pane of this.panes.values()) {
      pane.setBars(this.bars, this.config);
    }
    this.resize();
  }

  clearBars(): void {
    this.bars = [];
    for (const pane of this.panes.values()) {
      pane.setBars([], this.config);
    }
  }

  resize(): void {
    const visible = PANE_DEFS.filter((d) => this.config[d.showKey]);
    if (visible.length === 0) return;
    const h = this.root.clientHeight;
    const w = this.root.clientWidth;
    if (w <= 0 || h <= 0) return;
    const paneH = Math.max(72, Math.floor(h / visible.length));
    for (const pane of this.panes.values()) {
      pane.resize(w, paneH);
      pane.render();
    }
  }

  /** Follower viewports (tests / debug). */
  getPaneViewports(): import('./chart-viewport.js').ChartViewport[] {
    return [...this.panes.values()].map((p) => p.viewport);
  }

  destroy(): void {
    for (const pane of this.panes.values()) pane.destroy();
    this.panes.clear();
    this.wraps.clear();
    this.root.replaceChildren();
  }

  private rebuildLayout(): void {
    const visibleIds = new Set(
      PANE_DEFS.filter((d) => this.config[d.showKey]).map((d) => d.id),
    );

    for (const [id, pane] of this.panes) {
      if (!visibleIds.has(id)) {
        pane.destroy();
        this.panes.delete(id);
        this.wraps.delete(id);
      }
    }

    this.root.replaceChildren();
    const anyVisible = visibleIds.size > 0;
    this.root.style.display = anyVisible ? 'flex' : 'none';

    for (const def of PANE_DEFS) {
      if (!visibleIds.has(def.id)) continue;
      let wrap = this.wraps.get(def.id);
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = `tv-indicator-pane tv-indicator-pane--${def.id}`;
        wrap.dataset.paneId = def.id;
        wrap.style.cssText =
          'flex:1;min-height:72px;width:100%;position:relative;border-top:1px solid #30363d;';
        this.wraps.set(def.id, wrap);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.title = `Close ${def.label}`;
        closeBtn.setAttribute('aria-label', `Close ${def.label}`);
        closeBtn.style.cssText =
          'position:absolute;right:6px;top:4px;z-index:3;width:22px;height:22px;padding:0;border:1px solid #30363d;border-radius:4px;background:#21262d;color:#8b949e;cursor:pointer;font-size:14px;line-height:1;';
        closeBtn.onclick = () => this.closePane(def.id);
        wrap.appendChild(closeBtn);

        const chartHost = document.createElement('div');
        chartHost.style.cssText = 'width:100%;height:100%;';
        wrap.appendChild(chartHost);

        const pane = new WebGLIndicatorPane(chartHost, {
          paneId: def.id,
          label: def.label,
          theme: this.theme,
          debug: this.debug,
          syncBus: this.syncBus,
        });
        this.panes.set(def.id, pane);
      }
      this.root.appendChild(wrap);
    }

    if (this.bars.length > 0 && anyVisible) {
      this.setBars(this.bars);
    }
  }

  private closePane(id: WebGLIndicatorPaneId): void {
    const patch =
      id === 'macd'
        ? { showMacd: false }
        : id === 'rsi'
          ? { showRsi: false }
          : { showKdj: false };
    this.config = { ...this.config, ...patch };
    this.onConfigChange?.(this.config);
    this.rebuildLayout();
  }
}