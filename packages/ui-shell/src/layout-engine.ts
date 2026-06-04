import type { ResolvedLayoutFeatures } from './layout-features.js';
import {
  LEGACY_LAYOUT_WARN_KEYS,
  WARN_MSG_CREATE_LAYOUT_GRID,
  warnLegacyLayoutOnce,
} from './layout-deprecation.js';
import {
  cloneLayoutSchema,
  type LayoutSchema,
  type LayoutWidgetId,
  type LayoutWidgetPlacement,
} from './layout-schema.js';

export type LayoutWidgetElements = Partial<Record<LayoutWidgetId, HTMLElement>>;

/**
 * Handle for a mounted v1 12×12 CSS grid shell.
 * @internal v1 grid layout API — removed from `@coderyo/ui-shell` public export @ 2.0.0-rc.2. Use compositor + `@coderyo/ui-shell/migrate`. See docs/MIGRATION-2.0.md §5.
 */
export interface LayoutGridHandle {
  root: HTMLElement;
  grid: HTMLElement;
  cells: Map<LayoutWidgetId, HTMLElement>;
  applySchema: (schema: LayoutSchema, features: ResolvedLayoutFeatures) => void;
  enableEditor: (enabled: boolean) => void;
  getSchema: () => LayoutSchema;
  setSchema: (schema: LayoutSchema) => void;
  destroyEditor: () => void;
}

/**
 * @internal v1 grid layout API — removed from public export @ 2.0.0-rc.2. See docs/MIGRATION-2.0.md §5.
 */
export interface CreateLayoutGridOptions {
  schema: LayoutSchema;
  widgets: LayoutWidgetElements;
  features: ResolvedLayoutFeatures;
  editor?: boolean;
  onSchemaChange?: (schema: LayoutSchema) => void;
  /**
   * @internal Suppresses the L7a deprecation warn when `createLayoutGrid` is only used from
   * `mountChartLayout` legacy branch (mount-level warn already emitted).
   */
  suppressDeprecationWarn?: boolean;
}

/**
 * Mount the legacy 12×12 CSS grid layout shell.
 * @internal v1 grid layout API — removed from public export @ 2.0.0-rc.2. Use `createCompositorShell` + `mountChartLayout({ layerCompositorManaged: true })`. See docs/MIGRATION-2.0.md §5.
 */
export function createLayoutGrid(opts: CreateLayoutGridOptions): LayoutGridHandle {
  if (!opts.suppressDeprecationWarn) {
    warnLegacyLayoutOnce(LEGACY_LAYOUT_WARN_KEYS.createLayoutGrid, WARN_MSG_CREATE_LAYOUT_GRID);
  }
  let schema = cloneLayoutSchema(opts.schema);
  const cells = new Map<LayoutWidgetId, HTMLElement>();

  const root = document.createElement('div');
  root.className = 'tv-layout-root';
  root.style.cssText =
    'display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;width:100%;height:100%;box-sizing:border-box;';

  const grid = document.createElement('div');
  grid.className = 'tv-layout-grid';
  grid.style.cssText =
    'display:grid;flex:1;min-height:0;min-width:0;width:100%;position:relative;gap:0;';
  root.appendChild(grid);

  for (const w of schema.widgets) {
    const cell = document.createElement('div');
    cell.className = `tv-layout-cell tv-layout-cell--${w.id}`;
    cell.dataset.widgetId = w.id;
    cell.style.cssText =
      'min-width:0;min-height:0;overflow:hidden;position:relative;box-sizing:border-box;';
    const el = opts.widgets[w.id];
    if (el) {
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.minWidth = '0';
      el.style.minHeight = '0';
      if (w.id === 'chartHost') el.style.position = 'relative';
      cell.appendChild(el);
    }
    cells.set(w.id, cell);
    grid.appendChild(cell);
  }

  let editorCtl: LayoutEditorController | null = null;

  const applySchema = (next: LayoutSchema, features: ResolvedLayoutFeatures) => {
    schema = cloneLayoutSchema(next);
    applyGridTemplate(grid, schema, features);
    for (const w of schema.widgets) {
      const cell = cells.get(w.id);
      if (!cell) continue;
      applyPlacementStyle(cell, w);
      const visible = widgetVisible(w.id, features);
      cell.style.display = visible ? '' : 'none';
      cell.style.pointerEvents = visible ? '' : 'none';
    }
    editorCtl?.refresh(schema);
  };

  const enableEditor = (enabled: boolean) => {
    if (enabled) {
      if (!editorCtl) {
        editorCtl = new LayoutEditorController(grid, cells, schema, (s) => {
          schema = s;
          opts.onSchemaChange?.(s);
        });
      }
      editorCtl.enable(true);
      root.classList.add('tv-layout--edit');
    } else {
      editorCtl?.enable(false);
      root.classList.remove('tv-layout--edit');
    }
  };

  applySchema(schema, opts.features);
  if (opts.editor) enableEditor(true);

  return {
    root,
    grid,
    cells,
    applySchema,
    enableEditor,
    getSchema: () => cloneLayoutSchema(schema),
    setSchema: (s) => {
      schema = cloneLayoutSchema(s);
      applySchema(schema, opts.features);
    },
    destroyEditor: () => {
      editorCtl?.destroy();
      editorCtl = null;
    },
  };
}

