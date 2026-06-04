import { describe, expect, it, vi } from 'vitest';
import type { IChartApi } from 'lightweight-charts';
import {
  TimeScaleBusRegistry,
  independentBusKey,
} from '../src/time-scale-bus-registry.js';
import { TimeScaleBus } from '../src/time-scale-bus.js';

function createMockChart(initialSec: { from: number; to: number }): {
  chart: IChartApi;
  getVisibleSec: () => { from: number; to: number };
} {
  let visibleSec = { ...initialSec };
  const timeScale = {
    subscribeVisibleLogicalRangeChange: () => () => {},
    setVisibleLogicalRange: vi.fn(),
    getVisibleRange: () => visibleSec,
    setVisibleRange: (range: { from: number; to: number }) => {
      visibleSec = range;
    },
    options: () => ({ barSpacing: 6 }),
    applyOptions: vi.fn(),
    scrollToPosition: vi.fn(),
  };
  const chart = { timeScale: () => timeScale } as IChartApi;
  return { chart, getVisibleSec: () => visibleSec };
}

describe('TimeScaleBusRegistry multi-pane sync (DESIGN §10.4)', () => {
  it('shares one bus instance for the same non-empty group id', () => {
    const reg = new TimeScaleBusRegistry();
    reg.setPaneSyncGroup('main', 'prices');
    reg.setPaneSyncGroup('volume', 'prices');
    reg.setPaneSyncGroup('indicator', 'prices');
    expect(reg.getBusForPane('main')).toBe(reg.getBusForPane('volume'));
    expect(reg.getBusForPane('volume')).toBe(reg.getBusForPane('indicator'));
  });

  it('independent panes keep separate buses and ms windows', () => {
    const reg = new TimeScaleBusRegistry();
    const mainBus = reg.getBusForPane('main');
    const volBus = reg.getBusForPane('volume');
    expect(reg.getBusKeyForPane('main')).toBe(independentBusKey('main'));
    expect(reg.getBusKeyForPane('volume')).toBe(independentBusKey('volume'));
    expect(mainBus).not.toBe(volBus);

    const main = createMockChart({ from: 100, to: 200 });
    const volume = createMockChart({ from: 300, to: 400 });
    mainBus.register(main.chart);
    volBus.register(volume.chart);
    mainBus.setVisibleTimeRange({ fromMs: 100_000, toMs: 200_000 });

    expect(mainBus.visibleFromMs).toBe(100_000);
    expect(volBus.visibleFromMs).toBe(0);
    expect(volBus.visibleToMs).toBe(0);
  });

  it('setVisibleTimeRange applies identical ms to all panes on a shared bus', () => {
    const bus = new TimeScaleBus();
    const a = createMockChart({ from: 0, to: 0 });
    const b = createMockChart({ from: 0, to: 0 });
    const c = createMockChart({ from: 0, to: 0 });
    bus.register(a.chart);
    bus.register(b.chart);
    bus.register(c.chart);

    bus.setVisibleTimeRange({ fromMs: 4_500_000, toMs: 8_250_000 });

    expect(bus.visibleFromMs).toBe(4_500_000);
    expect(bus.visibleToMs).toBe(8_250_000);
    for (const pane of [a, b, c]) {
      const sec = pane.getVisibleSec();
      expect(sec.from * 1000).toBe(4_500_000);
      expect(sec.to * 1000).toBe(8_250_000);
    }
  });
});