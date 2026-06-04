import type { ResolvedLayoutFeatures } from '../layout-features.js';
import type { LayoutWidgetId } from '../layout-schema.js';

export type CompositorShellWidgetId = LayoutWidgetId;

export interface CompositorShellHandle {
  root: HTMLElement;
  /** Hidden anchor grid (v2 compositor positions widgets; no 12×12 layout). */
  grid: HTMLElement;
  cells: Map<CompositorShellWidgetId, HTMLElement>;
}

export interface CreateCompositorShellOptions {
  widgets: Partial<Record<CompositorShellWidgetId, HTMLElement>>;
}

/** Minimal DOM shell for LayoutPreset v2 — replaces legacy createLayoutGrid when compositor-managed. */
export function createCompositorShell(
  opts: CreateCompositorShellOptions,
): CompositorShellHandle {
  const cells = new Map<CompositorShellWidgetId, HTMLElement>();

  const root = document.createElement('div');
  root.className = 'tv-layout-root tv-layout-root--compositor';
  root.style.cssText =
    'display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;width:100%;height:100%;box-sizing:border-box;position:relative;';

  const grid = document.createElement('div');
  grid.className = 'tv-compositor-shell-grid';
  grid.style.cssText =
    'position:absolute;inset:0;overflow:hidden;visibility:hidden;pointer-events:none;z-index:0;';
  root.appendChild(grid);

  const widgetIds: CompositorShellWidgetId[] = [
    'topBar',
    'leftToolbar',
    'bottomToolbar',
    'chartHost',
    'indicatorHost',
    'statusBar',
    'propertiesPanel',
  ];

  for (const id of widgetIds) {
    const cell = document.createElement('div');
    cell.className = `tv-layout-cell tv-layout-cell--${id}`;
    cell.dataset.widgetId = id;
    cell.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;';
    const el = opts.widgets[id];
    if (el) {
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.minWidth = '0';
      el.style.minHeight = '0';
      if (id === 'chartHost') el.style.position = 'relative';
      cell.appendChild(el);
    }
    cells.set(id, cell);
    grid.appendChild(cell);
  }

  return { root, grid, cells };
}

/** No-op schema apply for compositor shell (features still drive widget mount in chart-layout). */
export function applyCompositorShellFeatures(
  _cells: Map<CompositorShellWidgetId, HTMLElement>,
  _features: ResolvedLayoutFeatures,
): void {
  /* visibility driven by LayerCompositor + syncCompositorShellVisibility */
}