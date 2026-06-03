import { createChart } from '@tradview/core';
import { createGatewayDataProvider } from '@tradview/data';
import { mountChartLayout } from '@tradview/ui-shell';

const root = document.getElementById('app')!;
const { chartHost } = mountChartLayout(root, { showLeftToolbar: true });

const restBase = import.meta.env.DEV ? '/api' : 'http://127.0.0.1:4010';
const wsBase = import.meta.env.DEV
  ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`
  : 'ws://127.0.0.1:4010/ws?v=1.0';

const provider = createGatewayDataProvider({
  restBaseUrl: restBase,
  wsUrl: wsBase,
});

const chart = createChart(chartHost, {
  dataProvider: provider,
  symbol: 'BINANCE:BTCUSDT',
  interval: '1h',
  theme: 'dark',
  height: chartHost.clientHeight,
});

chart.on('connectionChange', (state) => {
  console.log('[playground] connection', state);
});

chart.on('barUpdate', () => {
  /* live */
});

console.log('[playground] TradView chart ready — ensure mock: pnpm dev:mock');