import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lightweight-charts', () => {
  function mockChartApi() {
    const parent = document.createElement('div');
    Object.defineProperty(parent, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(parent, 'clientHeight', { value: 200, configurable: true });
    const chartEl = document.createElement('div');
    parent.appendChild(chartEl);
    const series = {
      setData: vi.fn(),
      update: vi.fn(),
      applyOptions: vi.fn(),
      priceToCoordinate: vi.fn(() => 10),
      coordinateToPrice: vi.fn(() => 1),
      createPriceLine: vi.fn(() => ({ applyOptions: vi.fn() })),
      removePriceLine: vi.fn(),
    };
    return {
      chartElement: () => chartEl,
      resize: vi.fn(),
      applyOptions: vi.fn(),
      remove: vi.fn(),
      timeScale: () => ({
        fitContent: vi.fn(),
        scrollToRealTime: vi.fn(),
        timeToCoordinate: vi.fn(() => 0),
        coordinateToTime: vi.fn(() => 0),
        subscribeVisibleLogicalRangeChange: vi.fn(() => () => {}),
        setVisibleLogicalRange: vi.fn(),
        getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 10 })),
      }),
      priceScale: () => ({ applyOptions: vi.fn() }),
      addSeries: vi.fn(() => series),
      subscribeCrosshairMove: vi.fn(() => () => {}),
    };
  }
  return {
    createChart: vi.fn(() => mockChartApi()),
    CandlestickSeries: {},
    HistogramSeries: {},
    LineSeries: {},
    ColorType: { Solid: 'solid' },
  };
});

import { PaneOrchestrator } from '../src/pane-orchestrator.js';

describe('PaneOrchestrator resize focus (runtime)', () => {
  let main: HTMLElement;
  let vol: HTMLElement;

  beforeEach(() => {
    main = document.createElement('div');
    main.style.cssText = 'width:320px;height:200px;';
    vol = document.createElement('div');
    vol.style.cssText = 'width:320px;height:80px;';
    document.body.append(main, vol);
  });

  it('setResizeFocusPanes + resize() preserves focus', () => {
    const orch = new PaneOrchestrator({
      container: main,
      volumeMount: vol,
      indicatorConfig: null,
      listenPaneResizeEvents: false,
    });
    try {
      orch.setResizeFocusPanes(['main']);
      expect(orch.getResizeFocusPanes()).toEqual(['main']);
      orch.resize();
      expect(orch.getResizeFocusPanes()).toEqual(['main']);
      orch.setResizeFocusPanes(null);
      expect(orch.getResizeFocusPanes()).toBeNull();
    } finally {
      orch.destroy();
      main.remove();
      vol.remove();
    }
  });

  it('resizeAllPanes() preserves stored pane focus', () => {
    const orch = new PaneOrchestrator({
      container: main,
      volumeMount: vol,
      indicatorConfig: null,
      listenPaneResizeEvents: false,
    });
    try {
      orch.setResizeFocusPanes(['main']);
      orch.resizeAllPanes();
      expect(orch.getResizeFocusPanes()).toEqual(['main']);
    } finally {
      orch.destroy();
      main.remove();
      vol.remove();
    }
  });

  it('listenPaneResizeEvents: false skips window listener', () => {
    const orch = new PaneOrchestrator({
      container: main,
      volumeMount: vol,
      indicatorConfig: null,
      listenPaneResizeEvents: false,
    });
    try {
      orch.setResizeFocusPanes(['volume']);
      window.dispatchEvent(new CustomEvent('tradview:pane-resize'));
      expect(orch.getResizeFocusPanes()).toEqual(['volume']);
    } finally {
      orch.destroy();
      main.remove();
      vol.remove();
    }
  });
});