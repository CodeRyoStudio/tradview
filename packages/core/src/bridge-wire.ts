import type { BridgeAdapter } from '@tradview/bridge';
import { BRIDGE_SCHEMA_VERSION, isBridgeInbound, type BridgeInboundType } from '@tradview/bridge';
import type { Interval } from '@tradview/data';
import type { CrosshairPayload } from '@tradview/renderer-lite';
import type { ChartController, ChartEvent } from './chart-controller.js';
import type { IChart } from './create-chart.js';
import { TRADVIEW_VERSION } from './version.js';

export const TRADVIEW_API_VERSION = 1 as const;

export interface WireChartBridgeOptions {
  controller: ChartController;
  chart: IChart;
  bridge: BridgeAdapter;
  chartId?: string;
}

export function wireChartBridge(opts: WireChartBridgeOptions): () => void {
  const chartId = opts.chartId ?? `chart-${Date.now()}`;
  const { bridge, chart, controller } = opts;

  bridge.post({
    type: 'chart.ready',
    payload: {
      chartId,
      bridgeSchemaVersion: BRIDGE_SCHEMA_VERSION,
      apiVersion: TRADVIEW_API_VERSION,
      version: TRADVIEW_VERSION,
    },
  });

  const postResize = () => {
    const el = controller.getContainer();
    const r = el.getBoundingClientRect();
    bridge.post({
      type: 'chart.resize',
      payload: { chartId, width: Math.round(r.width), height: Math.round(r.height) },
    });
  };
  postResize();

  const handlers = new Map<ChartEvent, (p?: unknown) => void>();

  handlers.set('connectionChange', (state) => {
    bridge.post({
      type: 'chart.connectionChange',
      payload: { chartId, state },
    });
  });
  handlers.set('visibleRangeChange', (range) => {
    const r = range as { from?: number; to?: number };
    bridge.post({
      type: 'chart.visibleRange',
      payload: { chartId, from: r.from, to: r.to },
    });
  });
  handlers.set('error', (err) => {
    const e = err as { code?: string; message?: string };
    bridge.post({
      type: 'chart.error',
      payload: {
        chartId,
        code: e?.code ?? 'UNKNOWN',
        message: e?.message ?? String(err),
      },
    });
  });
  handlers.set('symbolChange', (symbol) => {
    bridge.post({
      type: 'chart.symbol',
      payload: { chartId, symbol: String(symbol ?? '') },
    });
  });
  handlers.set('intervalChange', (interval) => {
    bridge.post({
      type: 'chart.interval',
      payload: { chartId, interval: String(interval ?? '') },
    });
  });
  handlers.set('crosshairChange', (payload) => {
    const p = payload as CrosshairPayload | null;
    if (!p) return;
    bridge.post({
      type: 'chart.crosshair',
      payload: {
        chartId,
        time: p.time,
        price: p.price,
        ohlcv: p.ohlcv,
        symbol: controller.getSymbol(),
        interval: controller.getInterval(),
      },
    });
  });
  handlers.set('destroyed', () => {
    bridge.post({
      type: 'chart.destroyed',
      payload: { chartId },
    });
  });

  for (const [ev, fn] of handlers) chart.on(ev, fn);

  const offHost = bridge.onMessage((msg) => {
    if (!isBridgeInbound(msg)) return;
    const p = msg.payload ?? {};
    switch (msg.type as BridgeInboundType) {
      case 'host.setSymbol':
        if (typeof p.symbol === 'string') chart.setSymbol(p.symbol);
        break;
      case 'host.setInterval':
        if (typeof p.interval === 'string') chart.setInterval(p.interval as Interval);
        break;
      case 'host.setTheme':
        if (p.theme === 'dark' || p.theme === 'light') chart.setTheme(p.theme);
        break;
      case 'host.setShowGrid':
        if (typeof p.showGrid === 'boolean') chart.setShowGrid(p.showGrid);
        break;
      case 'host.fitContent':
        chart.fitContent();
        break;
      case 'host.scrollToRealtime':
        chart.scrollToRealtime();
        break;
      case 'host.resize':
        chart.resize({
          width: typeof p.width === 'number' ? p.width : undefined,
          height: typeof p.height === 'number' ? p.height : undefined,
        });
        postResize();
        break;
      case 'host.destroy':
        chart.destroy();
        break;
      default:
        break;
    }
  });

  return () => {
    offHost();
    for (const [ev, fn] of handlers) chart.off(ev, fn);
  };
}