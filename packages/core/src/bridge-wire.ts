import type { BridgeAdapter } from '@coderyo/bridge';
import {
  BRIDGE_SCHEMA_VERSION,
  isBridgeInbound,
  isBridgeLayerInboundType,
  isChartScopedHostEvent,
  isWorkspaceHostEvent,
  LAYER_API_READY_V3,
  readInboundBridgeSchemaVersion,
  readPayloadChartId,
  type BridgeInboundType,
  type BridgeOutboundType,
  type ChartSummaryV3,
} from '@coderyo/bridge';
import {
  clearLayerBridgeVisitedPages,
  handleLayerBridgeMessage,
  registerChartLayerBridge,
  type ChartLayerBridgeRegistration,
} from './bridge-layer-wire.js';
import type { DrawingTool } from '@coderyo/drawings';
import type { Interval } from '@coderyo/data';
import type { IndicatorConfig } from '@coderyo/indicators';
import type { CrosshairPayload } from '@coderyo/renderer-lite';
import type { ChartController, ChartEvent } from './chart-controller.js';
import type { IChart } from './create-chart.js';
import { TRADVIEW_VERSION } from './version.js';

export const TRADVIEW_API_VERSION = 2 as const;

const DRAWING_TOOLS = new Set<DrawingTool>([
  'cursor',
  'trendline',
  'hline',
  'vline',
  'rectangle',
  'fibonacci',
  'text',
]);

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

export type { ChartLayerBridgeRegistration } from './bridge-layer-wire.js';

export interface WireChartBridgeOptions {
  controller: ChartController;
  chart: IChart;
  bridge: BridgeAdapter;
  chartId?: string;
  workspaceId?: string;
  /** Workspace chart list advertised in `chart.ready` / `chart.workspaceReady`. */
  charts?: ChartSummaryV3[];
  /** Allowlist of outbound bridge events; default all mapped events. */
  outboundEvents?: BridgeOutboundType[];
  crosshairThrottleMs?: number;
  /** Schema 2 layer bridge (register via `registerChartLayerBridge` or pass here). */
  layerBridge?: ChartLayerBridgeRegistration;
}

