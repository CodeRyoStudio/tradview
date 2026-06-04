/** Layer fields used to map layout preset chart panes → renderer sync groups. */
export type LayerSyncInput = {
  type: string;
  pageId?: string;
  syncTimeScaleGroupId?: string;
};

/** Per-pane patch: `string` = shared group; `null` = independent; `undefined` = pane absent on scope. */
export type PaneSyncGroupPatch = {
  main?: string | null;
  volume?: string | null;
  indicator?: string | null;
};

function resolvePaneSyncId(layer: LayerSyncInput | undefined): string | null | undefined {
  if (layer == null) return undefined;
  const raw = layer.syncTimeScaleGroupId;
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve pane sync group ids from layout layers.
 * When `pageId` is set, only layers on that page are considered (multi-page presets).
 */
export function resolvePaneSyncGroupsFromLayers(
  layers: LayerSyncInput[],
  pageId?: string,
): PaneSyncGroupPatch {
  const scoped = pageId != null ? layers.filter((l) => l.pageId === pageId) : layers;
  const pick = (type: string) => scoped.find((l) => l.type === type);
  return {
    main: resolvePaneSyncId(pick('chart.main')),
    volume: resolvePaneSyncId(pick('chart.volume')),
    indicator: resolvePaneSyncId(pick('chart.indicator')),
  };
}