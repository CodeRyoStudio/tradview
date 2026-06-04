import type { IChartApi } from 'lightweight-charts';
import { TimeScaleBus } from './time-scale-bus.js';

/** Trim; empty / whitespace → independent pane (no cross-pane sync). */
export function normalizeSyncGroupId(id?: string | null): string | null {
  if (id == null) return null;
  const trimmed = String(id).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type PaneSyncKey = 'main' | 'volume' | 'indicator';

const INDEP_PREFIX = '@independent:';

export function independentBusKey(pane: PaneSyncKey): string {
  return `${INDEP_PREFIX}${pane}`;
}

export function resolveBusMapKey(
  groupId: string | null | undefined,
  pane: PaneSyncKey,
): string {
  const norm = normalizeSyncGroupId(groupId);
  return norm ?? independentBusKey(pane);
}

export interface PaneSyncGroupPatch {
  main?: string | null;
  volume?: string | null;
  indicator?: string | null;
}

/**
 * One {@link TimeScaleBus} per sync group id; empty group id → per-pane independent bus.
 */
export class TimeScaleBusRegistry {
  private readonly buses = new Map<string, TimeScaleBus>();
  private readonly paneKeys = new Map<PaneSyncKey, string>();
  private activeKey: string;

  constructor() {
    for (const pane of ['main', 'volume', 'indicator'] as const) {
      const key = independentBusKey(pane);
      this.paneKeys.set(pane, key);
      this.getOrCreateBus(key);
    }
    this.activeKey = this.paneKeys.get('main')!;
  }

  getOrCreateBus(key: string): TimeScaleBus {
    let bus = this.buses.get(key);
    if (!bus) {
      bus = new TimeScaleBus();
      this.buses.set(key, bus);
    }
    return bus;
  }

  getBusKeyForPane(pane: PaneSyncKey): string {
    return this.paneKeys.get(pane)!;
  }

  getBusForPane(pane: PaneSyncKey): TimeScaleBus {
    return this.getOrCreateBus(this.getBusKeyForPane(pane));
  }

  /** Active bus for IChart viewport APIs (follows last-focused chart pane). */
  get activeBus(): TimeScaleBus {
    return this.getOrCreateBus(this.activeKey);
  }

  getActiveBusKey(): string {
    return this.activeKey;
  }

  setActivePane(pane: PaneSyncKey): void {
    this.activeKey = this.paneKeys.get(pane)!;
  }

  setPaneSyncGroup(pane: PaneSyncKey, groupId: string | null | undefined): string {
    const nextKey = resolveBusMapKey(groupId, pane);
    const prevKey = this.paneKeys.get(pane)!;
    this.paneKeys.set(pane, nextKey);
    this.getOrCreateBus(nextKey);
    if (this.activeKey === prevKey) this.activeKey = nextKey;
    return prevKey;
  }

  forEachBus(fn: (key: string, bus: TimeScaleBus) => void): void {
    for (const [key, bus] of this.buses) fn(key, bus);
  }

  moveChart(chart: IChartApi, fromKey: string, toKey: string, copyRange = true): void {
    if (fromKey === toKey) return;
    const from = this.getOrCreateBus(fromKey);
    const to = this.getOrCreateBus(toKey);
    const range = copyRange ? from.getVisibleRange() : null;
    from.unregister(chart);
    to.register(chart);
    if (range) to.setVisibleTimeRange(range);
  }
}