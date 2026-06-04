/** V2-L1 — DOM slots for {@link ChartWorkspace} / `host.workspace.createChart` (`containerId`). */

export interface WorkspaceChartSlot {
  chartId: string;
  containerId: string;
  element: HTMLElement;
}

export type WorkspaceChartSlotsLayout = 'row' | 'column' | 'grid2';

export interface CreateWorkspaceChartSlotsOptions {
  /** Default `grid2` (two charts side-by-side). */
  layout?: WorkspaceChartSlotsLayout;
  /** Slot ids used as `containerId` + default `chartId` (default `['chart-a','chart-b']`). */
  slotIds?: string[];
  /** Optional id prefix for generated container elements. */
  idPrefix?: string;
}

export interface WorkspaceChartSlotsHandle {
  slots: WorkspaceChartSlot[];
  root: HTMLElement;
  destroy: () => void;
}

function layoutStyle(layout: WorkspaceChartSlotsLayout): string {
  switch (layout) {
    case 'column':
      return 'display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-height:0;box-sizing:border-box;';
    case 'row':
      return 'display:flex;flex-direction:row;gap:8px;width:100%;height:100%;min-height:0;box-sizing:border-box;';
    case 'grid2':
    default:
      return 'display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;height:100%;min-height:0;box-sizing:border-box;';
  }
}

/**
 * Creates mount points for multi-chart workspaces. Each slot has a stable `id` for
 * `host.workspace.createChart` and programmatic `ChartWorkspace.createChart`.
 */
export function createWorkspaceChartSlots(
  parent: HTMLElement,
  opts: CreateWorkspaceChartSlotsOptions = {},
): WorkspaceChartSlotsHandle {
  const layout = opts.layout ?? 'grid2';
  const ids = opts.slotIds ?? ['chart-a', 'chart-b'];
  const prefix = opts.idPrefix ?? 'tv-ws-slot-';

  const root = document.createElement('div');
  root.className = 'tv-workspace-chart-slots';
  root.style.cssText = layoutStyle(layout);
  parent.appendChild(root);

  const slots = ids.map((chartId) => {
    const containerId = `${prefix}${chartId}`;
    const element = document.createElement('div');
    element.id = containerId;
    element.dataset.chartId = chartId;
    element.className = 'tv-workspace-chart-slot';
    element.style.cssText =
      'position:relative;min-width:0;min-height:0;width:100%;height:100%;overflow:hidden;background:#0d1117;border:1px solid #30363d;border-radius:4px;box-sizing:border-box;';
    root.appendChild(element);
    return { chartId, containerId, element };
  });

  return {
    slots,
    root,
    destroy: () => {
      root.remove();
    },
  };
}