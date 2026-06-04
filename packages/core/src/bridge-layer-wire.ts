import type { BridgeAdapter } from '@coderyo/bridge';
import {
  bridgeLayerPayloadHasDeprecatedLayerId,
  isBridgeLayerInboundType,
  type BridgeLayerInboundType,
  type BridgeLayerPane,
} from '@coderyo/bridge';
import { mergeLayerBridgePreset } from './merge-layer-bridge-preset.js';
import { resolvePaneSyncGroupsFromLayers } from './resolve-pane-sync-groups.js';

/** Minimal chart surface for layer time-scale sync (matches `IChart.applyTimeScaleSyncFromLayers`). */
export interface LayerTimeScaleSyncChart {
  applyTimeScaleSyncFromLayers(
    layers: Array<{ type: string; pageId?: string; syncTimeScaleGroupId?: string }>,
    pageId?: string,
  ): unknown;
}

export type LayerBridgePane = BridgeLayerPane;

const PANE_LAYER_TYPES: Record<LayerBridgePane, string> = {
  main: 'chart.main',
  volume: 'chart.volume',
  indicator: 'chart.indicator',
};

export interface LayerBridgePreset {
  version?: number;
  revision?: number;
  pages: Array<{ id: string; title?: string }>;
  layers: Array<{
    id: string;
    pageId: string;
    type: string;
    syncTimeScaleGroupId?: string;
    visible?: boolean;
  }>;
  groups: Array<{ id: string; layerIds?: string[]; name?: string }>;
  [key: string]: unknown;
}

/** Minimal LayerController surface for bridge wiring (avoids ui-shell in tests). */
export interface LayerBridgeController {
  activePageId: string;
  presetRevision: number;
  getPreset(): LayerBridgePreset;
  setLayerSyncGroup(layerId: string, groupId: string | null | undefined): boolean;
  setLayerVisible(layerId: string, visible: boolean): void;
  setActivePage(pageId: string): boolean;
  setPreset(next: LayerBridgePreset): boolean;
}

export interface ChartLayerBridgeRegistration {
  chartId: string;
  chart: LayerTimeScaleSyncChart;
  layerController: LayerBridgeController;
  compositorApply?: () => void;
  syncCompositorShellVisibility?: () => void;
  normalizePreset?: (input: LayerBridgePreset) => LayerBridgePreset;
  mergePreset?: (current: LayerBridgePreset, partial: LayerBridgePreset) => LayerBridgePreset;
}

interface ChartLayerBridgeState extends ChartLayerBridgeRegistration {
  visitedPageIds: Set<string>;
  /** Pages that should run lazy apply on next visit (`applyTimeScaleSync` allPages). */
  pendingAllPagesApply: boolean;
}

const registry = new Map<string, ChartLayerBridgeState>();

export function registerChartLayerBridge(reg: ChartLayerBridgeRegistration): () => void {
  const state: ChartLayerBridgeState = {
    ...reg,
    mergePreset: reg.mergePreset ?? mergeLayerBridgePreset,
    visitedPageIds: new Set<string>(),
    pendingAllPagesApply: false,
  };
  registry.set(reg.chartId, state);
  return () => {
    registry.delete(reg.chartId);
  };
}

export function unregisterChartLayerBridge(chartId: string): void {
  registry.delete(chartId);
}

export function clearLayerBridgeVisitedPages(chartId: string): void {
  const state = registry.get(chartId);
  if (!state) return;
  state.visitedPageIds.clear();
  state.pendingAllPagesApply = false;
}

export function getChartLayerBridgeState(chartId: string): ChartLayerBridgeState | undefined {
  return registry.get(chartId);
}

export function hasLayerBridgeRegistration(chartId?: string): boolean {
  if (chartId != null) return registry.has(chartId);
  return registry.size > 0;
}

export function isValidLayerBridgePane(pane: unknown): pane is LayerBridgePane {
  return pane === 'main' || pane === 'volume' || pane === 'indicator';
}

/** Resolve chart pane → layer ids (`allPages` scans every page). */
export function resolvePaneLayerIds(
  preset: Pick<LayerBridgePreset, 'layers' | 'pages'>,
  pane: LayerBridgePane,
  opts?: { allPages?: boolean; activePageId?: string },
): string[] {
  const layerType = PANE_LAYER_TYPES[pane];
  const allPages = opts?.allPages === true;
  const activePageId = opts?.activePageId;
  const pageIds = allPages
    ? preset.pages.map((p) => p.id)
    : activePageId
      ? [activePageId]
      : [];
  if (pageIds.length === 0) return [];
  return preset.layers
    .filter((l) => pageIds.includes(l.pageId) && l.type === layerType)
    .map((l) => l.id);
}

