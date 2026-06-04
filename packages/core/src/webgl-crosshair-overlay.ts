/** DOM crosshair lines for WebGL charts (linked workspace + programmatic setCrosshair). */
export class WebGLCrosshairOverlay {
  private readonly root: HTMLElement;
  private readonly vLine: HTMLElement;
  private readonly hLine: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'tv-webgl-crosshair';
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;z-index:4;display:none;';
    this.vLine = document.createElement('div');
    this.vLine.style.cssText =
      'position:absolute;top:0;bottom:0;width:1px;background:rgba(139,148,158,0.85);';
    this.hLine = document.createElement('div');
    this.hLine.style.cssText =
      'position:absolute;left:0;right:0;height:1px;background:rgba(139,148,158,0.85);';
    this.root.append(this.vLine, this.hLine);
    parent.style.position = parent.style.position || 'relative';
    parent.appendChild(this.root);
  }

  /** Position in CSS pixels relative to chart container (main pane only). */
  show(cssX: number, cssY: number, mainPaneHeight: number, cssWidth: number): void {
    if (!Number.isFinite(cssX) || !Number.isFinite(cssY)) {
      this.hide();
      return;
    }
    this.root.style.display = 'block';
    this.vLine.style.left = `${cssX}px`;
    this.hLine.style.top = `${cssY}px`;
    this.hLine.style.width = `${cssWidth}px`;
    this.vLine.style.height = `${mainPaneHeight}px`;
    this.vLine.style.top = '0';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}