function widgetVisible(id: LayoutWidgetId, f: ResolvedLayoutFeatures): boolean {
  switch (id) {
    case 'topBar':
      return f.showTopBar;
    case 'leftToolbar':
      return f.showLeftToolbar;
    case 'bottomToolbar':
      return f.showBottomToolbar;
    case 'statusBar':
      return f.showStatusBar;
    case 'propertiesPanel':
      return f.showPropertiesPanel;
    case 'chartHost':
    case 'indicatorHost':
      return true;
    default:
      return true;
  }
}

const LEFT_TOOLBAR_COL_PX = 44;

function applyGridTemplate(
  grid: HTMLElement,
  schema: LayoutSchema,
  features?: ResolvedLayoutFeatures,
): void {
  const narrowToolbar = features?.showLeftToolbar ?? false;
  if (narrowToolbar && schema.columns >= 2) {
    grid.style.gridTemplateColumns = `${LEFT_TOOLBAR_COL_PX}px repeat(${schema.columns - 1}, minmax(0, 1fr))`;
  } else {
    grid.style.gridTemplateColumns = `repeat(${schema.columns}, minmax(0, 1fr))`;
  }
  grid.style.gridTemplateRows = `repeat(${schema.rows}, minmax(0, 1fr))`;
}

function applyPlacementStyle(cell: HTMLElement, w: LayoutWidgetPlacement): void {
  cell.style.gridColumn = `${w.col + 1} / span ${w.colSpan}`;
  cell.style.gridRow = `${w.row + 1} / span ${w.rowSpan}`;
}