function postLayerError(
  chartId: string,
  code: string,
  message: string,
  post: (type: 'chart.error', payload: Record<string, unknown>) => void,
): void {
  post('chart.error', { chartId, code, message });
}

function applyTimeScaleForPage(state: ChartLayerBridgeState, pageId: string): void {
  state.chart.applyTimeScaleSyncFromLayers(state.layerController.getPreset().layers, pageId);
  state.visitedPageIds.add(pageId);
}

function lazyApplyActivePage(state: ChartLayerBridgeState): void {
  applyTimeScaleForPage(state, state.layerController.activePageId);
}

function invalidateNonActivePageVisits(state: ChartLayerBridgeState): void {
  const activeId = state.layerController.activePageId;
  for (const p of state.layerController.getPreset().pages) {
    if (p.id !== activeId) state.visitedPageIds.delete(p.id);
  }
}

function afterPresetMutation(state: ChartLayerBridgeState): void {
  state.compositorApply?.();
  state.syncCompositorShellVisibility?.();
  lazyApplyActivePage(state);
}

/** ADR §4.2: `chartId` must be present in payload (no wire fallback). */
function requirePayloadChartId(payload: Record<string, unknown>): string | null {
  const id = typeof payload.chartId === 'string' ? payload.chartId.trim() : '';
  return id.length > 0 ? id : null;
}

function handleSetSyncGroup(
  state: ChartLayerBridgeState,
  payload: Record<string, unknown>,
  post: (type: 'chart.layerSyncGroupChanged', payload: Record<string, unknown>) => void,
  postError: (code: string, message: string) => void,
): void {
  if (bridgeLayerPayloadHasDeprecatedLayerId(payload)) {
    postError('INVALID_PAYLOAD', 'host.layer.setSyncGroup does not accept layerId (use pane)');
    return;
  }
  if (!('pane' in payload)) {
    postError('INVALID_PAYLOAD', 'pane is required');
    return;
  }
  if (!isValidLayerBridgePane(payload.pane)) {
    postError('INVALID_PANE', `Invalid pane: ${String(payload.pane ?? '')}`);
    return;
  }
  const pane = payload.pane;
  const allPages = payload.allPages === true;
  const groupId = payload.groupId == null ? '' : String(payload.groupId);
  const preset = state.layerController.getPreset();
  const layerIds = resolvePaneLayerIds(preset, pane, {
    allPages,
    activePageId: state.layerController.activePageId,
  });
  if (layerIds.length === 0) {
    postError('PANE_NOT_FOUND', `No ${pane} pane layers in scope`);
    return;
  }
  for (const layerId of layerIds) {
    state.layerController.setLayerSyncGroup(layerId, groupId);
  }
  lazyApplyActivePage(state);
  post('chart.layerSyncGroupChanged', {
    chartId: state.chartId,
    pane,
    groupId,
    allPages,
    activePageId: state.layerController.activePageId,
  });
}

function handleSetVisible(
  state: ChartLayerBridgeState,
  payload: Record<string, unknown>,
  post: (type: 'chart.layerVisibleChanged', payload: Record<string, unknown>) => void,
  postError: (code: string, message: string) => void,
): void {
  if (!('pane' in payload)) {
    postError('INVALID_PAYLOAD', 'pane is required');
    return;
  }
  if (!isValidLayerBridgePane(payload.pane)) {
    postError('INVALID_PANE', `Invalid pane: ${String(payload.pane ?? '')}`);
    return;
  }
  if (typeof payload.visible !== 'boolean') {
    postError('INVALID_PAYLOAD', 'visible must be boolean');
    return;
  }
  const pane = payload.pane;
  const allPages = payload.allPages === true;
  const visible = payload.visible;
  const preset = state.layerController.getPreset();
  const layerIds = resolvePaneLayerIds(preset, pane, {
    allPages,
    activePageId: state.layerController.activePageId,
  });
  if (layerIds.length === 0) {
    postError('PANE_NOT_FOUND', `No ${pane} pane layers in scope`);
    return;
  }
  for (const layerId of layerIds) {
    state.layerController.setLayerVisible(layerId, visible);
  }
  state.compositorApply?.();
  state.syncCompositorShellVisibility?.();
  post('chart.layerVisibleChanged', {
    chartId: state.chartId,
    pane,
    visible,
    allPages,
  });
}

