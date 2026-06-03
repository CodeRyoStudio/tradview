import type { BridgeAdapter } from '@coderyo/bridge';
import {
  BRIDGE_SCHEMA_VERSION,
  isBridgeInbound,
  type BridgeInboundType,
  type BridgeOutboundType,
} from '@coderyo/bridge';
import type { Interval } from '@coderyo/data';
import type { CrosshairPayload } from '@coderyo/renderer-lite';
import type { ChartController, ChartEvent } from './chart-controller.js';
import type { IChart } from './create-chart.js';
import { TRADVIEW_VERSION } from './version.js';

export const TRADVIEW_API_VERSION = 1 as const;

const CHART_EVENT_TO_BRIDGE: Partial<Record<ChartEvent, BridgeOutboundType>> = {
  connectionChange: 'chart.connectionChange',
  visibleRangeChange: 'chart.visibleRange',
  error: 'chart.error',
  symbolChange: 'chart.symbol',
  intervalChange: 'chart.interval',
  crosshairChange: 'chart.crosshair',
  destroyed: 'chart.destroyed',
  barUpdate: 'chart.barUpdate',
};

export interface WireChartBridgeOptions {
  controller: ChartController;
  chart: IChart;
  bridge: BridgeAdapter;
  chartId?: string;
  /** Allowlist of outbound bridge events; default all mapped events. */
  outboundEvents?: BridgeOutboundType[];
  crosshairThrottleMs?: number;
}

export function wireChartBridge(opts: WireChartBridgeOptions): () => void {
  const chartId = opts.chartId ?? `chart-${Date.now()}`;
  const { bridge, chart, controller } = opts;
  const allow = opts.outboundEvents ? new Set(opts.outboundEvents) : null;

  const shouldPost = (type: BridgeOutboundType): boolean =>
    allow === null || allow.has(type);

  const post = (type: BridgeOutboundType, payload: Record<string, unknown>) => {
    if (!shouldPost(type)) return;
    bridge.post({ type, payload });
  };

  post('chart.ready', {
    chartId,
    bridgeSchemaVersion: BRIDGE_SCHEMA_VERSION,
    apiVersion: TRADVIEW_API_VERSION,
    version: TRADVIEW_VERSION,
  });

  const postResize = () => {
    const el = controller.getContainer();
    const r = el.getBoundingClientRect();
    post('chart.resize', {
      chartId,
      width: Math.round(r.width),
      height: Math.round(r.height),
    });
  };
  if (shouldPost('chart.resize')) postResize();

  let crosshairTimer: ReturnType<typeof setTimeout> | null = null;
  let crosshairPending: CrosshairPayload | null = null;
  const throttleMs = opts.crosshairThrottleMs ?? 0;

  const flushCrosshair = () => {
    crosshairTimer = null;
    const p = crosshairPending;
    crosshairPending = null;
    if (!p) return;
    post('chart.crosshair', {
      chartId,
      time: p.time,
      price: p.price,
      ohlcv: p.ohlcv,
      symbol: controller.getSymbol(),
      interval: controller.getInterval(),
    });
  };

  const handlers = new Map<ChartEvent, (p?: unknown) => void>();

  handlers.set('connectionChange', (state) => {
    post('chart.connectionChange', { chartId, state });
  });
  handlers.set('visibleRangeChange', (range) => {
    const r = range as { from?: number; to?: number };
    post('chart.visibleRange', { chartId, from: r.from, to: r.to });
  });
  handlers.set('error', (err) => {
    const e = err as { code?: string; message?: string };
    post('chart.error', {
      chartId,
      code: e?.code ?? 'UNKNOWN',
      message: e?.message ?? String(err),
    });
  });
  handlers.set('symbolChange', (symbol) => {
    post('chart.symbol', { chartId, symbol: String(symbol ?? '') });
  });
  handlers.set('intervalChange', (interval) => {
    post('chart.interval', { chartId, interval: String(interval ?? '') });
  });
  handlers.set('crosshairChange', (payload) => {
    const p = payload as CrosshairPayload | null;
    if (!p) return;
    if (throttleMs <= 0) {
      post('chart.crosshair', {
        chartId,
        time: p.time,
        price: p.price,
        ohlcv: p.ohlcv,
        symbol: controller.getSymbol(),
        interval: controller.getInterval(),
      });
      return;
    }
    crosshairPending = p;
    if (!crosshairTimer) {
      crosshairTimer = setTimeout(flushCrosshair, throttleMs);
    }
  });
  handlers.set('destroyed', () => {
    post('chart.destroyed', { chartId });
  });
  handlers.set('barUpdate', (bar) => {
    const b = bar as { t?: number; c?: number };
    post('chart.barUpdate', { chartId, t: b?.t, c: b?.c });
  });

  for (const [ev, fn] of handlers) {
    const bridgeType = CHART_EVENT_TO_BRIDGE[ev];
    if (!bridgeType || shouldPost(bridgeType)) {
      chart.on(ev, fn);
    }
  }

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
      case 'host.setLogScale':
        if (typeof p.enabled === 'boolean') chart.setLogScale(p.enabled);
        break;
      case 'host.setBarSpace':
        if (typeof p.px === 'number') chart.setBarSpace(p.px);
        break;
      case 'host.setVisibleRange':
        if (typeof p.fromMs === 'number' && typeof p.toMs === 'number') {
          chart.setVisibleRange({ fromMs: p.fromMs, toMs: p.toMs });
        }
        break;
      case 'host.scrollToTimestamp':
        if (typeof p.tsMs === 'number') {
          chart.scrollToTimestamp(
            p.tsMs,
            typeof p.animationMs === 'number' ? p.animationMs : undefined,
          );
        }
        break;
      case 'host.reloadHistory':
        void chart.reloadHistory();
        break;
      case 'host.setLocale':
        if (typeof p.locale === 'string') chart.setLocale(p.locale);
        break;
      case 'host.setFeatures':
        if (p.features && typeof p.features === 'object') {
          chart.setFeatures(p.features as import('./chart-features.js').ChartFeatures);
        }
        break;
      case 'host.destroy':
        chart.destroy();
        break;
      default:
        break;
    }
  });

  return () => {
    if (crosshairTimer) clearTimeout(crosshairTimer);
    offHost();
    for (const [ev, fn] of handlers) chart.off(ev, fn);
  };
}