class LayoutEditorController {
  private enabled = false;
  private drag: {
    id: LayoutWidgetId;
    startX: number;
    startY: number;
    origin: LayoutWidgetPlacement;
  } | null = null;
  private resize: {
    id: LayoutWidgetId;
    startX: number;
    startY: number;
    origin: LayoutWidgetPlacement;
  } | null = null;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly grid: HTMLElement,
    private readonly cells: Map<LayoutWidgetId, HTMLElement>,
    private schema: LayoutSchema,
    private readonly onChange: (schema: LayoutSchema) => void,
  ) {}

  refresh(schema: LayoutSchema): void {
    this.schema = cloneLayoutSchema(schema);
    for (const w of this.schema.widgets) {
      const cell = this.cells.get(w.id);
      if (cell) applyPlacementStyle(cell, w);
    }
  }

  enable(on: boolean): void {
    if (this.enabled === on) return;
    this.enabled = on;
    if (on) this.bind();
    else this.unbind();
  }

  destroy(): void {
    this.enable(false);
  }

  private bind(): void {
    for (const [id, cell] of this.cells) {
      const handle = document.createElement('div');
      handle.className = 'tv-layout-drag-handle';
      handle.title = `Drag ${id}`;
      handle.style.cssText =
        'position:absolute;top:2px;left:2px;z-index:20;padding:2px 6px;font-size:10px;background:#388bfd;color:#fff;border-radius:3px;cursor:grab;user-select:none;opacity:0.85;';
      handle.textContent = id;

      const resize = document.createElement('div');
      resize.className = 'tv-layout-resize-handle';
      resize.title = 'Resize';
      resize.style.cssText =
        'position:absolute;right:2px;bottom:2px;width:12px;height:12px;z-index:20;background:#388bfd;border-radius:2px;cursor:nwse-resize;opacity:0.85;';

      cell.style.outline = '1px dashed #388bfd';
      cell.appendChild(handle);
      cell.appendChild(resize);

      const onDragDown = (ev: PointerEvent) => {
        ev.preventDefault();
        const p = getPlacement(this.schema, id);
        if (!p) return;
        this.drag = { id, startX: ev.clientX, startY: ev.clientY, origin: { ...p } };
        handle.setPointerCapture(ev.pointerId);
      };
      const onDragMove = (ev: PointerEvent) => {
        if (!this.drag || this.drag.id !== id) return;
        const delta = pixelDeltaToGrid(this.grid, this.schema, ev.clientX - this.drag.startX, ev.clientY - this.drag.startY);
        const next = clampPlacement(
          {
            ...this.drag.origin,
            col: this.drag.origin.col + delta.dCol,
            row: this.drag.origin.row + delta.dRow,
          },
          this.schema,
        );
        updatePlacement(this.schema, next);
        applyPlacementStyle(cell, next);
      };
      const onDragUp = (ev: PointerEvent) => {
        if (!this.drag || this.drag.id !== id) return;
        this.drag = null;
        handle.releasePointerCapture(ev.pointerId);
        this.onChange(cloneLayoutSchema(this.schema));
      };

      const onResizeDown = (ev: PointerEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const p = getPlacement(this.schema, id);
        if (!p) return;
        this.resize = { id, startX: ev.clientX, startY: ev.clientY, origin: { ...p } };
        resize.setPointerCapture(ev.pointerId);
      };
      const onResizeMove = (ev: PointerEvent) => {
        if (!this.resize || this.resize.id !== id) return;
        const delta = pixelDeltaToGrid(this.grid, this.schema, ev.clientX - this.resize.startX, ev.clientY - this.resize.startY);
        const next = clampPlacement(
          {
            ...this.resize.origin,
            colSpan: this.resize.origin.colSpan + delta.dCol,
            rowSpan: this.resize.origin.rowSpan + delta.dRow,
          },
          this.schema,
        );
        updatePlacement(this.schema, next);
        applyPlacementStyle(cell, next);
      };
      const onResizeUp = (ev: PointerEvent) => {
        if (!this.resize || this.resize.id !== id) return;
        this.resize = null;
        resize.releasePointerCapture(ev.pointerId);
        this.onChange(cloneLayoutSchema(this.schema));
      };

      handle.addEventListener('pointerdown', onDragDown);
      handle.addEventListener('pointermove', onDragMove);
      handle.addEventListener('pointerup', onDragUp);
      resize.addEventListener('pointerdown', onResizeDown);
      resize.addEventListener('pointermove', onResizeMove);
      resize.addEventListener('pointerup', onResizeUp);

      this.cleanups.push(() => {
        handle.remove();
        resize.remove();
        cell.style.outline = '';
      });
    }
  }

  private unbind(): void {
    for (const fn of this.cleanups) fn();
    this.cleanups.length = 0;
    this.drag = null;
    this.resize = null;
  }
}

function getPlacement(schema: LayoutSchema, id: LayoutWidgetId): LayoutWidgetPlacement | undefined {
  return schema.widgets.find((w) => w.id === id);
}

function updatePlacement(schema: LayoutSchema, p: LayoutWidgetPlacement): void {
  const i = schema.widgets.findIndex((w) => w.id === p.id);
  if (i >= 0) schema.widgets[i] = p;
}

function clampPlacement(p: LayoutWidgetPlacement, schema: LayoutSchema): LayoutWidgetPlacement {
  const colSpan = Math.max(1, Math.min(schema.columns - p.col, p.colSpan));
  const rowSpan = Math.max(1, Math.min(schema.rows - p.row, p.rowSpan));
  const col = Math.max(0, Math.min(schema.columns - colSpan, p.col));
  const row = Math.max(0, Math.min(schema.rows - rowSpan, p.row));
  return { ...p, col, row, colSpan, rowSpan };
}

function pixelDeltaToGrid(
  grid: HTMLElement,
  schema: LayoutSchema,
  dx: number,
  dy: number,
): { dCol: number; dRow: number } {
  const rect = grid.getBoundingClientRect();
  const cellW = rect.width / schema.columns;
  const cellH = rect.height / schema.rows;
  return {
    dCol: cellW > 0 ? Math.round(dx / cellW) : 0,
    dRow: cellH > 0 ? Math.round(dy / cellH) : 0,
  };
}