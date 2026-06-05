import type { Bar } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { disableIndicatorLayer } from '@coderyo/indicators';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebGLVolumePane } from './webgl-volume-pane.js';
import { hasWebGL2 } from './webgl2-context.js';
import {
  isLayeredPaneMount,
  WebGLPaneOrchestrator,
} from './webgl-pane-orchestrator.js';
import { WebGLChartPane } from './webgl-chart-pane.js';

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

function getVolumePane(orch: WebGLPaneOrchestrator): WebGLVolumePane | null {
  return (orch as unknown as { volumePane: WebGLVolumePane | null }).volumePane;
}

describe('isLayeredPaneMount', () => {
  it('detects layered mode when volumeMount is provided', () => {
    expect(isLayeredPaneMount({ volumeMount: undefined })).toBe(false);
    expect(isLayeredPaneMount({ volumeMount: {} as HTMLElement })).toBe(true);
  });
});

describeWebGL('WebGLPaneOrchestrator layered volume', () => {
  const roots: HTMLElement[] = [];

  afterEach(() => {
    for (const el of roots) el.remove();
    roots.length = 0;
  });

  function mountLayered(showVolume = true): {
    main: HTMLElement;
    volume: HTMLElement;
    orch: WebGLPaneOrchestrator;
  } {
    const main = document.createElement('div');
    main.style.width = '800px';
    main.style.height = '400px';
    const volume = document.createElement('div');
    volume.style.width = '800px';
    volume.style.height = '120px';
    document.body.append(main, volume);
    roots.push(main, volume);

    const orch = new WebGLPaneOrchestrator({
      volumeMount: volume,
      indicatorConfig: { ...DEFAULT_INDICATOR_CONFIG, showVolume },
      barSpacing: 8,
      initialWidth: 800,
      initialHeight: 400,
    });
    orch.mount(main);
    return { main, volume, orch };
  }

  it('main pane uses full height when volume is layered', () => {
    const { orch } = mountLayered();
    orch.setBars(syntheticBars(40));
    const layout = orch.getMainPaneLayoutMetrics();
    expect(layout).not.toBeNull();
    const volRatio =
      layout!.mainPaneHeight / layout!.canvasHeight;
    expect(volRatio).toBeGreaterThan(0.95);
  });

  it('layered volume viewport follows master by default', () => {
    const { orch } = mountLayered();
    const bars = syntheticBars(60);
    orch.setBars(bars);
    const master = orch.getViewport()!;
    const vol = orch.getVolumeViewport();
    expect(vol).not.toBeNull();
    expect(vol!.visibleFrom).toBeCloseTo(master.visibleFrom, 6);
    expect(vol!.visibleTo).toBeCloseTo(master.visibleTo, 6);
    expect(vol!.barSpacing).toBe(master.barSpacing);
  });

  it('showVolume false hides volume mount and clears main volume band', () => {
    const { volume, orch } = mountLayered();
    orch.setBars(syntheticBars(30));
    orch.setIndicatorConfig({ ...DEFAULT_INDICATOR_CONFIG, showVolume: false });
    expect(volume.style.display).toBe('none');
    expect(getVolumePane(orch)).toBeNull();
    const layout = orch.getMainPaneLayoutMetrics();
    expect(layout!.mainPaneHeight / layout!.canvasHeight).toBeGreaterThan(0.95);
  });

  it('disableIndicatorLayer(volume) destroys layered volume pane', () => {
    const { volume, orch } = mountLayered();
    orch.setBars(syntheticBars(30));
    orch.setIndicatorConfig(disableIndicatorLayer(DEFAULT_INDICATOR_CONFIG, 'volume'));
    expect(volume.style.display).toBe('none');
    expect(getVolumePane(orch)).toBeNull();
  });

  it('layered volume repaints when main viewport changes via plot pan', () => {
    const { main, orch } = mountLayered();
    orch.setBars(syntheticBars(80));
    const volPane = getVolumePane(orch);
    expect(volPane).not.toBeNull();
    const renderSpy = vi.spyOn(volPane!, 'render');
    renderSpy.mockClear();

    const canvas = main.querySelector('canvas')!;
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }) as DOMRect;

    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 200,
        clientY: 150,
        button: 0,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 420,
        clientY: 150,
      }),
    );
    canvas.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 420,
        clientY: 150,
        button: 0,
      }),
    );

    expect(renderSpy).toHaveBeenCalled();
    renderSpy.mockRestore();
  });

  it('re-attaching volume sync group realigns viewport with main', () => {
    const { orch } = mountLayered();
    orch.setBars(syntheticBars(50));
    const master = orch.getViewport()!;
    master.pan(8);
    orch.setPaneSyncGroups({ main: 'prices', volume: 'solo' });
    const vol = orch.getVolumeViewport()!;
    vol.pan(10);
    orch.setPaneSyncGroups({ main: 'prices', volume: 'prices' });
    const volAfter = orch.getVolumeViewport()!;
    expect(volAfter.visibleFrom).toBeCloseTo(master.visibleFrom, 6);
    expect(volAfter.visibleTo).toBeCloseTo(master.visibleTo, 6);
  });

  it('preserveViewportOnNextSetBars keeps master pan on live updates', () => {
    const { orch } = mountLayered();
    orch.setBars(syntheticBars(50));
    const master = orch.getViewport()!;
    master.pan(-8);
    const from = master.visibleFrom;
    orch.preserveViewportOnNextSetBars();
    orch.setBars(syntheticBars(51));
    expect(master.visibleFrom).toBeCloseTo(from, 5);
  });

  it('volume sync group detach allows independent time viewport', () => {
    const { orch } = mountLayered();
    orch.setBars(syntheticBars(50));
    const master = orch.getViewport()!;
    master.pan(6);
    const masterFrom = master.visibleFrom;
    orch.setPaneSyncGroups({ main: 'prices', volume: 'solo' });
    const vol = orch.getVolumeViewport()!;
    vol.pan(10);
    expect(vol.visibleFrom).toBeGreaterThan(0);
    expect(vol.visibleFrom).not.toBeCloseTo(masterFrom, 1);
  });
});

describeWebGL('WebGLChartPane embedded volume', () => {
  it('setVolumeHeightRatio(0) leaves no volume band (clampRatio regression)', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const pane = new WebGLChartPane(root);
    pane.resize(640, 400);
    pane.setVolumeHeightRatio(0);
    pane.setIndicatorConfig(DEFAULT_INDICATOR_CONFIG);
    pane.setData(syntheticBars(20));
    const layout = (
      pane as unknown as { getScaleLayoutCss: () => { mainPaneHeight: number; volumeBandTop?: number } }
    ).getScaleLayoutCss();
    expect(layout.volumeBandTop).toBeUndefined();
    expect(layout.mainPaneHeight).toBe(400);
    pane.destroy();
    root.remove();
  });

  it('volume band uses partial height when visible', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const pane = new WebGLChartPane(root, { volumeHeightRatio: 0.2 });
    pane.resize(640, 400);
    pane.setIndicatorConfig(DEFAULT_INDICATOR_CONFIG);
    pane.setData(syntheticBars(20));
    const layout = (
      pane as unknown as { getScaleLayoutCss: () => { mainPaneHeight: number; volumeBandTop?: number } }
    ).getScaleLayoutCss();
    expect(layout.volumeBandTop).toBeDefined();
    expect(layout.mainPaneHeight).toBeLessThan(400);
    pane.destroy();
    root.remove();
  });
});