function maybeClearPendingAllPages(state: ChartLayerBridgeState): void {
  if (!state.pendingAllPagesApply) return;
  const allVisited = state.layerController
    .getPreset()
    .pages.every((p) => state.visitedPageIds.has(p.id));
  if (allVisited) state.pendingAllPagesApply = false;
}

function handleSetActivePage(
  state: ChartLayerBridgeState,
  payload: Record<string, unknown>,
  post: (type: 'chart.layerPageChanged', payload: Record<string, unknown>) => void,
  postError: (code: string, message: string) => void,
): void {
  const pageId = typeof payload.pageId === 'string' ? payload.pageId : '';
  if (!pageId) {
    postError('INVALID_PAYLOAD', 'pageId is required');
    return;
  }
  const preset = state.layerController.getPreset();
  if (!preset.pages.some((p) => p.id === pageId)) {
    postError('INVALID_PAYLOAD', `Unknown pageId: ${pageId}`);
    return;
  }
  const previousPageId = state.layerController.activePageId;
  if (previousPageId === pageId) {
    return;
  }
  if (!state.layerController.setActivePage(pageId)) {
    return;
  }
  state.compositorApply?.();
  state.syncCompositorShellVisibility?.();
  if (!state.visitedPageIds.has(pageId) || state.pendingAllPagesApply) {
    applyTimeScaleForPage(state, pageId);
  }
  maybeClearPendingAllPages(state);
  post('chart.layerPageChanged', {
    chartId: state.chartId,
    pageId,
    previousPageId,
  });
}

function handleSetPreset(
  state: ChartLayerBridgeState,
  payload: Record<string, unknown>,
  postError: (code: string, message: string) => void,
  emitLayerDeltas: (prev: LayerBridgePreset, next: LayerBridgePreset) => void,
): void {
  const rawPreset = payload.preset;
  if (!rawPreset || typeof rawPreset !== 'object') {
    postError('INVALID_PRESET', 'preset object is required');
    return;
  }
  const incoming = rawPreset as LayerBridgePreset;
  const revisionRaw = Number(incoming.revision);
  if (!Number.isFinite(revisionRaw) || revisionRaw < 1) {
    postError('INVALID_PRESET', 'preset.revision must be an integer ≥ 1');
    return;
  }
  const revision = Math.floor(revisionRaw);
  if (revision < state.layerController.presetRevision) {
    postError(
      'STALE_PRESET_REVISION',
      `Host revision ${revision} < current ${state.layerController.presetRevision}`,
    );
    return;
  }
  const replace = payload.replace === true;
  const normalize = state.normalizePreset ?? ((p) => p);
  const mergeFn = state.mergePreset ?? mergeLayerBridgePreset;
  const current = state.layerController.getPreset();
  let merged: LayerBridgePreset;
  try {
    merged = replace
      ? normalize({ ...incoming, revision })
      : normalize(mergeFn(current, { ...incoming, revision }));
  } catch (err) {
    postError('INVALID_PRESET', err instanceof Error ? err.message : String(err));
    return;
  }
  const prev = state.layerController.getPreset();
  if (!state.layerController.setPreset(merged)) {
    postError('INVALID_PRESET', 'setPreset rejected (interaction in progress)');
    return;
  }
  state.layerController.presetRevision = revision;
  afterPresetMutation(state);
  emitLayerDeltas(prev, state.layerController.getPreset());
}

function handleApplyTimeScaleSync(
  state: ChartLayerBridgeState,
  payload: Record<string, unknown>,
  postError: (code: string, message: string) => void,
): void {
  const allPages = payload.allPages === true;
  const activeId = state.layerController.activePageId;
  const pageId =
    typeof payload.pageId === 'string' ? payload.pageId : activeId;
  if (!state.layerController.getPreset().pages.some((p) => p.id === pageId)) {
    postError('INVALID_PAYLOAD', `Unknown pageId: ${pageId}`);
    return;
  }
  if (allPages) {
    state.pendingAllPagesApply = true;
    invalidateNonActivePageVisits(state);
    applyTimeScaleForPage(state, activeId);
    return;
  }
  if (pageId === activeId) {
    applyTimeScaleForPage(state, pageId);
  } else {
    state.visitedPageIds.delete(pageId);
  }
}

