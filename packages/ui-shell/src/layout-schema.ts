/** Visual layout schema (grid-based composable shell). */

export type LayoutWidgetId =
  | 'topBar'
  | 'leftToolbar'
  | 'bottomToolbar'
  | 'chartHost'
  | 'indicatorHost'
  | 'statusBar'
  | 'propertiesPanel';

export interface LayoutWidgetPlacement {
  id: LayoutWidgetId;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface LayoutSchema {
  version: 1;
  columns: number;
  rows: number;
  widgets: LayoutWidgetPlacement[];
}

export const LAYOUT_SCHEMA_VERSION = 1 as const;

/** TV-style default when integrator omits `layout` (matches legacy mountChartLayout proportions). */
export const DEFAULT_LAYOUT_SCHEMA: LayoutSchema = {
  version: 1,
  columns: 12,
  rows: 12,
  widgets: [
    { id: 'topBar', col: 0, row: 0, colSpan: 12, rowSpan: 1 },
    { id: 'leftToolbar', col: 0, row: 1, colSpan: 1, rowSpan: 10 },
    { id: 'chartHost', col: 1, row: 1, colSpan: 9, rowSpan: 6 },
    { id: 'indicatorHost', col: 1, row: 7, colSpan: 9, rowSpan: 2 },
    { id: 'statusBar', col: 1, row: 9, colSpan: 9, rowSpan: 1 },
    { id: 'propertiesPanel', col: 10, row: 1, colSpan: 2, rowSpan: 9 },
    { id: 'bottomToolbar', col: 0, row: 11, colSpan: 12, rowSpan: 1 },
  ],
};

export function layoutStorageKey(layoutId: string): string {
  return `tradview:layout:v${LAYOUT_SCHEMA_VERSION}:${layoutId}`;
}

export function resolveLayoutSchema(
  partial?: LayoutSchema | null,
): LayoutSchema {
  if (!partial) return cloneLayoutSchema(DEFAULT_LAYOUT_SCHEMA);
  return normalizeLayoutSchema(partial);
}

export function cloneLayoutSchema(schema: LayoutSchema): LayoutSchema {
  return {
    version: 1,
    columns: schema.columns,
    rows: schema.rows,
    widgets: schema.widgets.map((w) => ({ ...w })),
  };
}

export function normalizeLayoutSchema(input: LayoutSchema): LayoutSchema {
  const columns = Math.max(4, Math.min(24, input.columns || 12));
  const rows = Math.max(4, Math.min(24, input.rows || 12));
  const widgets: LayoutWidgetPlacement[] = [];
  const seen = new Set<LayoutWidgetId>();
  for (const w of input.widgets ?? []) {
    if (!isLayoutWidgetId(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    widgets.push(clampPlacement(w, columns, rows));
  }
  for (const d of DEFAULT_LAYOUT_SCHEMA.widgets) {
    if (!seen.has(d.id)) widgets.push({ ...d });
  }
  return { version: 1, columns, rows, widgets };
}

function clampPlacement(
  w: LayoutWidgetPlacement,
  columns: number,
  rows: number,
): LayoutWidgetPlacement {
  const colSpan = Math.max(1, Math.min(columns, w.colSpan || 1));
  const rowSpan = Math.max(1, Math.min(rows, w.rowSpan || 1));
  const col = Math.max(0, Math.min(columns - colSpan, w.col || 0));
  const row = Math.max(0, Math.min(rows - rowSpan, w.row || 0));
  return { id: w.id, col, row, colSpan, rowSpan };
}

function isLayoutWidgetId(id: string): id is LayoutWidgetId {
  return (
    id === 'topBar' ||
    id === 'leftToolbar' ||
    id === 'bottomToolbar' ||
    id === 'chartHost' ||
    id === 'indicatorHost' ||
    id === 'statusBar' ||
    id === 'propertiesPanel'
  );
}

export function loadLayoutSchema(layoutId: string): LayoutSchema | null {
  try {
    const raw = localStorage.getItem(layoutStorageKey(layoutId));
    if (!raw) return null;
    return normalizeLayoutSchema(JSON.parse(raw) as LayoutSchema);
  } catch {
    return null;
  }
}

export function saveLayoutSchema(layoutId: string, schema: LayoutSchema): void {
  try {
    localStorage.setItem(layoutStorageKey(layoutId), JSON.stringify(normalizeLayoutSchema(schema)));
  } catch {
    /* ignore */
  }
}

export function getWidgetPlacement(
  schema: LayoutSchema,
  id: LayoutWidgetId,
): LayoutWidgetPlacement | undefined {
  return schema.widgets.find((w) => w.id === id);
}