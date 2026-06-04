import { describe, expect, it, vi } from 'vitest';
import type { Bar, DataProvider } from '@coderyo/data';
import { ChartController } from '../src/chart-controller.js';
import { hasWebGL2 } from '@coderyo/renderer-webgl';

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

const sampleBars: Bar[] = Array.from({ length: 20 }, (_, i) => ({
  t: Date.UTC(2024, 0, 1) + i * 3_600_000,
  o: 100 + i,
  h: 101 + i,
  l: 99 + i,
  c: 100.5 + i,
  v: 10,
}));

describe.skipIf(!hasWebGL2())('ChartController webgl renderer (V2-R12)', () => {
  it('mounts WebGL backend when features.renderer is webgl', () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const controller = new ChartController(el, {
      dataProvider: stubProvider,
      symbol: 'TEST',
      features: { renderer: 'webgl', indicators: null },
    });

    expect(controller.getFeatures().renderer).toBe('webgl');
    expect(el.querySelector('canvas')).toBeTruthy();

    controller.destroy();
    el.remove();
  });

  it('accepts setSymbol on webgl path', async () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const controller = new ChartController(el, {
      dataProvider: stubProvider,
      features: { renderer: 'webgl', indicators: null },
    });

    stubProvider.getHistory = vi.fn(async () => ({
      bars: sampleBars,
      hasMore: false,
    }));

    await controller.setSymbol('BINANCE:BTCUSDT');
    expect(controller.hasActiveSymbol()).toBe(true);

    controller.destroy();
    el.remove();
  });

  it('emits crosshairChange from pointer move when bars loaded', async () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const payloads: unknown[] = [];
    const controller = new ChartController(el, {
      dataProvider: stubProvider,
      features: { renderer: 'webgl', indicators: null },
    });
    controller.on('crosshairChange', (p) => payloads.push(p));

    stubProvider.getHistory = vi.fn(async () => ({
      bars: sampleBars,
      hasMore: false,
    }));
    await controller.setSymbol('BINANCE:BTCUSDT');

    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        clientX: rect.left + rect.width * 0.5,
        clientY: rect.top + rect.height * 0.4,
      }),
    );

    expect(payloads.some((p) => p && typeof p === 'object' && 'time' in (p as object))).toBe(
      true,
    );

    controller.destroy();
    el.remove();
  });
});