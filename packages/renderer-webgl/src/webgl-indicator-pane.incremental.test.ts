import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import type { Bar } from '@coderyo/data';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasWebGL2 } from './webgl2-context.js';
import { WebGLIndicatorPane } from './webgl-indicator-pane.js';

const describeWebGL = describe.skipIf(!hasWebGL2());

function bar(t: number, c = 50 + t * 0.1): Bar {
  return { t: t * 60_000, o: c - 1, h: c + 2, l: c - 2, c, v: 100 };
}

type PaneInternals = WebGLIndicatorPane & {
  patchCachedSeries: (
    mutation: 'tail-append' | 'tail-update',
    bars: Bar[],
    config: import('@coderyo/indicators').IndicatorConfig,
  ) => void;
};

describeWebGL('WebGLIndicatorPane patchCachedSeries', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  it('patches cached series on tail-update without full rebuild', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '80px';
    document.body.appendChild(container);
    roots.push(container);

    const cfg = { ...DEFAULT_INDICATOR_CONFIG, showMacd: true, showRsi: false, showKdj: false };
    const pane = new WebGLIndicatorPane(container, { paneId: 'macd', label: 'MACD' });
    const patchSpy = vi.spyOn(pane as unknown as PaneInternals, 'patchCachedSeries');

    const initial = [1, 2, 3, 4, 5].map((i) => bar(i));
    pane.resize(400, 80);
    pane.setBars(initial, cfg);
    patchSpy.mockClear();

    const tailUpdate = initial.map((b, i) =>
      i === initial.length - 1 ? { ...b, c: b.c + 5 } : b,
    );
    pane.setBars(tailUpdate, cfg);

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy.mock.calls[0]?.[0]).toBe('tail-update');
    pane.destroy();
  });

  it('patches cached series on tail-append', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '80px';
    document.body.appendChild(container);
    roots.push(container);

    const cfg = { ...DEFAULT_INDICATOR_CONFIG, showMacd: false, showRsi: true, showKdj: false };
    const pane = new WebGLIndicatorPane(container, { paneId: 'rsi', label: 'RSI' });
    const patchSpy = vi.spyOn(pane as unknown as PaneInternals, 'patchCachedSeries');

    const initial = [1, 2, 3, 4, 5].map((i) => bar(i));
    pane.resize(400, 80);
    pane.setBars(initial, cfg);
    patchSpy.mockClear();

    pane.setBars([...initial, bar(6)], cfg);

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy.mock.calls[0]?.[0]).toBe('tail-append');
    pane.destroy();
  });

  it('rebuilds series on full mutation (prefix change)', () => {
    const container = document.createElement('div');
    container.style.width = '400px';
    container.style.height = '80px';
    document.body.appendChild(container);
    roots.push(container);

    const cfg = { ...DEFAULT_INDICATOR_CONFIG, showMacd: false, showRsi: false, showKdj: true };
    const pane = new WebGLIndicatorPane(container, { paneId: 'kdj', label: 'KDJ' });
    const patchSpy = vi.spyOn(pane as unknown as PaneInternals, 'patchCachedSeries');

    const initial = [1, 2, 3, 4, 5].map((i) => bar(i));
    pane.resize(400, 80);
    pane.setBars(initial, cfg);
    patchSpy.mockClear();

    pane.setBars([bar(99), ...initial.slice(1)], cfg);

    expect(patchSpy).not.toHaveBeenCalled();
    pane.destroy();
  });
});