import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as RendererWebgl from './index.js';

const PUBLIC_RENDERER_WEBGL_VALUE_EXPORTS = [
  'PACKAGE_NAME',
  'ChartViewport',
  'DEFAULT_BAR_SPACING',
  'clampBarSpacing',
  'WebGL2Context',
  'hasWebGL2',
  'CandlestickRenderer',
  'VolumeRenderer',
  'WebGLChartPane',
  'WebGLVolumePane',
  'WebGLPaneOrchestrator',
  'isLayeredPaneMount',
  'LineSeriesRenderer',
  'WebGLIndicatorStack',
  'WebGLIndicatorPane',
  'ViewportSyncBus',
  'DEFAULT_CHART_THEME',
  'mergeTheme',
  'priceRangeForBars',
  'maxVolumeForBars',
  'priceToY',
  'yToPrice',
  'buildMainOverlayLineSpecs',
  'WebGLDrawingLayer',
  'barIndexForTimeMs',
  'createChartCoordinateMapper',
  'timeMsAtBarIndex',
  'installWebGL2TestContext',
  'installWebGL2TestHarness',
  'isWebGL2TestContextInstalled',
  'pinePlotsToLineSpecs',
  'DEFAULT_PRICE_SCALE_OPTIONS',
  'DEFAULT_TIME_SCALE_OPTIONS',
  'DEFAULT_INDICATOR_PRICE_FORMAT',
  'symbolFormatFromInfo',
  'mergePriceScaleOptions',
  'mergeTimeScaleOptions',
] as const;

describe('@coderyo/renderer-webgl public exports', () => {
  it('package.json exposes only root entry', () => {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
        'utf8',
      ),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(pkg.exports).sort()).toEqual(['.']);
  });

  it('index runtime exports match allowlist', () => {
    expect(Object.keys(RendererWebgl).sort()).toEqual(
      [...PUBLIC_RENDERER_WEBGL_VALUE_EXPORTS].sort(),
    );
  });
});