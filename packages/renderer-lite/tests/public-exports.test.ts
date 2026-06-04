import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as RendererLite from '../src/index.js';

const PUBLIC_RENDERER_LITE_VALUE_EXPORTS = [
  'IndicatorPaneStack',
  'PaneOrchestrator',
  'TimeScaleBus',
  'TimeScaleBusRegistry',
  'attachPaneResizer',
  'bollOverlayLines',
  'buildSliceTimes',
  'compensatePrependOnBus',
  'compensatePrependOnRegistry',
  'computePrependSliceDeltaForViewport',
  'countPrependSliceDelta',
  'defaultBarSpacingForInterval',
  'deriveRenderRange',
  'detectIndicatorBarMutation',
  'emaOverlayLine',
  'independentBusKey',
  'isLayeredPaneMount',
  'logicalIndexToBarTimeMs',
  'logicalRangeForVisibleWindow',
  'maOverlayLine',
  'normalizeSyncGroupId',
  'resolveBarSpacingForInterval',
  'resolveBusMapKey',
  'shouldResizeChartPane',
  'volMaOverlayLine',
] as const;

describe('@coderyo/renderer-lite public exports', () => {
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
    expect(Object.keys(RendererLite).sort()).toEqual([...PUBLIC_RENDERER_LITE_VALUE_EXPORTS].sort());
  });
});