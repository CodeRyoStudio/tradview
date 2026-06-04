import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bar } from '@coderyo/data';
import { hasWebGL2 } from '../src/webgl2-context.js';
import { WebGLChartRenderBackend } from '../../core/src/chart-renderer-webgl.js';
import {
  decimatedFixture,
  liteCrosshairDispatch,
  liteVisibleRangeAfterSetBars,
  mountWebGLOrchestrator,
  syntheticBars,
  webglVisibleRangeMs,
} from './port-parity-fixtures.js';

const describeWebGL = describe.skipIf(!hasWebGL2());

describe('renderer-webgl port parity vs lite contract (V2-R13)', () => {
  it('LOD fixture bar count matches lite setBars decimation', () => {
    const bars = syntheticBars(120);
    const expected = decimatedFixture(bars);
    const liteRange = liteVisibleRangeAfterSetBars(bars);
    expect(liteRange.fromMs).toBe(expected[0]!.t);
    expect(expected.length).toBe(120);
  });

  it('lite crosshair contract emits null once when time is cleared', () => {
    const handler = vi.fn();
    liteCrosshairDispatch(handler, { time: 1, point: { x: 1, y: 2 } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]![0]).not.toBeNull();

    handler.mockClear();
    liteCrosshairDispatch(handler, { time: null, point: undefined });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(null);
  });
});

describeWebGL('renderer-webgl port parity vs lite runtime (V2-R13)', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  it('bar count after setBars matches lite LOD fixture', () => {
    const bars = syntheticBars(120);
    const expected = decimatedFixture(bars);

    const { root, orch } = mountWebGLOrchestrator();
    roots.push(root);
    orch.setBars(bars);

    expect(orch.getLodStats().outputCount).toBe(expected.length);
    expect(orch.getViewport()?.barCount).toBe(expected.length);
    orch.destroy();
  });

  it('visible range fromMs matches lite; toMs uses bar endpoint on WebGL viewport', () => {
    const bars = syntheticBars(80);
    const expected = decimatedFixture(bars);
    const liteRange = liteVisibleRangeAfterSetBars(bars);

    const { root, orch } = mountWebGLOrchestrator();
    roots.push(root);
    orch.setBars(bars);
    orch.render();

    const webglRange = webglVisibleRangeMs(orch, expected);
    expect(webglRange).not.toBeNull();
    expect(webglRange!.fromMs).toBe(liteRange.fromMs);
    expect(webglRange!.fromMs).toBeLessThan(webglRange!.toMs);
    expect(webglRange!.toMs).toBe(expected[expected.length - 1]!.t);

    orch.destroy();
  });

  it('crosshair null clear on setBars([]) matches lite null contract', () => {
    const sampleBar: Bar = { t: 1_000, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 };

    const webglEl = document.createElement('div');
    webglEl.style.width = '400px';
    webglEl.style.height = '300px';
    document.body.appendChild(webglEl);
    roots.push(webglEl);

    const webglHandler = vi.fn();
    const webgl = new WebGLChartRenderBackend(webglEl);
    webgl.subscribeCrosshair(webglHandler);
    webgl.setBars([sampleBar]);
    const webglRect = webglEl.getBoundingClientRect();
    webglEl.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: webglRect.left + 200,
        clientY: webglRect.top + 100,
      }),
    );
    expect(webglHandler.mock.calls.some((c) => c[0] != null)).toBe(true);

    webglHandler.mockClear();
    webgl.setBars([]);
    expect(webglHandler).toHaveBeenCalledTimes(1);
    expect(webglHandler).toHaveBeenCalledWith(null);

    const liteHandler = vi.fn();
    liteCrosshairDispatch(liteHandler, { time: 1, point: { x: 1, y: 2 } });
    liteHandler.mockClear();
    liteCrosshairDispatch(liteHandler, { time: null, point: undefined });
    expect(liteHandler).toHaveBeenCalledWith(null);

    webgl.destroy();
  });
});

describe('renderer-webgl port parity checklist (V2-R13 deferred)', () => {
  it.todo('TimeScaleBusRegistry per chart — independent buses');
  it.todo('prepend compensatePrependOnRegistry on WebGL path');
  it.todo('indicator panes MACD/RSI/KDJ visible range sync');
  it.todo('smoothPriceUpdate BarSmoothAnimator');
  it.todo('gaps.whitespace feature');
  it.todo('pine-lite plot overlay on WebGL orchestrator');
});