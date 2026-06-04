import type { BridgeAdapter } from '@coderyo/bridge';
import {
  isBridgeInbound,
  isWorkspaceHostEvent,
  readPayloadChartId,
} from '@coderyo/bridge';
import type { ChartWorkspace } from './chart-workspace.js';

export interface WireWorkspaceBridgeOptions {
  workspace: ChartWorkspace;
  bridge: BridgeAdapter;
}

/**
 * Schema 3 workspace host events (V2-B4–B6).
 * Chart-scoped events remain on per-chart {@link wireChartBridge}.
 */
export function wireWorkspaceBridge(opts: WireWorkspaceBridgeOptions): () => void {
  const { workspace, bridge } = opts;

  const postError = (chartId: string, code: string, message: string) => {
    bridge.post({
      type: 'chart.error',
      payload: { chartId, code, message },
    });
  };

  const postWorkspaceReady = () => {
    bridge.post({
      type: 'chart.workspaceReady',
      payload: {
        workspaceId: workspace.getWorkspaceId(),
        charts: workspace.listChartSummaries(),
      },
    });
  };

  postWorkspaceReady();

  return bridge.onMessage((msg) => {
    if (!isBridgeInbound(msg) || !isWorkspaceHostEvent(msg.type)) return;
    const p = msg.payload ?? {};

    switch (msg.type) {
      case 'host.workspace.createChart': {
        const chartId = readPayloadChartId(p);
        const containerId = typeof p.containerId === 'string' ? p.containerId : '';
        if (!chartId) {
          postError('', 'MISSING_CHART_ID', 'chartId is required for host.workspace.createChart');
          return;
        }
        if (!containerId) {
          postError(chartId, 'CHART_NOT_FOUND', 'containerId is required for host.workspace.createChart');
          return;
        }
        const container = workspace.resolveContainer(containerId);
        if (!container) {
          postError(chartId, 'CHART_NOT_FOUND', `container not found: ${containerId}`);
          return;
        }
        if (workspace.getChart(chartId)) {
          postError(chartId, 'CHART_NOT_FOUND', `Chart already exists: ${chartId}`);
          return;
        }
        try {
          workspace.createChart(chartId, container, {
            chartId,
            dataProvider: workspace.getDataProvider(),

          });
          postWorkspaceReady();
        } catch (err) {
          postError(
            chartId,
            'CHART_NOT_FOUND',
            err instanceof Error ? err.message : String(err),
          );
        }
        break;
      }
      case 'host.workspace.destroyChart': {
        const chartId = readPayloadChartId(p);
        if (!chartId) {
          postError('', 'MISSING_CHART_ID', 'chartId is required for host.workspace.destroyChart');
          return;
        }
        if (!workspace.getChart(chartId)) {
          postError(chartId, 'CHART_NOT_FOUND', `No chart registered for chartId: ${chartId}`);
          return;
        }
        workspace.destroyChart(chartId);
        postWorkspaceReady();
        break;
      }
      case 'host.workspace.setActiveChart': {
        const chartId = readPayloadChartId(p);
        if (!chartId) {
          postError('', 'MISSING_CHART_ID', 'chartId is required for host.workspace.setActiveChart');
          return;
        }
        if (!workspace.getChart(chartId)) {
          postError(chartId, 'CHART_NOT_FOUND', `No chart registered for chartId: ${chartId}`);
          return;
        }
        const previous = workspace.getActiveChartId() ?? undefined;
        workspace.setActiveChart(chartId, previous);
        break;
      }
      case 'host.workspace.setLinkGroup': {
        const groupId = typeof p.groupId === 'string' ? p.groupId : '';
        const chartIds = Array.isArray(p.chartIds)
          ? p.chartIds.filter((id): id is string => typeof id === 'string')
          : [];
        if (!groupId || chartIds.length === 0) return;
        workspace.setLinkGroup({
          id: groupId,
          chartIds,
          sync: (p.sync as Record<string, boolean>) ?? {},
          generation: typeof p.generation === 'number' ? p.generation : 0,
        });
        break;
      }
      default:
        break;
    }
  });
}