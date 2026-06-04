import type { LayerBridgePreset } from './bridge-layer-wire.js';

function upsertById<T extends { id: string }>(current: T[], incoming: T[] | undefined): T[] {
  if (!incoming?.length) return current.map((x) => ({ ...x }));
  const map = new Map(current.map((x) => [x.id, { ...x }]));
  for (const item of incoming) {
    if (!item?.id) continue;
    map.set(item.id, { ...item });
  }
  return [...map.values()];
}

function mergeLayers(
  current: LayerBridgePreset['layers'],
  incoming: LayerBridgePreset['layers'] | undefined,
): LayerBridgePreset['layers'] {
  if (!incoming?.length) return current.map((l) => ({ ...l }));
  const map = new Map(current.map((l) => [l.id, { ...l }]));
  for (const raw of incoming) {
    if (!raw?.id) continue;
    const prev = map.get(raw.id);
    map.set(raw.id, { ...(prev ?? raw), ...raw });
  }
  return [...map.values()];
}

function mergeGroups(
  current: LayerBridgePreset['groups'],
  incoming: LayerBridgePreset['groups'] | undefined,
): LayerBridgePreset['groups'] {
  if (!incoming?.length) {
    return current.map((g) => ({ ...g, layerIds: [...(g.layerIds ?? [])] }));
  }
  const map = new Map(
    current.map((g) => [g.id, { ...g, layerIds: [...(g.layerIds ?? [])] }]),
  );
  for (const raw of incoming) {
    if (!raw?.id) continue;
    map.set(raw.id, {
      id: raw.id,
      name: raw.name ?? map.get(raw.id)?.name,
      layerIds: [...(raw.layerIds ?? map.get(raw.id)?.layerIds ?? [])],
    });
  }
  return [...map.values()];
}

/** @public Upsert merge for Bridge `host.layer.setPreset` (`replace: false`). */
export function mergeLayerBridgePreset(
  current: LayerBridgePreset,
  partial: LayerBridgePreset,
): LayerBridgePreset {
  return {
    ...current,
    ...partial,
    pages: upsertById(current.pages, partial.pages),
    layers: mergeLayers(current.layers, partial.layers),
    groups: mergeGroups(current.groups, partial.groups),
  };
}