import type { BridgeAdapter } from '@coderyo/bridge';
import type { ChartSummaryV3, LinkSyncFlagsV3 } from '@coderyo/bridge';
import type { Interval } from '@coderyo/data';
import type { ChartVisibleRange } from '@coderyo/renderer-lite';
import { createChart, type CreateChartOptions, type IChart } from './create-chart.js';
import { wireWorkspaceBridge } from './workspace-bridge.js';

export interface ChartWorkspaceOptions {
  workspaceId?: string;
  dataProvider: CreateChartOptions['dataProvider'];
  defaultLinkGroupId?: string;
  bridge?: BridgeAdapter;
}

export interface LinkSyncFlags {
  symbol?: boolean;
  interval?: boolean;
  visibleRange?: boolean;
  crosshair?: boolean;
}

export interface LinkGroup {
  id: string;
  chartIds: readonly string[];
  sync: LinkSyncFlags;
  /** Monotonic; prevents re-entrant fan-out. */
  generation: number;
}

export type LinkEvent =
  | { type: 'symbol'; symbol: string }
  | { type: 'interval'; interval: Interval }
  | { type: 'visibleRange'; range: ChartVisibleRange };

interface ChartEntry {
  chart: IChart;
  container: HTMLElement;
}

/**
 * Multi-chart workspace (V2-MC1). Each chart has an independent time-scale bus;
 * link groups fan-out symbol/interval/range per {@link LinkGroup.sync}.
 */
export class ChartWorkspace {
  private readonly workspaceId: string;
  private readonly charts = new Map<string, ChartEntry>();
  private activeChartId: string | null = null;
  private linkGroup: LinkGroup | null = null;
  private linkGeneration = 0;
  private applyingLink = false;
  private workspaceBridgeTeardown: (() => void) | null = null;

  constructor(private readonly options: ChartWorkspaceOptions) {
    this.workspaceId = options.workspaceId ?? 'default';
    if (options.bridge) {
      this.workspaceBridgeTeardown = wireWorkspaceBridge({
        workspace: this,
        bridge: options.bridge,
      });
    }
    if (options.defaultLinkGroupId) {
      this.linkGroup = {
        id: options.defaultLinkGroupId,
        chartIds: [],
        sync: {},
        generation: 0,
      };
    }
  }

  getWorkspaceId(): string {
    return this.workspaceId;
  }

  getDataProvider(): CreateChartOptions['dataProvider'] {
    return this.options.dataProvider;
  }

  listChartSummaries(): ChartSummaryV3[] {
    return [...this.charts.keys()].map((chartId) => ({
      chartId,
      active: chartId === this.activeChartId,
    }));
  }

  getActiveChartId(): string | null {
    return this.activeChartId;
  }

  createChart(chartId: string, container: HTMLElement, opts?: CreateChartOptions): IChart {
    if (this.charts.has(chartId)) {
      throw new Error(`Chart already exists: ${chartId}`);
    }

    const chart = createChart(container, {
      ...opts,
      chartId,
      dataProvider: opts?.dataProvider ?? this.options.dataProvider,
      bridge: this.options.bridge,
      workspaceContext: {
        workspaceId: this.workspaceId,
        getChartSummaries: () => this.listChartSummaries(),
      },
    });

    const entry: ChartEntry = { chart, container };
    this.charts.set(chartId, entry);
    if (!this.activeChartId) this.activeChartId = chartId;

    chart.on('symbolChange', (info) => {
      const sym =
        info && typeof info === 'object' && 'symbol' in info
          ? String((info as { symbol: string }).symbol)
          : '';
      if (sym) this.notifySymbolChange(chartId, sym);
    });
    chart.on('intervalChange', (interval) => {
      if (typeof interval === 'string') {
        this.notifyIntervalChange(chartId, interval as Interval);
      }
    });
    chart.on('visibleRangeChange', (range) => {
      if (range && typeof range === 'object') {
        this.applyLinkEvent(chartId, {
          type: 'visibleRange',
          range: range as ChartVisibleRange,
        });
      }
    });
    chart.on('destroyed', () => {
      this.charts.delete(chartId);
      if (this.activeChartId === chartId) {
        this.activeChartId = this.charts.keys().next().value ?? null;
      }
    });

    if (this.linkGroup && !this.linkGroup.chartIds.includes(chartId)) {
      this.linkGroup = {
        ...this.linkGroup,
        chartIds: [...this.linkGroup.chartIds, chartId],
      };
    }

    return chart;
  }

