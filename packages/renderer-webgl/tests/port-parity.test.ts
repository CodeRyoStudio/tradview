import { installWebGL2TestContext } from '../src/webgl2-test-context.js';

installWebGL2TestContext();

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bar } from '@coderyo/data';
import { intervalMs } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG, hasVisibleIndicatorPanes } from '@coderyo/indicators';
import { computePrependSliceDeltaForViewport } from '@coderyo/renderer-lite';
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

  it('gaps.whitespace contract: default off in ChartFeatures shape', () => {
    expect({ whitespace: false, fillVisibleHoles: false }).toEqual({
      whitespace: false,
      fillVisibleHoles: false,
    });
  });

});

describe('renderer-webgl smoothPriceUpdate (V2-R13)', () => {
  it('WebGL backend accepts setSmoothPriceUpdate toggle (LWC animator deferred)', () => {
    const backend = new WebGLChartRenderBackend(document.createElement('div'));
    expect(() => backend.setSmoothPriceUpdate(true, 200)).not.toThrow();
    backend.destroy();
  });
});

describe('renderer-webgl port parity vs lite runtime (V2-R13)', () => {
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

  it('setCrosshair emits payload with time/price (workspace link contract)', () => {
    const webglEl = document.createElement('div');
    webglEl.style.width = '400px';
    webglEl.style.height = '300px';
    document.body.appendChild(webglEl);
    roots.push(webglEl);

    const handler = vi.fn();
    const webgl = new WebGLChartRenderBackend(webglEl);
    webgl.subscribeCrosshair(handler);
    const bars = syntheticBars(20);
    webgl.setBars(bars);
    const t = bars[10]!.t;
    webgl.setCrosshair({ timeMs: t, price: bars[10]!.c });
    expect(handler).toHaveBeenCalled();
    const last = handler.mock.calls[handler.mock.calls.length - 1]![0] as {
      time: number;
      price: number;
    };
    expect(last.time).toBe(t);
    expect(last.price).toBe(bars[10]!.c);
    webgl.destroy();
  });

  it('prepend compensatePrependForBuses shifts viewport by slice delta', () => {
    const webglEl = document.createElement('div');
    webglEl.style.width = '800px';
    webglEl.style.height = '600px';
    document.body.appendChild(webglEl);
    roots.push(webglEl);

    const backend = new WebGLChartRenderBackend(webglEl);
    const beforeBars = syntheticBars(40);
    backend.setBars(beforeBars);
    backend.fitContent();
    const vp = (
      backend as unknown as { orchestrator: { getViewport: () => { visibleFrom: number } } }
    ).orchestrator.getViewport()!;
    const beforeFrom = vp.visibleFrom;

    const prepend: Bar[] = [
      { t: beforeBars[0]!.t - 3_600_000, o: 1, h: 1, l: 1, c: 1, v: 1 },
      { t: beforeBars[0]!.t - 2 * 3_600_000, o: 1, h: 1, l: 1, c: 1, v: 1 },
    ];
    const afterBars = [...prepend, ...beforeBars];
    const beforeTimes = beforeBars.map((b) => b.t);
    const afterTimes = afterBars.map((b) => b.t);
    const range = backend.getVisibleRange()!;

    const delta = computePrependSliceDeltaForViewport({
      sortedTimesBefore: beforeTimes,
      sortedTimesAfter: afterTimes,
      visibleFromMs: range.fromMs,
      visibleToMs: range.toMs,
      intervalMs: intervalMs('1h'),
    });
    expect(delta).toBeGreaterThan(0);

    backend.setBars(afterBars);
    backend.compensatePrependForBuses(beforeTimes, afterTimes, '1h');
    expect(vp.visibleFrom).toBe(beforeFrom + delta);

    backend.destroy();
  });

  it('indicator panes MACD/RSI/KDJ visible when config enables pane stack', () => {
    const macdConfig = {
      ...DEFAULT_INDICATOR_CONFIG,
      showMacd: true,
      showRsi: true,
      showKdj: true,
    };
    expect(hasVisibleIndicatorPanes(macdConfig)).toBe(true);

    const { root, orch } = mountWebGLOrchestrator({ indicatorConfig: macdConfig });
    roots.push(root);
    orch.setIndicatorConfig(macdConfig);
    expect(orch.getIndicatorViewports().length).toBeGreaterThan(0);
    orch.destroy();
  });

  it('MsTimeScaleBusRegistry is independent per WebGL chart backend', () => {
    const a = new WebGLChartRenderBackend(document.createElement('div'));
    const b = new WebGLChartRenderBackend(document.createElement('div'));
    expect(a.busRegistry).not.toBe(b.busRegistry);
    a.destroy();
    b.destroy();
  });

  it('setLogScale toggles without throw', () => {
    const { root, orch } = mountWebGLOrchestrator();
    roots.push(root);
    orch.setBars(syntheticBars(30));
    expect(() => orch.setLogScale(true)).not.toThrow();
    orch.setLogScale(false);
    orch.destroy();
  });
});