import { attachChartContextMenu, type ContextMenuAction } from './context-menu.js';
import { mountCrosshairLegend } from './crosshair-legend.js';
import { mountIndicatorPaneHost } from './indicator-pane-host.js';
import { mountStatusBar, type StatusBarOptions } from './status-bar.js';
import { mountTopBar, type TopBarOptions } from './top-bar.js';

export type DrawingToolId =
  | 'cursor'
  | 'trendline'
  | 'hline'
  | 'vline'
  | 'rectangle'
  | 'fibonacci'
  | 'text';

export interface ChartLayoutOptions extends TopBarOptions {
  showLeftToolbar?: boolean;
  activeDrawingTool?: DrawingToolId;
  onDrawingToolSelect?: (tool: DrawingToolId) => void;
  statusBar?: StatusBarOptions;
  contextMenuActions?: ContextMenuAction[];
}

export function mountChartLayout(root: HTMLElement, opts: ChartLayoutOptions = {}): {
  chartHost: HTMLElement;
  indicatorHost: HTMLElement;
  topBar: HTMLElement;
  statusBar: ReturnType<typeof mountStatusBar>;
  crosshairLegend: ReturnType<typeof mountCrosshairLegend>;
  detachContextMenu: () => void;
  setActiveDrawingTool: (tool: DrawingToolId) => void;
} {
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.height = '100%';
  root.style.background = '#0d1117';

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex:1;min-height:0;';

  let activeTool: DrawingToolId = opts.activeDrawingTool ?? 'cursor';
  const toolButtons = new Map<DrawingToolId, HTMLButtonElement>();
  const btnStyle =
    'width:36px;height:32px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:14px;';
  const activeStyle =
    'width:36px;height:32px;background:#388bfd;color:#fff;border:1px solid #58a6ff;border-radius:4px;cursor:pointer;font-size:14px;';

  const setActiveDrawingTool = (tool: DrawingToolId) => {
    activeTool = tool;
    for (const [id, btn] of toolButtons) {
      btn.style.cssText = id === tool ? activeStyle : btnStyle;
    }
  };

  if (opts.showLeftToolbar) {
    const left = document.createElement('aside');
    left.style.cssText =
      'width:48px;border-right:1px solid #30363d;background:#161b22;display:flex;flex-direction:column;align-items:center;padding:8px 4px;gap:8px;flex-shrink:0;z-index:20;';
    const tools: Array<{ id: DrawingToolId; label: string }> = [
      { id: 'cursor', label: '↖' },
      { id: 'trendline', label: '╱' },
      { id: 'hline', label: '─' },
      { id: 'vline', label: '│' },
      { id: 'rectangle', label: '▭' },
      { id: 'fibonacci', label: 'φ' },
      { id: 'text', label: 'T' },
    ];
    for (const tool of tools) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = tool.id;
      btn.textContent = tool.label;
      btn.style.cssText = activeTool === tool.id ? activeStyle : btnStyle;
      btn.onclick = () => {
        setActiveDrawingTool(tool.id);
        opts.onDrawingToolSelect?.(tool.id);
      };
      toolButtons.set(tool.id, btn);
      left.appendChild(btn);
    }
    body.appendChild(left);
  }

  const chartColumn = document.createElement('div');
  chartColumn.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';

  const chartHost = document.createElement('div');
  chartHost.style.cssText = 'flex:1;min-height:0;width:100%;height:100%;position:relative;overflow:hidden;';
  chartColumn.appendChild(chartHost);
  const indicatorHost = mountIndicatorPaneHost(chartColumn);
  const statusBar = mountStatusBar(chartColumn, opts.statusBar ?? {});
  body.appendChild(chartColumn);

  root.appendChild(body);
  const topBar = mountTopBar(root, opts);
  root.insertBefore(topBar, body);

  const crosshairLegend = mountCrosshairLegend(chartHost, {
    symbol: opts.initialSymbol,
  });
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
  };
}