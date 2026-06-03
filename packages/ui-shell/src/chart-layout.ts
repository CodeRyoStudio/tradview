import { mountIndicatorPaneHost } from './indicator-pane-host.js';
import { mountTopBar, type TopBarOptions } from './top-bar.js';

export type DrawingToolId = 'cursor' | 'trendline' | 'hline';

export interface ChartLayoutOptions extends TopBarOptions {
  showLeftToolbar?: boolean;
  activeDrawingTool?: DrawingToolId;
  onDrawingToolSelect?: (tool: DrawingToolId) => void;
}

export function mountChartLayout(root: HTMLElement, opts: ChartLayoutOptions = {}): {
  chartHost: HTMLElement;
  topBar: HTMLElement;
} {
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.height = '100%';
  root.style.background = '#0d1117';

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex:1;min-height:0;';

  if (opts.showLeftToolbar) {
    const left = document.createElement('aside');
    left.style.cssText =
      'width:48px;border-right:1px solid #30363d;background:#161b22;display:flex;flex-direction:column;align-items:center;padding:8px 4px;gap:8px;';
    const tools: Array<{ id: DrawingToolId; label: string }> = [
      { id: 'cursor', label: '↖' },
      { id: 'trendline', label: '╱' },
      { id: 'hline', label: '─' },
    ];
    const btnStyle =
      'width:36px;height:32px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:14px;';
    const activeStyle =
      'width:36px;height:32px;background:#388bfd;color:#fff;border:1px solid #58a6ff;border-radius:4px;cursor:pointer;font-size:14px;';
    for (const tool of tools) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = tool.id;
      btn.textContent = tool.label;
      btn.style.cssText = opts.activeDrawingTool === tool.id ? activeStyle : btnStyle;
      btn.onclick = () => opts.onDrawingToolSelect?.(tool.id);
      left.appendChild(btn);
    }
    body.appendChild(left);
  }

  const chartColumn = document.createElement('div');
  chartColumn.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';

  const chartHost = document.createElement('div');
  chartHost.style.cssText = 'flex:1;min-height:0;width:100%;height:100%;position:relative;overflow:hidden;';
  chartColumn.appendChild(chartHost);
  mountIndicatorPaneHost(chartColumn);
  body.appendChild(chartColumn);

  root.appendChild(body);
  const topBar = mountTopBar(root, opts);
  root.insertBefore(topBar, body);

  return { chartHost, topBar };
}