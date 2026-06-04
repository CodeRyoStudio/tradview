import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Core from '../src/index.js';

/** Runtime root export allowlist (type-only exports are not enumerable). */
const PUBLIC_CORE_VALUE_EXPORTS = [
  'ChartController',
  'DEFAULT_CHART_FEATURES',
  'DEFAULT_INDICATOR_CONFIG',
  'PENDING_SYMBOL',
  'PINE_EDITOR_DEFAULT',
  'PINE_SAMPLE_SCRIPT',
  'TRADVIEW_API_VERSION',
  'TRADVIEW_VERSION',
  'clearedIndicatorConfig',
  'compilePineLite',
  'createChart',
  'createDemoChartFeatures',
  'createDemoChartOptions',
  'createLocalChartStorage',
  'defaultChartStorage',
  'disableIndicatorLayer',
  'hasAnyActiveIndicators',
  'hasMainChartOverlays',
  'hasVisibleIndicatorPanes',
  'indicatorConfigStorageKey',
  'listActiveIndicatorLayers',
  'loadIndicatorConfig',
  'resolveChartFeatures',
  'resolvePaneSyncGroupsFromLayers',
  'runPineLite',
  'saveIndicatorConfig',
  'wireChartBridge',
  'registerChartLayerBridge',
  'unregisterChartLayerBridge',
  'clearLayerBridgeVisitedPages',
  'handleLayerBridgeMessage',
  'resolvePaneLayerIds',
  'isValidLayerBridgePane',
  'resolvePaneSyncGroupsForBridge',
  'hasLayerBridgeRegistration',
  'mergeLayerBridgePreset',
] as const;

describe('@coderyo/core public exports', () => {
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
    const names = Object.keys(Core).sort();
    expect(names).toEqual([...PUBLIC_CORE_VALUE_EXPORTS].sort());
  });

  it('IChart documents indicator layer helpers', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/create-chart.ts'),
      'utf8',
    );
    expect(src).toContain('listIndicatorLayers()');
    expect(src).toContain('disableIndicatorLayer(id');
  });
});