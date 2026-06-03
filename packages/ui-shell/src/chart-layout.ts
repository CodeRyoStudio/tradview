import { attachChartContextMenu, type ContextMenuAction } from './context-menu.js';
import { mountCrosshairLegend } from './crosshair-legend.js';
import { mountDrawingPropertiesPanel } from './drawing-properties-panel.js';
import { mountIndicatorPaneHost } from './indicator-pane-host.js';
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
  symbolInput?: 'manual' | 'search' | 'none';
  onDrawingStyleChange?: (patch: { color?: string; lineWidth?: number; text?: string }) => void;
  onDrawingSelectionBind?: (bind: (drawing: import('@coderyo/drawings').DrawingRecord | null) => void) => void;
}

function mountToolButtons(
  parent: HTMLElement,
  activeTool: DrawingToolId,
  onSelect: (tool: DrawingToolId) => void,
  layout: 'column' | 'row',
): { setActive: (tool: DrawingToolId) => void } {
  const btnStyle =
    layout === 'column'
      ? 'width:36px;height:32px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:14px;'
      : 'min-width:40px;height:36px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:14px;padding:0 8px;';
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
  chartHost: HTMLElement;
  indicatorHost: HTMLElement;
  topBar: HTMLElement;
  statusBar: ReturnType<typeof mountStatusBar>;
  crosshairLegend: ReturnType<typeof mountCrosshairLegend>;
  detachContextMenu: () => void;
  setActiveDrawingTool: (tool: DrawingToolId) => void;
  propertiesPanel: ReturnType<typeof mountDrawingPropertiesPanel>;
  setLayoutFeatures: (patch: LayoutFeatures) => void;
  getLayoutFeatures: () => ResolvedLayoutFeatures;
} {
  let layoutFeatures = resolveLayoutFeatures(opts);

  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.height = '100%';
  root.style.background = '#0d1117';

  let activeTool: DrawingToolId = opts.activeDrawingTool ?? 'cursor';
  let setActiveDesktop: ((t: DrawingToolId) => void) | null = null;
  let setActiveMobile: ((t: DrawingToolId) => void) | null = null;

  const setActiveDrawingTool = (tool: DrawingToolId) => {
    activeTool = tool;
    setActiveDesktop?.(tool);
    setActiveMobile?.(tool);
  };

  const onToolSelect = (tool: DrawingToolId) => {
    setActiveDrawingTool(tool);
    opts.onDrawingToolSelect?.(tool);
  };

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex:1;min-height:0;';

  const leftAside = document.createElement('aside');
  leftAside.style.cssText =
    'width:48px;border-right:1px solid #30363d;background:#161b22;display:flex;flex-direction:column;align-items:center;padding:8px 4px;gap:8px;flex-shrink:0;z-index:20;';

  const bottomBar = document.createElement('div');
  bottomBar.style.cssText =
    'display:none;flex-shrink:0;gap:6px;padding:6px 8px;border-top:1px solid #30363d;background:#161b22;overflow-x:auto;';

  const chartColumn = document.createElement('div');
  chartColumn.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';

  const chartHost = document.createElement('div');
  chartHost.style.cssText = 'flex:1;min-height:0;width:100%;height:100%;position:relative;overflow:hidden;';
  chartColumn.appendChild(chartHost);

  const indicatorHost = mountIndicatorPaneHost(chartColumn);

  const statusBar = mountStatusBar(chartColumn, opts.statusBar ?? {});

  body.appendChild(chartColumn);

  const propertiesPanel = mountDrawingPropertiesPanel(body, {
    onStyleChange: opts.onDrawingStyleChange,
  });

  opts.onDrawingSelectionBind?.(propertiesPanel.bind);

  root.appendChild(body);
  root.appendChild(bottomBar);

  let topBar: HTMLElement = document.createElement('div');
  topBar.style.display = 'none';
  root.insertBefore(topBar, body);

  const crosshairLegend = mountCrosshairLegend(chartHost, { symbol: opts.initialSymbol });

  let detachContextMenu = () => {};
  let shortcutsBound = false;

  const mountLeftToolbar = () => {
    if (leftAside.parentElement) return;
    const desktopTools = mountToolButtons(leftAside, activeTool, onToolSelect, 'column');
    setActiveDesktop = desktopTools.setActive;
    body.insertBefore(leftAside, chartColumn);

    bottomBar.style.flexDirection = 'row';
    const mobileTools = mountToolButtons(bottomBar, activeTool, onToolSelect, 'row');
    setActiveMobile = mobileTools.setActive;

    const mq = window.matchMedia(MOBILE_MQ);
    const applyLayout = () => {
      const mobile = mq.matches;
      leftAside.style.display = mobile ? 'none' : 'flex';
      const showBottom = layoutFeatures.showBottomToolbar !== false;
      bottomBar.style.display = mobile && showBottom ? 'flex' : 'none';
    };
    mq.addEventListener('change', applyLayout);
    applyLayout();
  };

  const unmountLeftToolbar = () => {
    leftAside.remove();
    bottomBar.innerHTML = '';
    setActiveDesktop = null;
    setActiveMobile = null;
  };

  const applyLayoutFeatures = () => {
    const f = layoutFeatures;

    if (f.showTopBar) {
      topBar.remove();
      // Mutate opts in place so late-assigned callbacks (e.g. onIntervalChange) stay wired.
      topBar = mountTopBar(
        root,
        Object.assign(opts, {
          symbolInput: f.symbolInput,
          showSettings: f.showSettings,
        }),
      );
    } else {
      topBar.style.display = 'none';
    }

    if (f.showLeftToolbar) mountLeftToolbar();
    else unmountLeftToolbar();

    crosshairLegend.el.style.display = f.showCrosshairLegend ? '' : 'none';
    statusBar.el.style.display = f.showStatusBar ? '' : 'none';
    propertiesPanel.el.style.display = f.showPropertiesPanel ? '' : 'none';

    detachContextMenu();
    if (f.showContextMenu) {
      detachContextMenu = attachChartContextMenu(chartHost, {
        actions: opts.contextMenuActions,
      });
    }

    if (f.showShortcuts && !shortcutsBound) {
      bindShortcutsModal();
      shortcutsBound = true;
    }
  };

  applyLayoutFeatures();

  return {
    chartHost,
    indicatorHost,
    topBar,
    statusBar,
    crosshairLegend,
    detachContextMenu,
    setActiveDrawingTool,
    propertiesPanel,
    setLayoutFeatures: (patch) => {
      layoutFeatures = mergeLayoutFeatures(layoutFeatures, patch);
      applyLayoutFeatures();
    },
    getLayoutFeatures: () => ({ ...layoutFeatures }),
  };
}