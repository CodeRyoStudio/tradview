/** Host for MACD / RSI / KDJ indicator panes (PR-11). */
export function mountIndicatorPaneHost(parent: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  host.dataset.tradviewIndicatorHost = '1';
  host.style.cssText =
    'display:flex;flex-direction:column;flex:2;min-height:120px;border-top:1px solid #30363d;background:#0d1117;overflow:hidden;';
  parent.appendChild(host);
  return host;
}