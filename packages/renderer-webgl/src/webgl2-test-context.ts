/** Vitest / happy-dom: minimal WebGL2 context so GPU tests run without a GPU. */

let installed = false;

function createMockWebGL2(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const noop = () => undefined;
  const true_ = () => true;
  const null_ = () => null;
  const fakeObj = () => ({} as WebGLShader);

  const gl: Record<string, unknown> = {
    canvas,
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    COLOR_BUFFER_BIT: 0x4000,
    enable: noop,
    disable: noop,
    blendFunc: noop,
    clearColor: noop,
    clear: noop,
    flush: noop,
    viewport: noop,
    createShader: fakeObj,
    shaderSource: noop,
    compileShader: noop,
    getShaderParameter: true_,
    getShaderInfoLog: () => '',
    createProgram: () => ({} as WebGLProgram),
    attachShader: noop,
    linkProgram: noop,
    getProgramParameter: true_,
    getProgramInfoLog: () => '',
    useProgram: noop,
    getAttribLocation: (_prog: unknown, name: string) => (name === 'a_position' ? 0 : 1),
    getUniformLocation: () => ({} as WebGLUniformLocation),
    uniform2f: noop,
    createBuffer: () => ({} as WebGLBuffer),
    bindBuffer: noop,
    bufferData: noop,
    bufferSubData: noop,
    createVertexArray: () => ({} as WebGLVertexArrayObject),
    bindVertexArray: noop,
    vertexAttribPointer: noop,
    enableVertexAttribArray: noop,
    drawArrays: noop,
    deleteShader: noop,
    deleteProgram: noop,
    deleteBuffer: noop,
    deleteVertexArray: noop,
    getExtension: null_,
    isContextLost: () => false,
  };

  return gl as unknown as WebGL2RenderingContext;
}

function createMockCanvas2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const noop = () => undefined;
  const ctx: Record<string, unknown> = {
    canvas,
    clearRect: noop,
    fillText: noop,
    stroke: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    fillStyle: '#8b949e',
    strokeStyle: '#30363d',
    font: '11px monospace',
    textAlign: 'left',
    textBaseline: 'middle',
    lineWidth: 1,
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

/** Install fake `webgl2` on all canvases (idempotent). */
export function installWebGL2TestContext(): void {
  if (installed || typeof HTMLCanvasElement === 'undefined') return;
  installed = true;
  const proto = HTMLCanvasElement.prototype;
  const orig = proto.getContext;
  proto.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    _options?: unknown,
  ): RenderingContext | null {
    if (type === 'webgl2' || type === 'experimental-webgl2') {
      return createMockWebGL2(this);
    }
    if (type === '2d') {
      const fromOrig = orig.call(this, type, _options as never) as CanvasRenderingContext2D | null;
      return fromOrig ?? createMockCanvas2D(this);
    }
    return orig.call(this, type, _options as never);
  } as typeof proto.getContext;
}

/** Alias for review/docs naming. */
export const installWebGL2TestHarness = installWebGL2TestContext;

export function isWebGL2TestContextInstalled(): boolean {
  return installed;
}