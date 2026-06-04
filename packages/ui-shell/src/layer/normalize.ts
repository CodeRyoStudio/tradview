import {
  splitLegacyChartHost,
  upgradeIndicatorHostType,
} from './chart-pane-mount.js';
import { ensureOverlayLayers, syncAllOverlayLayersToMain } from './overlay-mount.js';
import {
  LAYER_PRESET_VERSION,
  type BindGroup,
  type LayerFrame,
  type LayerNode,
  type LayerType,
  type LayoutPage,
  type LayoutPreset,
} from './types.js';

const SHELL_TYPES: LayerType[] = [
  'shell.topBar',
  'shell.leftToolbar',
  'shell.bottomToolbar',
  'shell.statusBar',
  'shell.propertiesPanel',
];

const CHART_TYPES: LayerType[] = [
  'chart.host',
  'chart.main',
  'chart.volume',
  'chart.indicator',
  'chart.indicatorHost',
];

const OVERLAY_TYPES: LayerType[] = ['overlay.crosshairLegend', 'overlay.drawing'];

function isLayerType(t: string): t is LayerType {
  return (
    SHELL_TYPES.includes(t as LayerType) ||
    CHART_TYPES.includes(t as LayerType) ||
    OVERLAY_TYPES.includes(t as LayerType) ||
    t === 'group'
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clampFrame(frame: LayerFrame): LayerFrame {
  const w = Math.min(1, Math.max(0.02, clamp01(frame.w)));
  const h = Math.min(1, Math.max(0.02, clamp01(frame.h)));
  const x = clamp01(frame.x);
  const y = clamp01(frame.y);
  return {
    x: Math.min(x, 1 - w),
    y: Math.min(y, 1 - h),
    w,
    h,
  };
}

export function normalizeLayoutPreset(input: LayoutPreset): LayoutPreset {
  const pages: LayoutPage[] =
    input.pages?.length > 0
      ? input.pages.map((p) => ({
          id: String(p.id || 'page-1'),
          title: String(p.title || 'Page 1'),
        }))
      : [{ id: 'page-1', title: '圖表' }];

  const pageIds = new Set(pages.map((p) => p.id));
  const defaultPageId = pages[0]!.id;

  const layers: LayerNode[] = [];
  const seenLayer = new Set<string>();

  for (const raw of input.layers ?? []) {
    if (!raw?.id || seenLayer.has(raw.id)) continue;
    if (!isLayerType(raw.type)) continue;
    seenLayer.add(raw.id);
    const pageId = pageIds.has(raw.pageId) ? raw.pageId : defaultPageId;
    layers.push({
      id: raw.id,
      pageId,
      type: raw.type,
      widgetKey: String(raw.widgetKey || raw.id),
      frame: clampFrame(raw.frame ?? { x: 0, y: 0, w: 1, h: 1 }),
      zIndex: Math.round(Number.isFinite(raw.zIndex) ? raw.zIndex : 0),
      visible: raw.visible !== false,
      locked: raw.locked === true,
      groupId: raw.groupId,
      syncTimeScaleGroupId: raw.syncTimeScaleGroupId,
    });
  }

  const { layers: splitLayers, idRemap } = splitLegacyChartHost(layers);
  let migrated = upgradeIndicatorHostType(splitLayers);
  for (const pageId of pageIds) {
    migrated = ensureOverlayLayers(migrated, pageId);
  }
  syncAllOverlayLayersToMain(migrated);

  migrated.sort((a, b) => a.zIndex - b.zIndex);
  migrated.forEach((l, i) => {
    l.zIndex = i;
  });

  const migratedIds = new Set(migrated.map((l) => l.id));

  const groups: BindGroup[] = [];
  const seenGroup = new Set<string>();
  for (const g of input.groups ?? []) {
    if (!g?.id || seenGroup.has(g.id)) continue;
    seenGroup.add(g.id);
    const layerIds = (g.layerIds ?? [])
      .flatMap((id) => idRemap.get(id) ?? [id])
      .filter((id) => migratedIds.has(id));
    if (layerIds.length === 0) continue;
    groups.push({
      id: g.id,
      name: g.name,
      layerIds,
    });
  }

  return {
    version: LAYER_PRESET_VERSION,
    id: String(input.id || 'unnamed'),
    name: String(input.name || input.id || 'Untitled'),
    author: input.author === 'user' ? 'user' : 'integrator',
    readonly: input.readonly === true,
    forkedFrom: input.forkedFrom,
    pages,
    layers: migrated,
    groups,
  };
}

export function cloneLayoutPreset(preset: LayoutPreset): LayoutPreset {
  return normalizeLayoutPreset({
    ...preset,
    pages: preset.pages.map((p) => ({ ...p })),
    layers: preset.layers.map((l) => ({ ...l, frame: { ...l.frame } })),
    groups: preset.groups.map((g) => ({ ...g, layerIds: [...g.layerIds] })),
  });
}