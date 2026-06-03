import type { ChartLayoutOptions } from './chart-layout.js';

export interface LayoutFeatures {
  showTopBar?: boolean;
  showLeftToolbar?: boolean;
  showBottomToolbar?: boolean;
  showCrosshairLegend?: boolean;
  showStatusBar?: boolean;
  showPropertiesPanel?: boolean;
  showContextMenu?: boolean;
  showSettings?: boolean;
  showShortcuts?: boolean;
  /** When TopBar is on and no search API: manual symbol input (default). */
  symbolInput?: 'manual' | 'search' | 'none';
}

export interface ResolvedLayoutFeatures {
  showTopBar: boolean;
  showLeftToolbar: boolean;
  showBottomToolbar: boolean;
  showCrosshairLegend: boolean;
  showStatusBar: boolean;
  showPropertiesPanel: boolean;
  showContextMenu: boolean;
  showSettings: boolean;
  showShortcuts: boolean;
  symbolInput: 'manual' | 'search' | 'none';
}

export const DEFAULT_LAYOUT_FEATURES: ResolvedLayoutFeatures = {
  showTopBar: false,
  showLeftToolbar: false,
  showBottomToolbar: false,
  showCrosshairLegend: false,
  showStatusBar: false,
  showPropertiesPanel: false,
  showContextMenu: false,
  showSettings: false,
  showShortcuts: false,
  symbolInput: 'manual',
};

export function resolveLayoutFeatures(
  opts: ChartLayoutOptions = {},
): ResolvedLayoutFeatures {
  const d = DEFAULT_LAYOUT_FEATURES;
  const top = opts.showTopBar ?? d.showTopBar;
  return {
    showTopBar: top,
    showLeftToolbar: opts.showLeftToolbar ?? d.showLeftToolbar,
    showBottomToolbar: opts.showBottomToolbar ?? d.showBottomToolbar,
    showCrosshairLegend: opts.showCrosshairLegend ?? d.showCrosshairLegend,
    showStatusBar: opts.showStatusBar ?? d.showStatusBar,
    showPropertiesPanel: opts.showPropertiesPanel ?? d.showPropertiesPanel,
    showContextMenu: opts.showContextMenu ?? d.showContextMenu,
    showSettings: opts.settings !== undefined ? (opts.showSettings ?? true) : (opts.showSettings ?? d.showSettings),
    showShortcuts: opts.showShortcuts ?? d.showShortcuts,
    symbolInput: opts.symbolInput ?? (opts.onSymbolSearch ? 'search' : d.symbolInput),
  };
}

export function mergeLayoutFeatures(
  current: ResolvedLayoutFeatures,
  patch: LayoutFeatures,
): ResolvedLayoutFeatures {
  return resolveLayoutFeatures({
    showTopBar: patch.showTopBar ?? current.showTopBar,
    showLeftToolbar: patch.showLeftToolbar ?? current.showLeftToolbar,
    showBottomToolbar: patch.showBottomToolbar ?? current.showBottomToolbar,
    showCrosshairLegend: patch.showCrosshairLegend ?? current.showCrosshairLegend,
    showStatusBar: patch.showStatusBar ?? current.showStatusBar,
    showPropertiesPanel: patch.showPropertiesPanel ?? current.showPropertiesPanel,
    showContextMenu: patch.showContextMenu ?? current.showContextMenu,
    showSettings: patch.showSettings ?? current.showSettings,
    showShortcuts: patch.showShortcuts ?? current.showShortcuts,
    symbolInput: patch.symbolInput ?? current.symbolInput,
  });
}

/** Playground: enable full TV shell. */
export function createDemoLayoutOptions(
  partial: ChartLayoutOptions = {},
): ChartLayoutOptions {
  return {
    ...partial,
    showTopBar: partial.showTopBar ?? true,
    showLeftToolbar: partial.showLeftToolbar ?? true,
    showCrosshairLegend: partial.showCrosshairLegend ?? true,
    showStatusBar: partial.showStatusBar ?? true,
    showPropertiesPanel: partial.showPropertiesPanel ?? true,
    showContextMenu: partial.showContextMenu ?? true,
    showSettings: partial.showSettings ?? true,
    showShortcuts: partial.showShortcuts ?? true,
    showBottomToolbar: partial.showBottomToolbar ?? true,
    symbolInput: partial.symbolInput ?? (partial.onSymbolSearch ? 'search' : 'manual'),
  };
}