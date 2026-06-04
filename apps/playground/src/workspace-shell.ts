import { ChartWorkspace, createDemoChartOptions } from '@coderyo/core';
import { createDefaultBridge } from '@coderyo/bridge';
import { createGatewayDataProvider } from '@coderyo/data/client';
import { createWorkspaceChartSlots } from '@coderyo/ui-shell';
import type { Interval } from '@coderyo/data';

const workspaceEl = document.getElementById('workspace')!;
const logEl = document.getElementById('log')!;

const provider = createGatewayDataProvider({
  restBaseUrl: '',
  wsUrl: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`,
});

const bridge = createDefaultBridge();
const { slots } = createWorkspaceChartSlots(workspaceEl, {
  layout: 'grid2',
  slotIds: ['chart-a', 'chart-b'],
});

const ws = new ChartWorkspace({
  workspaceId: 'playground-workspace',
  dataProvider: provider,
  bridge,
  defaultLinkGroupId: 'default',
});

const readSync = () => ({
  interval: (document.getElementById('sync-interval') as HTMLInputElement).checked,
  crosshair: (document.getElementById('sync-crosshair') as HTMLInputElement).checked,
});

const applyLink = () => {
  ws.setLinkGroup({
    id: 'default',
    chartIds: slots.map((s) => s.chartId),
    sync: readSync(),
  });
};

for (const id of ['sync-crosshair', 'sync-interval']) {
  document.getElementById(id)?.addEventListener('change', applyLink);
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

bridge.onMessage((msg) => {
  if (msg.type === 'chart.workspaceReady' || msg.type === 'chart.ready') {
    logEl.textContent = `${msg.type} charts=${JSON.stringify((msg.payload as { charts?: unknown })?.charts ?? [])}`;
  }
});

document.getElementById('btn-workspace-ready')?.addEventListener('click', () => {
  bridge.post({
    type: 'host.workspace.setActiveChart',
    payload: { chartId: 'chart-a' },
  });
});