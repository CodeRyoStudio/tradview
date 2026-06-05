import { ChartWorkspace, createDemoChartOptions } from '@coderyo/core';
import { createGatewayDataProvider } from '@coderyo/data/client';
import { createWorkspaceChartSlots, loadLinkChartsPreference } from '@coderyo/ui-shell';
import type { Interval } from '@coderyo/data';

const workspaceEl = document.getElementById('workspace')!;
const provider = createGatewayDataProvider({
  restBaseUrl: '',
  wsUrl: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`,
});

const { slots } = createWorkspaceChartSlots(workspaceEl, {
  layout: 'grid2',
  slotIds: ['chart-a', 'chart-b'],
});

let linkChartsTimeScale = loadLinkChartsPreference();

const ws = new ChartWorkspace({
  workspaceId: 'playground-mc3',
  dataProvider: provider,
  defaultLinkGroupId: 'default',
  linkChartsTimeScale,
});

const readSync = () => ({
  symbol: (document.getElementById('sync-symbol') as HTMLInputElement).checked,
  interval: (document.getElementById('sync-interval') as HTMLInputElement).checked,
  visibleRange:
    linkChartsTimeScale ||
    (document.getElementById('sync-range') as HTMLInputElement).checked,
  crosshair: (document.getElementById('sync-crosshair') as HTMLInputElement).checked,
});

const applyLink = () => {
  ws.setLinkGroup({
    id: 'default',
    chartIds: slots.map((s) => s.chartId),
    sync: readSync(),
  });
};

for (const id of ['sync-symbol', 'sync-interval', 'sync-range', 'sync-crosshair']) {
  document.getElementById(id)?.addEventListener('change', applyLink);
}

const syncRangeEl = document.getElementById('sync-range') as HTMLInputElement | null;
if (syncRangeEl && linkChartsTimeScale) {
  syncRangeEl.checked = true;
}

for (const slot of slots) {
  ws.createChart(
    slot.chartId,
    slot.element,
    createDemoChartOptions({
      dataProvider: provider,
      chartId: slot.chartId,
      symbol: slot.chartId === 'chart-a' ? 'BINANCE:BTCUSDT' : 'BINANCE:ETHUSDT',
      interval: '1h' as Interval,
    }),
  );
}

applyLink();