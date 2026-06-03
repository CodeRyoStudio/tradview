import { attachChartContextMenu, type ContextMenuAction } from './context-menu.js';
import { mountCrosshairLegend } from './crosshair-legend.js';
import { mountDrawingPropertiesPanel } from './drawing-properties-panel.js';
import { mountIndicatorPaneHost } from './indicator-pane-host.js';
import { mountStatusBar, type StatusBarOptions } from './status-bar.js';
import { mountTopBar, type TopBarOptions } from './top-bar.js';
import type { SettingsPanelOptions } from './settings-panel.js';

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
  showLeftToolbar?: boolean;
  activeDrawingTool?: DrawingToolId;
  onDrawingToolSelect?: (tool: DrawingToolId) => void;
  statusBar?: StatusBarOptions;
  contextMenuActions?: ContextMenuAction[];
  settings?: SettingsPanelOptions;
  showStatusBar?: boolean;
  showCrosshairLegend?: boolean;
  showPropertiesPanel?: boolean;
  onDrawingStyleChange?: (patch: { color?: string; lineWidth?: number; text?: string }) => void;
  onDrawingSelectionBind?: (bind: (drawing: import('@tradview/drawings').DrawingRecord | null) => void) => void;
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
} {
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

  if (opts.showLeftToolbar !== false) {
    const desktopTools = mountToolButtons(leftAside, activeTool, onToolSelect, 'column');
    setActiveDesktop = desktopTools.setActive;
    body.appendChild(leftAside);

    bottomBar.style.display = 'none';
    bottomBar.style.flexDirection = 'row';
    const mobileTools = mountToolButtons(bottomBar, activeTool, onToolSelect, 'row');
    setActiveMobile = mobileTools.setActive;

    const mq = window.matchMedia(MOBILE_MQ);
    const applyLayout = () => {
      const mobile = mq.matches;
      leftAside.style.display = mobile ? 'none' : 'flex';
      bottomBar.style.display = mobile ? 'flex' : 'none';
    };
    mq.addEventListener('change', applyLayout);
    applyLayout();
  }

  const chartColumn = document.createElement('div');
  chartColumn.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';

  const chartHost = document.createElement('div');
  chartHost.style.cssText = 'flex:1;min-height:0;width:100%;height:100%;position:relative;overflow:hidden;';
  chartColumn.appendChild(chartHost);

  const indicatorHost = mountIndicatorPaneHost(chartColumn);

  const showStatus = opts.showStatusBar ?? false;
  const statusBar = showStatus
    ? mountStatusBar(chartColumn, opts.statusBar ?? {})
    : { el: document.createElement('div'), update: () => {} };

  body.appendChild(chartColumn);

  const propertiesPanel =
    opts.showPropertiesPanel !== false
      ? mountDrawingPropertiesPanel(body, { onStyleChange: opts.onDrawingStyleChange })
      : {
          el: document.createElement('aside'),
          bind: () => {},
        };

  if (opts.showPropertiesPanel === false) {
    propertiesPanel.el.style.display = 'none';
  }

  opts.onDrawingSelectionBind?.(propertiesPanel.bind);

  root.appendChild(body);
  if (opts.showLeftToolbar !== false) {
    root.appendChild(bottomBar);
  }

  const topBar = mountTopBar(root, opts);
  root.insertBefore(topBar, body);

  const crosshairLegend =
    opts.showCrosshairLegend !== false
      ? mountCrosshairLegend(chartHost, { symbol: opts.initialSymbol })
      : {
          el: document.createElement('div'),
          update: () => {},
          setMeta: () => {},
          hide: () => {},
        };

  if (opts.showCrosshairLegend === false) {
    crosshairLegend.el.style.display = 'none';
  }

  const detachContextMenu = attachChartContextMenu(chartHost, {
    actions: opts.contextMenuActions,
  });

  return {
    chartHost,
    indicatorHost,
    topBar,
    statusBar,
    crosshairLegend,
    detachContextMenu,
    setActiveDrawingTool,
    propertiesPanel,
  };
}