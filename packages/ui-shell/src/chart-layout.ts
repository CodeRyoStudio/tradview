import { mountTopBar, type TopBarOptions } from './top-bar.js';

export interface ChartLayoutOptions extends TopBarOptions {
  showLeftToolbar?: boolean;
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
    left.innerHTML = '<span style="color:#8b949e;font-size:18px">✛</span>';
    body.appendChild(left);
  }

  const chartHost = document.createElement('div');
  chartHost.style.flex = '1';
  chartHost.style.minHeight = '0';
  body.appendChild(chartHost);

  root.appendChild(body);
  const topBar = mountTopBar(root, opts);
  root.insertBefore(topBar, body);

  return { chartHost, topBar };
}