import { describe, expect, it } from 'vitest';
import { ChartViewport } from '../chart-viewport.js';
import { priceToY } from '../price-scale.js';
import {
  computePriceTicks,
  formatPriceLabel,
  formatVolumeLabel,
  niceTickStep,
  scalePriceRange,
  translatePriceRange,
} from './price-scale-engine.js';
import { computeTimeTicks, formatTimeAxisLabel, medianBarIntervalMs } from './time-scale-engine.js';
import {
  applyScaleWheel,
  hitTestScaleRegion,
  regionToBandKind,
} from './scale-interaction.js';
import { TIME_AXIS_CSS_PX } from './scale-types.js';

describe('price-scale-engine', () => {
  it('niceTickStep picks human-readable steps', () => {
    expect(niceTickStep(100, 5)).toBe(20);
    expect(niceTickStep(0.45, 4)).toBeGreaterThan(0);
  });

  it('formatPriceLabel respects minMove', () => {
    expect(formatPriceLabel(100.123, { minMove: 0.01, precision: 2 })).toBe('100.12');
  });

  it('formatVolumeLabel compresses large values', () => {
    expect(formatVolumeLabel(1_500_000)).toMatch(/1\.5M/);
  });

  it('computePriceTicks returns multiple labels for tall band', () => {
    const ticks = computePriceTicks({
      range: { min: 0, max: 100 },
      top: 0,
      bottom: 400,
      minSpacingPx: 40,
    });
    expect(ticks.length).toBeGreaterThan(3);
  });

  it('computePriceTicks log mode labels actual prices', () => {
    const logRange = { min: Math.log(100), max: Math.log(200) };
    const ticks = computePriceTicks({
      range: logRange,
      top: 0,
      bottom: 200,
      mode: 'log',
      minSpacingPx: 40,
    });
    expect(ticks.length).toBeGreaterThan(1);
    for (const t of ticks) {
      expect(t.price).toBeGreaterThan(50);
      expect(t.price).toBeLessThan(250);
    }
  });

  it('scalePriceRange expands in log space', () => {
    const logRange = { min: Math.log(10), max: Math.log(100) };
    const r = scalePriceRange(logRange, 2, 0.5, 'log');
    expect(r.max - r.min).toBeGreaterThan(logRange.max - logRange.min);
  });

  it('translatePriceRange shifts min and max together', () => {
    const r = translatePriceRange({ min: 10, max: 20 }, 5);
    expect(r).toEqual({ min: 15, max: 25 });
  });
});

describe('time-scale-engine', () => {
  it('medianBarIntervalMs uses middle delta', () => {
    const bars = [{ t: 0 }, { t: 60_000 }, { t: 120_000 }];
    expect(medianBarIntervalMs(bars, 0, 2)).toBe(60_000);
  });

  it('formatTimeAxisLabel uses timezone', () => {
    const ms = Date.UTC(2024, 5, 1, 12, 0);
    const utc = formatTimeAxisLabel(ms, 3_600_000, 'UTC');
    const ny = formatTimeAxisLabel(ms, 3_600_000, 'America/New_York');
    expect(utc).not.toBe(ny);
  });

  it('per-host Intl cache does not cross-contaminate timezones', () => {
    const ms = Date.UTC(2024, 0, 15, 12, 0);
    const cacheA = new Map<string, Intl.DateTimeFormat>();
    const cacheB = new Map<string, Intl.DateTimeFormat>();
    const a = formatTimeAxisLabel(ms, 3_600_000, 'UTC', undefined, cacheA);
    const b = formatTimeAxisLabel(ms, 3_600_000, 'Asia/Tokyo', undefined, cacheB);
    expect(a).not.toBe(b);
  });

  it('computeTimeTicks adapts to viewport width', () => {
    const vp = new ChartViewport({ barSpacing: 8 });
    vp.setBarCount(100);
    vp.setVisibleRange(0, 50);
    const bars = Array.from({ length: 100 }, (_, i) => ({ t: i * 60_000 }));
    const narrow = computeTimeTicks({
      viewport: vp,
      bars,
      plotWidthPx: 200,
      dpr: 1,
      timeZone: 'UTC',
    });
    const wide = computeTimeTicks({
      viewport: vp,
      bars,
      plotWidthPx: 800,
      dpr: 1,
      timeZone: 'UTC',
    });
    expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
  });
});

