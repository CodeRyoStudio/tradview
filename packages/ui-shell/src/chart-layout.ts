import { t } from '@coderyo/i18n';
import { attachChartContextMenu, type ContextMenuAction } from './context-menu.js';
import { mountCrosshairLegend } from './crosshair-legend.js';
import { mountDrawingPropertiesPanel } from './drawing-properties-panel.js';
import { mountIndicatorPaneHost } from './indicator-pane-host.js';
import { ERR_MSG_MOUNT_REQUIRES_COMPOSITOR } from './layout-deprecation.js';
import { createCompositorShell } from './layer/compositor-shell.js';
import { syncCompositorShellVisibilityFromFeatures } from './layer/compositor-shell-sync.js';
import {
  mergeLayoutFeatures,
  resolveLayoutFeatures,
  type LayoutFeatures,
  type ResolvedLayoutFeatures,
} from './layout-features.js';
import { mountStatusBar, type StatusBarOptions } from './status-bar.js';
import { mountTopBar, type TopBarOptions } from './top-bar.js';
import type { SettingsPanelOptions } from './settings-panel.js';
import { bindShortcutsModal } from './shortcuts-modal.js';
import { createI18nProvider, type I18nProvider } from './i18n-provider.js';
import { createThemeProvider, type ThemeProvider } from './theme-provider.js';

export type { LayoutFeatures, ResolvedLayoutFeatures } from './layout-features.js';
export { resolveLayoutFeatures, DEFAULT_LAYOUT_FEATURES, createDemoLayoutOptions } from './layout-features.js';

export type DrawingToolId =
  | 'cursor'
  | 'trendline'
  | 'hline'
  | 'vline'
  | 'rectangle'
  | 'fibonacci'
  | 'text';

const DRAWING_TOOLS: Array<{ id: DrawingToolId; label: string }> = [
  { id: 'cursor', label: '↖' },
  { id: 'trendline', label: '╱' },
  { id: 'hline', label: '─' },
  { id: 'vline', label: '│' },
  { id: 'rectangle', label: '▭' },
  { id: 'fibonacci', label: 'φ' },
  { id: 'text', label: 'T' },
];

const MOBILE_MQ = '(max-width: 768px)';

export interface ChartLayoutOptions extends TopBarOptions {
  themeProvider?: ThemeProvider;
  i18n?: I18nProvider;
  /** When false, do not auto-create theme provider / localStorage (default true). */
  autoThemeProvider?: boolean;
  /** When false, do not auto-create i18n provider (default true). */
  autoI18n?: boolean;
  showTopBar?: boolean;
  showLeftToolbar?: boolean;
  showBottomToolbar?: boolean;
  activeDrawingTool?: DrawingToolId;
  onDrawingToolSelect?: (tool: DrawingToolId) => void;
  statusBar?: StatusBarOptions;
  contextMenuActions?: ContextMenuAction[];
  settings?: SettingsPanelOptions;
  showStatusBar?: boolean;
  showCrosshairLegend?: boolean;
  showPropertiesPanel?: boolean;
  showContextMenu?: boolean;
  showSettings?: boolean;
  showShortcuts?: boolean;
  symbolInput?: 'manual' | 'search' | 'dialog' | 'none';
  onDrawingStyleChange?: (patch: { color?: string; lineWidth?: number; text?: string }) => void;
  onDrawingSelectionBind?: (bind: (drawing: import('@coderyo/drawings').DrawingRecord | null) => void) => void;
  /**
   * Must be `true` @ 2.0.0-rc.2+ (v1 12×12 grid removed). Use `mountLayerCompositor` + `LayoutPreset`.
   * @see docs/MIGRATION-2.0.md §5
   */
  layerCompositorManaged?: boolean;
}

function mountToolButtons(
  parent: HTMLElement,
  activeTool: DrawingToolId,
  onSelect: (tool: DrawingToolId) => void,
  layout: 'column' | 'row',
): { setActive: (tool: DrawingToolId) => void } {
  const btnStyle =
    layout === 'column'
      ? 'width:32px;height:28px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:13px;padding:0;'
      : 'min-width:36px;height:32px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:13px;padding:0 6px;';
  const activeStyle = btnStyle.replace('#21262d', '#388bfd').replace('#e6edf3', '#fff');

  const buttons = new Map<DrawingToolId, HTMLButtonElement>();
  for (const tool of DRAWING_TOOLS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = tool.id;
    btn.textContent = tool.label;
    btn.style.cssText = activeTool === tool.id ? activeStyle : btnStyle;
    btn.onclick = () => onSelect(tool.id);
    buttons.set(tool.id, btn);
    parent.appendChild(btn);
  }

  return {
    setActive: (tool) => {
      for (const [id, btn] of buttons) {
        btn.style.cssText = id === tool ? activeStyle : btnStyle;
      }
    },
  };
}