/** @public Wire host bridge messages to chart + controller events. */
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

  const workspaceId = opts.workspaceId ?? 'default';
  const symbol =
    typeof controller.getSymbol === 'function' ? controller.getSymbol() || undefined : undefined;
  const interval =
    typeof controller.getInterval === 'function'
      ? controller.getInterval() || undefined
      : undefined;
  const charts: ChartSummaryV3[] = opts.charts ?? [
    {
      chartId,
      symbol,
      interval,
      active: true,
    },
  ];

  post('chart.ready', {
    chartId,
    bridgeSchemaVersion: BRIDGE_SCHEMA_VERSION,
    apiVersion: TRADVIEW_API_VERSION,
    workspaceId,
    charts,
    version: TRADVIEW_VERSION,
    layerApi: LAYER_API_READY_V3,
  });

  if (shouldPost('chart.workspaceReady')) {
    post('chart.workspaceReady', { workspaceId, charts });
  }

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

  const unregisterLayer = opts.layerBridge
    ? registerChartLayerBridge({ ...opts.layerBridge, chartId })
    : undefined;

  const rejectInbound = (
    payloadChartId: string,
    code: string,
    message: string,
  ): void => {
    post('chart.error', {
      chartId: payloadChartId || chartId,
      code,
      message,
    });
  };

  const offHost = bridge.onMessage((msg) => {
    if (!isBridgeInbound(msg)) return;
    const p = msg.payload ?? {};

    const inboundSchema = readInboundBridgeSchemaVersion(p);
    if (inboundSchema != null && inboundSchema !== BRIDGE_SCHEMA_VERSION) {
      rejectInbound(
        readPayloadChartId(p),
        'UNSUPPORTED_BRIDGE_SCHEMA',
        `Expected bridgeSchemaVersion ${BRIDGE_SCHEMA_VERSION}, got ${inboundSchema}`,
      );
      return;
    }

    if (isWorkspaceHostEvent(msg.type)) {
      switch (msg.type) {
        case 'host.workspace.setActiveChart': {
          const id = readPayloadChartId(p);
          if (!id) {
            rejectInbound('', 'MISSING_CHART_ID', 'chartId is required for host.workspace.setActiveChart');
            return;
          }
          if (id !== chartId) {
            rejectInbound(id, 'CHART_NOT_FOUND', `No chart registered for chartId: ${id}`);
            return;
          }
          post('chart.focusChanged', {
            chartId: id,
            previousChartId: undefined,
          });
          break;
        }
        case 'host.workspace.setLinkGroup': {
          const groupId = typeof p.groupId === 'string' ? p.groupId : '';
          const chartIds = Array.isArray(p.chartIds)
            ? p.chartIds.filter((id): id is string => typeof id === 'string')
            : [];
          if (!groupId || chartIds.length === 0) return;
          post('chart.linkStateChanged', {
            groupId,
            chartIds,
            sync: (p.sync as Record<string, unknown>) ?? {},
          });
          break;
        }
        case 'host.workspace.createChart':
        case 'host.workspace.destroyChart': {
          const id = readPayloadChartId(p);
          if (!id) {
            rejectInbound('', 'MISSING_CHART_ID', `chartId is required for ${msg.type}`);
            return;
          }
          rejectInbound(
            id,
            'CHART_NOT_FOUND',
            'Multi-chart workspace is not available until V2-MC1',
          );
          break;
        }
        default:
          break;
      }
      return;
    }

    if (
      msg.type.startsWith('host.') &&
      isChartScopedHostEvent(msg.type) &&
      !msg.type.startsWith('host.layer.')
    ) {
      const payloadChartId = readPayloadChartId(p);
      if (!payloadChartId) {
        rejectInbound(
          chartId,
          'MISSING_CHART_ID',
          `chartId is required in payload for ${msg.type}`,
        );
        return;
      }
      if (payloadChartId !== chartId) {
        rejectInbound(
          payloadChartId,
          'CHART_NOT_FOUND',
          `No chart registered for chartId: ${payloadChartId}`,
        );
        return;
      }
    }

    if (msg.type.startsWith('host.layer.')) {
      if (!isBridgeLayerInboundType(msg.type)) {
        post('chart.error', {
          chartId: typeof p.chartId === 'string' ? p.chartId : '',
          code: 'SCHEMA_MISMATCH',
          message: `Unknown host.layer.* event: ${msg.type}`,
        });
        return;
      }
      handleLayerBridgeMessage(msg.type, p, {
        bridge,
        post: (type, payload) => post(type as BridgeOutboundType, payload),
      });
      return;
    }
    switch (msg.type as BridgeInboundType) {
      case 'host.setSymbol':
        if (typeof p.symbol === 'string') {
          chart.setSymbol(p.symbol);
          clearLayerBridgeVisitedPages(chartId);
        }
        break;
      case 'host.setInterval':
        if (typeof p.interval === 'string') {
          chart.setInterval(p.interval as Interval);
          clearLayerBridgeVisitedPages(chartId);
        }
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
      case 'host.setIndicatorConfig':
        if (p.config && typeof p.config === 'object') {
          chart.setIndicatorConfig(p.config as IndicatorConfig);
        }
        break;
      case 'host.clearAllIndicators':
        chart.clearAllIndicators();
        break;
      case 'host.clearAllDrawings':
        chart.clearAllDrawings();
        break;
      case 'host.setDrawingTool':
        if (typeof p.tool === 'string' && DRAWING_TOOLS.has(p.tool as DrawingTool)) {
          chart.setDrawingTool(p.tool as DrawingTool);
        }
        break;
      case 'host.setChartPaneResizeFocus':
        if (
          p.pane === 'main' ||
          p.pane === 'volume' ||
          p.pane === 'indicator' ||
          p.pane === 'all'
        ) {
          chart.setChartPaneResizeFocus(p.pane);
        } else {
          post('chart.error', {
            chartId,
            code: 'INVALID_PANE',
            message: `Invalid pane: ${String(p.pane ?? '')}`,
          });
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
    unregisterLayer?.();
    for (const [ev, fn] of handlers) chart.off(ev, fn);
  };
}