/** LayoutPreset v2 — free-floating layer compositor (replaces layout-schema v1). */

export const LAYER_PRESET_VERSION = 2 as const;

export type LayerPresetAuthor = 'integrator' | 'user';

export type LayerType =
  | 'shell.topBar'
  | 'shell.leftToolbar'
  | 'shell.bottomToolbar'
  | 'shell.statusBar'
  | 'shell.propertiesPanel'
  | 'chart.host'
  | 'chart.main'
  | 'chart.volume'
  | 'chart.indicator'
  | 'chart.indicatorHost'
  | 'overlay.crosshairLegend'
  | 'overlay.drawing'
  | 'group';

/** Normalized frame relative to page root (0..1). */
export interface LayerFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutPage {
  id: string;
  title: string;
}

export interface LayerNode {
  id: string;
  pageId: string;
  type: LayerType;
  /** Maps to legacy widget id or chart role for mount. */
  widgetKey: string;
  frame: LayerFrame;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  groupId?: string;
  /**
   * @public Time-scale sync group for chart panes. Same non-empty id → pan/zoom together;
   * omit or empty → pane is independent (own TimeScaleBus).
   */
  syncTimeScaleGroupId?: string;
}

export interface BindGroup {
  id: string;
  name?: string;
  layerIds: string[];
}

export interface LayoutPreset {
  version: typeof LAYER_PRESET_VERSION;
  id: string;
  name: string;
  author: LayerPresetAuthor;
  readonly?: boolean;
  forkedFrom?: string;
  pages: LayoutPage[];
  layers: LayerNode[];
  groups: BindGroup[];
}

export type LayerWidgetKey =
  | 'topBar'
  | 'leftToolbar'
  | 'bottomToolbar'
  | 'chartHost'
  | 'chartMain'
  | 'chartVolume'
  | 'chartIndicator'
  | 'indicatorHost'
  | 'statusBar'
  | 'propertiesPanel'
  | 'crosshairLegend'
  | 'drawingOverlay';