export function mountChartLayout(root: HTMLElement, opts: ChartLayoutOptions = {}): {
  layoutRoot: HTMLElement;
  /** Compositor shell grid element (legacy property name `layoutGrid`; not v1 12×12 grid). */
  layoutGrid: HTMLElement;
  /** @deprecated Alias of chartMain — use chartMain for LWC mount. */
  chartHost: HTMLElement;
  chartMain: HTMLElement;
  chartVolume: HTMLElement;
  /** Drawing canvas host (same element as chartMain when compositor-managed). */
  drawingOverlay: HTMLElement;
  indicatorHost: HTMLElement;
  topBar: HTMLElement;
  setActiveInterval: (interval: import('@coderyo/data').Interval) => void;
  statusBar: ReturnType<typeof mountStatusBar>;
  crosshairLegend: ReturnType<typeof mountCrosshairLegend>;
  detachContextMenu: () => void;
  setActiveDrawingTool: (tool: DrawingToolId) => void;
  propertiesPanel: ReturnType<typeof mountDrawingPropertiesPanel>;
  /** Bind drawing + apply properties panel visibility (compositor-safe). */
  handleDrawingSelection: (drawing: import('@coderyo/drawings').DrawingRecord | null) => void;
  /** Sync showCrosshairLegend (etc.) to compositor layer.visible when layerCompositorManaged. */
  syncCompositorShellVisibility?: (
    controller: import('./layer/layer-controller.js').LayerController,
  ) => void;
  /**
   * Bind compositor controller so `setLayoutFeatures` keeps shell/legend layer.visible in sync.
   * Call once after `mountLayerCompositor` (Playground pattern).
   */
  bindLayerCompositorController?: (
    controller: import('./layer/layer-controller.js').LayerController,
  ) => void;
  setLayoutFeatures: (patch: LayoutFeatures) => void;
  getLayoutFeatures: () => ResolvedLayoutFeatures;
} {
  if (opts.layerCompositorManaged !== true) {
    throw new Error(ERR_MSG_MOUNT_REQUIRES_COMPOSITOR);
  }

  let layoutFeatures = resolveLayoutFeatures(opts);

  root.replaceChildren();
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.height = root.style.height || '100%';
  root.style.width = root.style.width || '100%';
  root.style.minWidth = '0';
  root.style.boxSizing = 'border-box';
  root.style.overflow = 'hidden';

  const useAutoTheme = opts.autoThemeProvider !== false;
  const useAutoI18n = opts.autoI18n !== false;
  const themeProvider =
    opts.themeProvider ?? (useAutoTheme ? createThemeProvider() : undefined);
  const i18nProvider = opts.i18n ?? (useAutoI18n ? createI18nProvider() : undefined);

  themeProvider?.subscribe((theme) => {
    root.style.background = theme === 'dark' ? '#0d1117' : '#f6f8fa';
  });

  let activeTool: DrawingToolId = opts.activeDrawingTool ?? 'cursor';
  let setActiveDesktop: ((t: DrawingToolId) => void) | null = null;
  let setActiveMobile: ((t: DrawingToolId) => void) | null = null;
  let lastSelectedDrawing: import('@coderyo/drawings').DrawingRecord | null = null;

  const setActiveDrawingTool = (tool: DrawingToolId) => {
    activeTool = tool;
    setActiveDesktop?.(tool);
    setActiveMobile?.(tool);
  };

  const onToolSelect = (tool: DrawingToolId) => {
    setActiveDrawingTool(tool);
    opts.onDrawingToolSelect?.(tool);
  };

  const topBarHost = document.createElement('div');
  topBarHost.className = 'tv-layout-header';
  topBarHost.style.cssText = 'width:100%;min-width:0;overflow:visible;position:relative;z-index:30;';

  const leftToolbar = document.createElement('aside');
  leftToolbar.style.cssText =
    'width:100%;height:100%;max-width:44px;border-right:1px solid #30363d;background:#161b22;display:flex;flex-direction:column;align-items:center;padding:4px 2px;gap:4px;box-sizing:border-box;overflow:hidden;';

  const bottomToolbar = document.createElement('div');
  bottomToolbar.style.cssText =
    'width:100%;height:100%;gap:6px;padding:6px 8px;border-top:1px solid #30363d;background:#161b22;overflow-x:auto;box-sizing:border-box;display:flex;flex-direction:row;';

  const chartMain = document.createElement('div');
  chartMain.className = 'tv-chart-main-mount';
  chartMain.style.cssText =
    'width:100%;height:100%;min-height:120px;position:relative;overflow:hidden;box-sizing:border-box;';

  const chartVolume = document.createElement('div');
  chartVolume.className = 'tv-chart-volume-mount';
  chartVolume.style.cssText =
    'width:100%;height:100%;min-height:48px;position:relative;overflow:hidden;box-sizing:border-box;';

  /** Legacy grid cell only; with LayerCompositor use chartMain/chartVolume mounts (not chartHost). */
  const chartHost = document.createElement('div');
  chartHost.className = 'tv-chart-grid-anchor';
  chartHost.style.cssText =
    'width:100%;height:100%;min-height:0;position:relative;overflow:hidden;box-sizing:border-box;';

  const indicatorMount = document.createElement('div');
  indicatorMount.style.cssText = 'width:100%;height:100%;min-height:0;display:flex;flex-direction:column;';
  const indicatorHost = mountIndicatorPaneHost(indicatorMount);
  indicatorHost.style.flex = '1';

  const statusMount = document.createElement('div');
  statusMount.style.cssText = 'width:100%;height:100%;';
  const statusBar = mountStatusBar(statusMount, opts.statusBar ?? {});

  const propertiesMount = document.createElement('div');
  propertiesMount.style.cssText = 'width:100%;height:100%;min-height:0;';
  const propertiesPanel = mountDrawingPropertiesPanel(propertiesMount, {
    onStyleChange: opts.onDrawingStyleChange,
  });

  const drawingOverlay = chartMain;

  const layoutShell = createCompositorShell({
    widgets: {
      topBar: topBarHost,
      leftToolbar,
      bottomToolbar,
      chartHost,
      indicatorHost: indicatorMount,
      statusBar: statusMount,
      propertiesPanel: propertiesMount,
    },
  });

  root.appendChild(layoutShell.root);

  let topBar: HTMLElement = topBarHost;
  let setActiveInterval: (interval: import('@coderyo/data').Interval) => void = () => {};
  const crosshairLegend = mountCrosshairLegend(undefined, { symbol: opts.initialSymbol });

  let detachContextMenu = () => {};
  let shortcutsBound = false;
  let disposeMobileMq: (() => void) | null = null;

  const mountToolbarActions = (parent: HTMLElement, compact: boolean) => {
    const settings = opts.settings;
    if (!settings?.onClearAllDrawings && !settings?.onClearAllIndicators) return;
    const spacer = document.createElement('div');
    spacer.style.flex = compact ? '1' : '0';
    spacer.style.minHeight = compact ? '4px' : '0';
    parent.appendChild(spacer);
    const mk = (label: string, fn?: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = label;
      b.textContent = compact
        ? label === t('toolbar.clearDrawings', '清除繪圖')
          ? '⌧'
          : '∅'
        : label;
      b.style.cssText = compact
        ? 'width:32px;height:24px;font-size:10px;background:#21262d;color:#f85149;border:1px solid #30363d;border-radius:4px;cursor:pointer;'
        : 'min-width:36px;height:28px;font-size:10px;background:#21262d;color:#f85149;border:1px solid #30363d;border-radius:4px;cursor:pointer;padding:0 4px;';
      b.onclick = () => fn?.();
      return b;
    };
    if (settings.onClearAllDrawings) {
      parent.appendChild(mk(t('toolbar.clearDrawings', '清除繪圖'), settings.onClearAllDrawings));
    }
    if (settings.onClearAllIndicators) {
      parent.appendChild(mk(t('toolbar.clearIndicators', '清除指標'), settings.onClearAllIndicators));
    }
  };

  const mountLeftToolbar = () => {
    leftToolbar.replaceChildren();
    const desktopTools = mountToolButtons(leftToolbar, activeTool, onToolSelect, 'column');
    setActiveDesktop = desktopTools.setActive;
    mountToolbarActions(leftToolbar, true);

    bottomToolbar.replaceChildren();
    const mobileTools = mountToolButtons(bottomToolbar, activeTool, onToolSelect, 'row');
    setActiveMobile = mobileTools.setActive;
    mountToolbarActions(bottomToolbar, false);
  };

  const applyPropertiesPanelLayout = (drawing: import('@coderyo/drawings').DrawingRecord | null) => {
    const showPanel = layoutFeatures.showPropertiesPanel && drawing != null;
    propertiesPanel.el.style.display = showPanel ? 'block' : 'none';
  };

  const applyLayoutFeatures = () => {
    const f = layoutFeatures;

    if (f.showTopBar) {
      topBarHost.replaceChildren();
      const mounted = mountTopBar(
        topBarHost,
        Object.assign(opts, {
          symbolInput: f.symbolInput,
          showSettings: f.showSettings,
          themeProvider: opts.themeProvider ?? themeProvider,
          i18n: opts.i18n ?? i18nProvider,
          onThemeChange: (theme: 'dark' | 'light') => {
            opts.onThemeChange?.(theme);
            if (!opts.onThemeChange) opts.onThemeToggle?.();
          },
        }),
      );
      topBar = mounted.el;
      setActiveInterval = mounted.setActiveInterval;
    } else {
      topBarHost.replaceChildren();
      topBar = topBarHost;
    }

    if (f.showLeftToolbar || f.showBottomToolbar) mountLeftToolbar();
    else {
      leftToolbar.replaceChildren();
      bottomToolbar.replaceChildren();
      setActiveDesktop = null;
      setActiveMobile = null;
    }

    disposeMobileMq?.();
    const mq = window.matchMedia(MOBILE_MQ);
    const applyMobileTools = () => {
      const features = layoutFeatures;
      const mobile = mq.matches;
      if (features.showLeftToolbar) {
        leftToolbar.style.display = mobile ? 'none' : 'flex';
      }
      if (features.showBottomToolbar) {
        bottomToolbar.style.display = mobile ? 'flex' : 'none';
        const bottomCell = layoutShell.cells.get('bottomToolbar');
        if (bottomCell) {
          bottomCell.style.display = mobile && features.showBottomToolbar ? '' : 'none';
        }
      }
    };
    mq.addEventListener('change', applyMobileTools);
    disposeMobileMq = () => mq.removeEventListener('change', applyMobileTools);
    applyMobileTools();

    detachContextMenu();
    if (f.showContextMenu) {
      detachContextMenu = attachChartContextMenu(chartMain, {
        actions: opts.contextMenuActions,
      });
    }

    if (f.showShortcuts && !shortcutsBound) {
      bindShortcutsModal();
      shortcutsBound = true;
    }

    applyPropertiesPanelLayout(lastSelectedDrawing);
  };

  const handleDrawingSelection = (drawing: import('@coderyo/drawings').DrawingRecord | null) => {
    lastSelectedDrawing = drawing;
    propertiesPanel.bind(drawing);
    applyPropertiesPanelLayout(drawing);
  };

  opts.onDrawingSelectionBind?.(propertiesPanel.bind);
  applyLayoutFeatures();
  applyPropertiesPanelLayout(null);

  let boundCompositorController: import('./layer/layer-controller.js').LayerController | null =
    null;

  const syncCompositorShellVisibility = (
    controller: import('./layer/layer-controller.js').LayerController,
  ) => {
    syncCompositorShellVisibilityFromFeatures(controller, layoutFeatures);
  };

  const syncCompositorShellVisibilityIfBound = () => {
    if (boundCompositorController) {
      syncCompositorShellVisibilityFromFeatures(boundCompositorController, layoutFeatures);
    }
  };

  const bindLayerCompositorController = (
    controller: import('./layer/layer-controller.js').LayerController,
  ) => {
    boundCompositorController = controller;
    syncCompositorShellVisibilityFromFeatures(controller, layoutFeatures);
  };

  return {
    layoutRoot: layoutShell.root,
    layoutGrid: layoutShell.grid,
    chartHost: chartMain,
    chartMain,
    chartVolume,
    drawingOverlay,
    indicatorHost,
    topBar,
    setActiveInterval,
    statusBar,
    crosshairLegend,
    detachContextMenu,
    setActiveDrawingTool,
    propertiesPanel,
    handleDrawingSelection,
    syncCompositorShellVisibility,
    bindLayerCompositorController,
    setLayoutFeatures: (patch) => {
      layoutFeatures = mergeLayoutFeatures(layoutFeatures, patch);
      applyLayoutFeatures();
      syncCompositorShellVisibilityIfBound();
    },
    getLayoutFeatures: () => ({ ...layoutFeatures }),
  };
}