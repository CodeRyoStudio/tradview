import type { Bar } from '@coderyo/data';
import { WebGLChartPane, type WebGLChartPaneOptions } from './webgl-chart-pane.js';

export interface WebGLPaneOrchestratorOptions extends WebGLChartPaneOptions {
  /** Initial CSS size when mount container has zero layout. */
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * Alpha-scope orchestrator: main candle pane + volume pane via a single {@link WebGLChartPane}.
 * API shaped for future core adapter wiring (V2-R12).
 */
export class WebGLPaneOrchestrator {
  private pane: WebGLChartPane | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly options: WebGLPaneOrchestratorOptions = {}) {}

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

    this.pane = new WebGLChartPane(container, this.options);
    this.observeResize();
    this.syncSize();
  }

  setBars(bars: readonly Bar[]): void {
    this.pane?.setData(bars);
  }

  resize(width: number, height: number): void {
    this.pane?.resize(width, height);
    this.pane?.render();
  }

  render(): void {
    this.pane?.render();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.pane?.destroy();
    this.pane = null;
    this.container = null;
  }

  /** Exposed for tests and demo HUD. */
  getViewport() {
    return this.pane?.viewport ?? null;
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
    this.pane.resize(w, h);
    this.pane.render();
  }
}