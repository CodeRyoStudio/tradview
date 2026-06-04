import type { Bar } from '@coderyo/data';
import {
  clearedIndicatorConfig,
  DEFAULT_INDICATOR_CONFIG,
} from '@coderyo/indicators';
import { afterEach, describe, expect, it } from 'vitest';
import { hasWebGL2 } from './webgl2-context.js';
import { WebGLPaneOrchestrator } from './webgl-pane-orchestrator.js';

function syntheticBars(count: number): Bar[] {
  const bars: Bar[] = [];
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < count; i++) {
    const c = 100 + Math.sin(i / 8) * 5;
    bars.push({
      t: t0 + i * 3_600_000,
      o: c - 0.5,
      h: c + 1,
      l: c - 1,
      c,
      v: 1000 + i,
    });
  }
  return bars;
}

const describeWebGL = describe.skipIf(!hasWebGL2());

describeWebGL('WebGLPaneOrchestrator sync + indicator data', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  function mountOrchestrator(
    indicatorConfig = DEFAULT_INDICATOR_CONFIG,
  ): { root: HTMLElement; orch: WebGLPaneOrchestrator } {
    const root = document.createElement('div');
    root.style.width = '800px';
    root.style.height = '600px';
    document.body.appendChild(root);
    roots.push(root);
    const orch = new WebGLPaneOrchestrator({
      indicatorConfig,
      barSpacing: 8,
      initialWidth: 800,
      initialHeight: 600,
    });
    orch.mount(root);
    return { root, orch };
  }

  it('indicator viewports match master after setBars', () => {
    const { orch } = mountOrchestrator();
    const bars = syntheticBars(80);
    orch.setBars(bars);

    const master = orch.getViewport()!;
    for (const follower of orch.getIndicatorViewports()) {
      expect(follower.visibleFrom).toBeCloseTo(master.visibleFrom, 6);
      expect(follower.visibleTo).toBeCloseTo(master.visibleTo, 6);
      expect(follower.barSpacing).toBe(master.barSpacing);
      expect(follower.barCount).toBe(master.barCount);
    }
  });

  it('setIndicatorConfig re-applies bars without a second setBars', () => {
    const noPanes = clearedIndicatorConfig(DEFAULT_INDICATOR_CONFIG);
    const { orch } = mountOrchestrator(noPanes);
    const bars = syntheticBars(60);
    orch.setBars(bars);

    orch.setIndicatorConfig({ ...noPanes, showMacd: true });

    const master = orch.getViewport()!;
    const followers = orch.getIndicatorViewports();
    expect(followers.length).toBeGreaterThan(0);
    for (const follower of followers) {
      expect(follower.barCount).toBe(bars.length);
      expect(follower.visibleFrom).toBeCloseTo(master.visibleFrom, 6);
      expect(follower.visibleTo).toBeCloseTo(master.visibleTo, 6);
    }
  });
});