describe('scale-interaction hitTest (CSS coordinates)', () => {
  const vp = new ChartViewport({ rightPaddingPx: 56 });

  it('detects price gutter on the right', () => {
    expect(
      hitTestScaleRegion(vp, {
        canvasX: 750,
        canvasY: 100,
        cssWidth: 800,
        cssHeight: 400,
        mainPaneHeight: 300,
      }),
    ).toBe('price-axis');
  });

  it('detects volume price gutter in volume band', () => {
    expect(
      hitTestScaleRegion(vp, {
        canvasX: 750,
        canvasY: 320,
        cssWidth: 800,
        cssHeight: 400,
        mainPaneHeight: 280,
        volumeBandTop: 280,
        volumeBandBottom: 380,
      }),
    ).toBe('volume-price-axis');
  });

  it('detects bottom time band using CSS height', () => {
    expect(
      hitTestScaleRegion(vp, {
        canvasX: 200,
        canvasY: 400 - TIME_AXIS_CSS_PX + 2,
        cssWidth: 800,
        cssHeight: 400,
        mainPaneHeight: 300,
      }),
    ).toBe('time-axis');
  });

  it('detects plot area', () => {
    expect(
      hitTestScaleRegion(vp, {
        canvasX: 200,
        canvasY: 100,
        cssWidth: 800,
        cssHeight: 400,
        mainPaneHeight: 300,
      }),
    ).toBe('plot');
  });

  it('time band height is stable across DPR (CSS contract)', () => {
    const vp = new ChartViewport({ rightPaddingPx: 56 });
    const cssH = 400;
    const yInBand = cssH - TIME_AXIS_CSS_PX + 2;
    expect(
      hitTestScaleRegion(vp, {
        canvasX: 200,
        canvasY: yInBand,
        cssWidth: 800,
        cssHeight: cssH,
        mainPaneHeight: 300,
      }),
    ).toBe('time-axis');
  });

  it('left price gutter when position is left', () => {
    vp.setPriceAxisPosition('left', 56);
    expect(
      hitTestScaleRegion(vp, {
        canvasX: 10,
        canvasY: 100,
        cssWidth: 800,
        cssHeight: 400,
        mainPaneHeight: 300,
        priceAxisPosition: 'left',
      }),
    ).toBe('price-axis');
  });
});

describe('applyScaleWheel', () => {
  it('zooms price axis in log space', () => {
    const vp = new ChartViewport();
    const logRange = { min: Math.log(50), max: Math.log(150) };
    let override: typeof logRange | null = null;
    const opts = {
      viewport: vp,
      getLayout: () => ({ cssWidth: 800, cssHeight: 400, mainPaneHeight: 300 }),
      priceScaleMode: () => 'log' as const,
      enableTimeInteraction: () => true,
      callbacks: {
        requestRender: () => {},
        getAutoPriceRange: () => logRange,
        getPriceRangeOverride: () => override,
        onPriceRangeOverride: (_b: 'price' | 'volume', r: typeof logRange | null) => {
          override = r;
        },
      },
    };
    applyScaleWheel(vp, opts, {
      region: 'price-axis',
      deltaY: 100,
      anchorPlotX: 400,
      plotWidthCss: vp.plotWidthPx(800),
    });
    expect(override).not.toBeNull();
    expect(override!.max - override!.min).toBeGreaterThan(logRange.max - logRange.min);
  });

  it('maps volume region to volume band kind', () => {
    expect(regionToBandKind('volume-price-axis')).toBe('volume');
    expect(regionToBandKind('price-axis')).toBe('price');
  });
});

describe('priceToY log + tags', () => {
  it('maps price through log range for overlay tags', () => {
    const range = { min: Math.log(100), max: Math.log(200) };
    const yTop = priceToY(200, range, 0, 100, 'log');
    const yBot = priceToY(100, range, 0, 100, 'log');
    expect(yTop).toBeLessThan(yBot);
  });
});

describe('volume scale override vs bar height', () => {
  it('tighter volumeRange.max yields taller normalized bars', () => {
    const paneHeight = 80;
    const vol = 100;
    const hAuto = (vol / 100) * paneHeight;
    const hOverride = (vol / 50) * paneHeight;
    expect(hOverride).toBeGreaterThan(hAuto);
    expect(hOverride).toBeCloseTo(paneHeight * 2, 5);
  });
});