export interface WebGL2ContextOptions {
  /** When true, log shader compile errors to console. */
  debug?: boolean;
}

export interface CanvasSize {
  width: number;
  height: number;
  dpr: number;
}

/**
 * Owns a chart canvas, WebGL2 context, resize/DPR, and basic context-loss handling.
 */
export class WebGL2Context {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;

  private readonly debug: boolean;
  private contextLost = false;
  private onLost?: () => void;
  private onRestored?: () => void;

  private boundLost: (e: Event) => void;
  private boundRestored: (e: Event) => void;

  constructor(parent: HTMLElement, opts: WebGL2ContextOptions = {}) {
    this.debug = opts.debug ?? false;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    parent.appendChild(this.canvas);

    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      throw new Error('WebGL2 is not available in this environment');
    }

    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.boundLost = (e) => this.handleContextLost(e);
    this.boundRestored = (e) => this.handleContextRestored(e);
    this.canvas.addEventListener('webglcontextlost', this.boundLost);
    this.canvas.addEventListener('webglcontextrestored', this.boundRestored);
  }

  get isContextLost(): boolean {
    return this.contextLost || this.gl.isContextLost();
  }

  setContextHandlers(handlers: { onLost?: () => void; onRestored?: () => void }): void {
    this.onLost = handlers.onLost;
    this.onRestored = handlers.onRestored;
  }

  resize(cssWidth: number, cssHeight: number, dpr = globalThis.devicePixelRatio ?? 1): CanvasSize {
    const w = Math.max(1, Math.floor(cssWidth * dpr));
    const h = Math.max(1, Math.floor(cssHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return { width: w, height: h, dpr };
  }

  clear(color: [number, number, number, number]): void {
    const [r, g, b, a] = color;
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  destroy(): void {
    this.canvas.removeEventListener('webglcontextlost', this.boundLost);
    this.canvas.removeEventListener('webglcontextrestored', this.boundRestored);
    this.canvas.remove();
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }

  private handleContextLost(e: Event): void {
    e.preventDefault();
    this.contextLost = true;
    this.onLost?.();
    if (this.debug) {
      console.warn('[renderer-webgl] WebGL context lost');
    }
  }

  private handleContextRestored(_e: Event): void {
    this.contextLost = false;
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    this.onRestored?.();
    if (this.debug) {
      console.info('[renderer-webgl] WebGL context restored');
    }
  }
}

/** Detect WebGL2 for conditional tests. */
export function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  return gl != null;
}