function emitPresetLayerDeltas(
  state: ChartLayerBridgeState,
  prev: LayerBridgePreset,
  next: LayerBridgePreset,
  postSync: (type: string, payload: Record<string, unknown>) => void,
  postVisible: (type: string, payload: Record<string, unknown>) => void,
  _postPage: (type: string, payload: Record<string, unknown>) => void,
): void {
  const active = state.layerController.activePageId;
  for (const pane of ['main', 'volume', 'indicator'] as const) {
    const prevIds = resolvePaneLayerIds(prev, pane, { activePageId: active });
    const nextIds = resolvePaneLayerIds(next, pane, { activePageId: active });
    if (prevIds.length === 0 && nextIds.length === 0) continue;
    const prevLayer = prev.layers.find((l) => l.id === prevIds[0]);
    const nextLayer = next.layers.find((l) => l.id === nextIds[0]);
    const prevGroup = prevLayer?.syncTimeScaleGroupId ?? '';
    const nextGroup = nextLayer?.syncTimeScaleGroupId ?? '';
    if (prevGroup !== nextGroup && nextIds.length > 0) {
      postSync('chart.layerSyncGroupChanged', {
        chartId: state.chartId,
        pane,
        groupId: nextGroup,
        allPages: false,
        activePageId: active,
      });
    }
    if (prevLayer && nextLayer && prevLayer.visible !== nextLayer.visible) {
      postVisible('chart.layerVisibleChanged', {
        chartId: state.chartId,
        pane,
        visible: nextLayer.visible !== false,
        allPages: false,
      });
    }
  }
}

export interface HandleLayerBridgeMessageOptions {
  bridge: BridgeAdapter;
  post: (type: string, payload: Record<string, unknown>) => void;
}

/** Handle a single inbound `host.layer.*` message; returns true if handled. */
export function handleLayerBridgeMessage(
  type: string,
  payload: Record<string, unknown>,
  opts: HandleLayerBridgeMessageOptions,
): boolean {
  if (!isBridgeLayerInboundType(type)) return false;

  const chartId = requirePayloadChartId(payload);
  if (!chartId) {
    opts.post('chart.error', {
      chartId: '',
      code: 'MISSING_CHART_ID',
      message: 'chartId is required in payload for host.layer.*',
    });
    return true;
  }

  const state = registry.get(chartId);
  if (!state) {
    const code =
      registry.size === 0 ? 'LAYER_BRIDGE_NOT_REGISTERED' : 'CHART_NOT_FOUND';
    const message =
      code === 'LAYER_BRIDGE_NOT_REGISTERED'
        ? 'Layer bridge is not registered (pass layerBridge to wireChartBridge)'
        : `No layer bridge registered for chartId: ${chartId}`;
    opts.post('chart.error', { chartId, code, message });
    return true;
  }

  const postError = (code: string, message: string) =>
    postLayerError(chartId, code, message, opts.post);

  const postSync = (_type: string, payload: Record<string, unknown>) =>
    opts.post('chart.layerSyncGroupChanged', payload);
  const postVisible = (_type: string, payload: Record<string, unknown>) =>
    opts.post('chart.layerVisibleChanged', payload);
  const postPage = (_type: string, payload: Record<string, unknown>) =>
    opts.post('chart.layerPageChanged', payload);

  switch (type as BridgeLayerInboundType) {
    case 'host.layer.setSyncGroup':
      handleSetSyncGroup(state, payload, postSync, postError);
      break;
    case 'host.layer.setVisible':
      handleSetVisible(state, payload, postVisible, postError);
      break;
    case 'host.layer.setActivePage':
      handleSetActivePage(state, payload, postPage, postError);
      break;
    case 'host.layer.setPreset':
      handleSetPreset(state, payload, postError, (prev, next) =>
        emitPresetLayerDeltas(state, prev, next, postSync, postVisible, postPage),
      );
      break;
    case 'host.layer.applyTimeScaleSync':
      handleApplyTimeScaleSync(state, payload, postError);
      break;
    default:
      postError('SCHEMA_MISMATCH', `Unknown host.layer.* event: ${type}`);
  }
  return true;
}

/** Expose resolved sync groups for tests (same as chart `applyTimeScaleSyncFromLayers`). */
export function resolvePaneSyncGroupsForBridge(
  layers: LayerBridgePreset['layers'],
  pageId?: string,
) {
  return resolvePaneSyncGroupsFromLayers(layers, pageId);
}