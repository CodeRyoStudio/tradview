/** Placeholder host for MACD/RSI/KDJ panes (wired in PR-11). */
export function mountIndicatorPaneHost(parent: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  host.dataset.tradviewIndicatorHost = '1';
  host.style.cssText =
    'display:none;flex:2;min-height:0;border-top:1px solid #30363d;background:#0d1117;';
  parent.appendChild(host);
  return host;
}