  destroyChart(chartId: string): void {
    const entry = this.charts.get(chartId);
    if (!entry) return;
    entry.chart.destroy();
    this.charts.delete(chartId);
    if (this.activeChartId === chartId) {
      this.activeChartId = this.charts.keys().next().value ?? null;
    }
    if (this.linkGroup) {
      this.linkGroup = {
        ...this.linkGroup,
        chartIds: this.linkGroup.chartIds.filter((id) => id !== chartId),
      };
    }
  }

  getChart(chartId: string): IChart | undefined {
    return this.charts.get(chartId)?.chart;
  }

  setActiveChart(chartId: string, previousChartId?: string): void {
    if (!this.charts.has(chartId)) {
      throw new Error(`CHART_NOT_FOUND: ${chartId}`);
    }
    this.activeChartId = chartId;
    this.options.bridge?.post({
      type: 'chart.focusChanged',
      payload: { chartId, previousChartId },
    });
  }

  setLinkGroup(group: LinkGroup): void {
    this.linkGroup = { ...group, generation: group.generation ?? this.linkGeneration };
    this.options.bridge?.post({
      type: 'chart.linkStateChanged',
      payload: {
        groupId: group.id,
        chartIds: [...group.chartIds],
        sync: group.sync as LinkSyncFlagsV3,
      },
    });
  }

  /** Fan-out link sync from a source chart (same-tick, guarded by generation). */
  applyLinkEvent(sourceChartId: string, event: LinkEvent): void {
    if (this.applyingLink || !this.linkGroup) return;
    if (!this.linkGroup.chartIds.includes(sourceChartId)) return;

    const { sync } = this.linkGroup;
    const targets = this.linkGroup.chartIds.filter((id) => id !== sourceChartId);
    if (targets.length === 0) return;

    const gen = this.linkGroup.generation;
    this.applyingLink = true;
    try {
      for (const targetId of targets) {
        const target = this.charts.get(targetId)?.chart;
        if (!target) continue;
        switch (event.type) {
          case 'symbol':
            if (sync.symbol) void target.setSymbol(event.symbol);
            break;
          case 'interval':
            if (sync.interval) void target.setInterval(event.interval);
            break;
          case 'visibleRange':
            if (sync.visibleRange) target.setVisibleRange(event.range);
            break;
        }
      }
    } finally {
      this.applyingLink = false;
      if (this.linkGroup.generation === gen) {
        this.linkGeneration += 1;
        this.linkGroup = { ...this.linkGroup, generation: this.linkGeneration };
      }
    }
  }

  destroy(): void {
    for (const id of [...this.charts.keys()]) {
      this.destroyChart(id);
    }
    this.workspaceBridgeTeardown?.();
    this.workspaceBridgeTeardown = null;
  }

  /** @internal Used by workspace bridge (V2-B4). */
  resolveContainer(containerId: string): HTMLElement | null {
    return document.getElementById(containerId);
  }

  /** Called from chart event wiring after symbol/interval applied on source. */
  notifySymbolChange(sourceChartId: string, symbol: string): void {
    this.applyLinkEvent(sourceChartId, { type: 'symbol', symbol });
  }

  notifyIntervalChange(sourceChartId: string, interval: Interval): void {
    this.applyLinkEvent(sourceChartId, { type: 'interval', interval });
  }
}