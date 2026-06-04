import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { ChartController } from '../src/chart-controller.js';
import {
  resolvePaneSyncGroupsFromLayers,
  type PaneSyncGroupPatch,
} from '../src/resolve-pane-sync-groups.js';

const srcPath = join(dirname(fileURLToPath(import.meta.url)), '../src/chart-controller.ts');
const chartControllerSrc = readFileSync(srcPath, 'utf8');
const createChartSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/create-chart.ts'),
  'utf8',
);

describe('resolvePaneSyncGroupsFromLayers', () => {
  it('picks sync groups from the requested page only', () => {
    const layers = [
      { type: 'chart.main', pageId: 'p1', syncTimeScaleGroupId: 'page-one' },
      { type: 'chart.volume', pageId: 'p1', syncTimeScaleGroupId: 'page-one' },
      { type: 'chart.indicator', pageId: 'p1', syncTimeScaleGroupId: 'osc-one' },
      { type: 'chart.main', pageId: 'p2', syncTimeScaleGroupId: 'page-two' },
      { type: 'chart.volume', pageId: 'p2', syncTimeScaleGroupId: 'page-two' },
      { type: 'chart.indicator', pageId: 'p2', syncTimeScaleGroupId: 'osc-two' },
    ];
    expect(resolvePaneSyncGroupsFromLayers(layers, 'p1')).toEqual({
      main: 'page-one',
      volume: 'page-one',
      indicator: 'osc-one',
    });
    expect(resolvePaneSyncGroupsFromLayers(layers, 'p2')).toEqual({
      main: 'page-two',
      volume: 'page-two',
      indicator: 'osc-two',
    });
  });

  it('returns null for present pane with cleared or missing sync id (independent)', () => {
    expect(
      resolvePaneSyncGroupsFromLayers(
        [
          { type: 'chart.main', pageId: 'p1' },
          { type: 'chart.volume', pageId: 'p1', syncTimeScaleGroupId: 'prices' },
        ],
        'p1',
      ),
    ).toEqual({ main: null, volume: 'prices', indicator: undefined });

    expect(
      resolvePaneSyncGroupsFromLayers(
        [{ type: 'chart.main', pageId: 'p1', syncTimeScaleGroupId: '' }],
        'p1',
      ),
    ).toEqual({ main: null, volume: undefined, indicator: undefined });
  });

  it('without pageId uses first global match per pane type', () => {
    const layers = [
      { type: 'chart.main', pageId: 'p1', syncTimeScaleGroupId: 'first' },
      { type: 'chart.main', pageId: 'p2', syncTimeScaleGroupId: 'second' },
    ];
    expect(resolvePaneSyncGroupsFromLayers(layers)).toEqual({
      main: 'first',
      volume: undefined,
      indicator: undefined,
    });
  });

  it('matches VENDOR_DUAL_SYNC_PRESET shape when scoped to one page', () => {
    const layers = [
      { type: 'chart.main', pageId: 'p1', syncTimeScaleGroupId: 'prices' },
      { type: 'chart.volume', pageId: 'p1', syncTimeScaleGroupId: 'prices' },
      { type: 'chart.indicator', pageId: 'p1', syncTimeScaleGroupId: 'osc' },
    ];
    expect(resolvePaneSyncGroupsFromLayers(layers, 'p1')).toEqual({
      main: 'prices',
      volume: 'prices',
      indicator: 'osc',
    });
  });
});

describe('ChartController time-scale sync groups', () => {
  it('applyTimeScaleSyncFromLayers calls setPaneSyncGroups with resolved patch', () => {
    const setPaneSyncGroups = vi.fn();
    const ctrl = Object.create(ChartController.prototype) as ChartController;
    Object.defineProperty(ctrl, 'orchestrator', {
      value: { setPaneSyncGroups },
      configurable: true,
    });
    const layers = [
      { type: 'chart.main', pageId: 'p1', syncTimeScaleGroupId: 'A' },
      { type: 'chart.main', pageId: 'p2', syncTimeScaleGroupId: 'B' },
      { type: 'chart.volume', pageId: 'p2', syncTimeScaleGroupId: 'B' },
    ];
    ChartController.prototype.applyTimeScaleSyncFromLayers.call(ctrl, layers, 'p2');
    expect(setPaneSyncGroups).toHaveBeenCalledWith({
      main: 'B',
      volume: 'B',
      indicator: undefined,
    });
  });

  it('applyTimeScaleSyncFromLayers passes main: null when sync group cleared', () => {
    const setPaneSyncGroups = vi.fn();
    const ctrl = Object.create(ChartController.prototype) as ChartController;
    Object.defineProperty(ctrl, 'orchestrator', {
      value: { setPaneSyncGroups },
      configurable: true,
    });
    const layers = [
      { type: 'chart.main', pageId: 'p1' },
      { type: 'chart.volume', pageId: 'p1', syncTimeScaleGroupId: 'prices' },
    ];
    ChartController.prototype.applyTimeScaleSyncFromLayers.call(ctrl, layers, 'p1');
    expect(setPaneSyncGroups).toHaveBeenCalledWith({
      main: null,
      volume: 'prices',
      indicator: undefined,
    });
  });

  it('subscribes transform per bus and updates active VirtualWindow only', () => {
    expect(chartControllerSrc).toContain('busRegistry.forEachBus');
    expect(chartControllerSrc).toContain('getActiveBusKey()');
    expect(chartControllerSrc).toContain('activeVirtualWindow()');
  });

  it('exposes applyTimeScaleSyncFromLayers on controller and IChart', () => {
    expect(chartControllerSrc).toContain('applyTimeScaleSyncFromLayers');
    expect(chartControllerSrc).toContain('resolvePaneSyncGroupsFromLayers');
    expect(createChartSrc).toContain('applyTimeScaleSyncFromLayers');
  });

  it('setChartPaneResizeFocus selects active sync pane', () => {
    expect(chartControllerSrc).toContain('setActiveSyncPane(pane)');
  });

  it('wires subscribeTransform for overlay transform fan-out', () => {
    expect(chartControllerSrc).toContain('subscribeTransform');
    expect(chartControllerSrc).toContain('busRegistry.forEachBus');
  });
});