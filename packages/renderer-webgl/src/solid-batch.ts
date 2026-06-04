import { SOLID_FRAGMENT_SHADER, SOLID_VERTEX_SHADER } from './shaders.js';

const STRIDE = 6; // x, y, r, g, b, a

let shaderErrorLogged = false;

function logShaderErrorOnce(message: string, detail: string | null): void {
  if (shaderErrorLogged) return;
  shaderErrorLogged = true;
  console.error(`[renderer-webgl] ${message}`, detail ?? '');
}

/**
 * Batched colored triangles (pixel-space) using a shared solid-color shader.
 */
export class SolidBatchRenderer {
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private locResolution: WebGLUniformLocation | null = null;
  private capacity = 0;
  private _initFailed = false;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly debug = false,
  ) {}

  /** Drop GPU program/buffers after context restore. */
  markDirty(): void {
    const { gl } = this;
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.vao = null;
    this.buffer = null;
    this.program = null;
    this.locResolution = null;
    this.capacity = 0;
  }

  dispose(): void {
    const { gl } = this;
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    this.vao = null;
    this.buffer = null;
    this.program = null;
  }

  get initFailed(): boolean {
    return this._initFailed;
  }

  ensureReady(): boolean {
    if (this._initFailed) return false;
    if (this.program && this.buffer && this.vao) return true;
    return this.init();
  }

  draw(vertices: Float32Array, resolution: [number, number]): void {
    if (!this.ensureReady() || vertices.length === 0) return;
    const { gl } = this;

    if (vertices.length > this.capacity) {
      this.capacity = vertices.length;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices);

    gl.useProgram(this.program);
    gl.uniform2f(this.locResolution, resolution[0], resolution[1]);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / STRIDE);
    gl.bindVertexArray(null);
  }

  private init(): boolean {
    const { gl } = this;
    const vs = compileShader(gl, gl.VERTEX_SHADER, SOLID_VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, SOLID_FRAGMENT_SHADER);
    if (!vs || !fs) {
      this._initFailed = true;
      return false;
    }

    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      logShaderErrorOnce('program link failed', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      this._initFailed = true;
      return false;
    }

    this.program = program;
    this.locResolution = gl.getUniformLocation(program, 'u_resolution');
    this.buffer = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const locPos = gl.getAttribLocation(program, 'a_position');
    const locColor = gl.getAttribLocation(program, 'a_color');
    gl.enableVertexAttribArray(locPos);
    gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(locColor);
    gl.vertexAttribPointer(locColor, 4, gl.FLOAT, false, STRIDE * 4, 8);
    gl.bindVertexArray(null);
    return true;
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    logShaderErrorOnce('shader compile failed', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function pushQuad(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: [number, number, number, number],
): void {
  const [r, g, b, a] = color;
  // two triangles
  out.push(x0, y0, r, g, b, a, x1, y0, r, g, b, a, x0, y1, r, g, b, a);
  out.push(x0, y1, r, g, b, a, x1, y0, r, g, b, a, x1, y1, r, g, b, a);
}