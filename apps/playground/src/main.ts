import { createChart } from '@tradview/core';
import { createGatewayDataProvider } from '@tradview/data';
import { mountChartLayout, type TopBarOptions } from '@tradview/ui-shell';

const root = document.getElementById('app')!;
const shellOpts: TopBarOptions & { showLeftToolbar?: boolean } = {
  showLeftToolbar: true,
};
const { chartHost } = mountChartLayout(root, shellOpts);

const restBase = import.meta.env.DEV ? '/api' : 'http://127.0.0.1:4010';
const wsBase = import.meta.env.DEV
  ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`
  : 'ws://127.0.0.1:4010/ws?v=1.0';

const provider = createGatewayDataProvider({
  restBaseUrl: restBase,
  wsUrl: wsBase,
});

let theme: 'dark' | 'light' = 'dark';

const chart = createChart(chartHost, {
  dataProvider: provider,
  symbol: 'BINANCE:BTCUSDT',
  interval: '1h',
  theme,
  height: chartHost.clientHeight,
});

shellOpts.onIntervalChange = (interval) => {
  chart.setInterval(interval);
};
shellOpts.onThemeToggle = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  chart.setTheme(theme);
  root.style.background = theme === 'dark' ? '#0d1117' : '#f6f8fa';
};
shellOpts.onFullscreen = () => chart.setFullscreen(true);
shellOpts.onScreenshot = () => {
  void chart.exportImage({ pixelRatio: 2 }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tradview-chart.png';
    a.click();
    URL.revokeObjectURL(url);
  });
};

chart.on('connectionChange', (state) => {
  console.log('[playground] connection', state);
});

chart.on('barUpdate', () => {
  /* live */
});

console.log('[playground] TradView chart ready — ensure mock: pnpm dev:mock');