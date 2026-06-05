import { describe, expect, it, vi } from 'vitest';
import type { Bar, DataProvider } from '@coderyo/data';
import { DEFAULT_INDICATOR_CONFIG } from '@coderyo/indicators';
import { ChartController } from '../src/chart-controller.js';
import { hasWebGL2 } from '@coderyo/renderer-webgl';

const stubProvider = {
  getHistory: vi.fn(async () => ({ bars: [], hasMore: false })),
  subscribe: vi.fn(() => 'sub-1'),
  unsubscribe: vi.fn(),
} as unknown as DataProvider;

const barsWithVolume: Bar[] = Array.from({ length: 20 }, (_, i) => ({
  t: Date.UTC(2024, 0, 1) + i * 3_600_000,
  o: 100 + i,
  h: 101 + i,
  l: 99 + i,
  c: 100.5 + i,
  v: 10,
}));

const barsMissingVolume: Bar[] = barsWithVolume.map(({ v: _v, ...rest }) => ({ ...rest }));

describe.skipIf(!hasWebGL2())('ChartController volume data validation', () => {
  it('emits VOLUME_DATA_MISSING once per distinct issue and dedupes on refresh', async () => {
    const el = document.createElement('div');
    el.style.width = '400px';
    el.style.height = '300px';
    document.body.appendChild(el);

    const errors: unknown[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    stubProvider.getHistory = vi.fn(async () => ({
      bars: barsMissingVolume,
      hasMore: false,
    }));

    const controller = new ChartController(el, {
      dataProvider: stubProvider,
      symbol: 'TEST',
      features: { renderer: 'webgl', indicators: DEFAULT_INDICATOR_CONFIG },
    });

    controller.on('error', (payload) => errors.push(payload));

    await controller.setSymbol('BINANCE:BTCUSDT');

    const volumeErrors = errors.filter(
      (e) =>
        e &&
        typeof e === 'object' &&
        (e as { code?: string }).code === 'VOLUME_DATA_MISSING',
    );
    expect(volumeErrors.length).toBe(1);
    expect(volumeErrors[0]).toMatchObject({
      kind: 'volume',
      code: 'VOLUME_DATA_MISSING',
    });
    expect(String((volumeErrors[0] as { message?: string }).message)).toMatch(/Disable volume/);

    const warnCallsAfterFirst = warnSpy.mock.calls.length;
    await controller.setSymbol('BINANCE:BTCUSDT');
    expect(warnSpy.mock.calls.length).toBe(warnCallsAfterFirst);

    warnSpy.mockRestore();
    controller.destroy();
    el.remove();
  });
});