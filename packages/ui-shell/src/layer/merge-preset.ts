import { normalizeLayoutPreset } from './normalize.js';
import {
  LAYER_PRESET_VERSION,
  type BindGroup,
  type LayoutPage,
  type LayoutPreset,
  type LayerNode,
} from './types.js';

function upsertById<T extends { id: string }>(current: T[], incoming: T[] | undefined): T[] {
  if (!incoming?.length) return current.map((x) => ({ ...x }));
  const map = new Map(current.map((x) => [x.id, { ...x }]));
  for (const item of incoming) {
    if (!item?.id) continue;
    map.set(item.id, { ...item });
  }
  return [...map.values()];
}

function mergePages(current: LayoutPage[], incoming: LayoutPage[] | undefined): LayoutPage[] {
  return upsertById(current, incoming);
}

function mergeLayers(current: LayerNode[], incoming: LayerNode[] | undefined): LayerNode[] {
  if (!incoming?.length) return current.map((l) => ({ ...l, frame: { ...l.frame } }));
  const map = new Map(current.map((l) => [l.id, { ...l, frame: { ...l.frame } }]));
  for (const raw of incoming) {
    if (!raw?.id) continue;
    const prev = map.get(raw.id);
    map.set(raw.id, {
      ...(prev ?? raw),
      ...raw,
      frame: { ...(prev?.frame ?? raw.frame ?? { x: 0, y: 0, w: 1, h: 1 }) },
    });
  }
  return [...map.values()];
}

function mergeGroups(current: BindGroup[], incoming: BindGroup[] | undefined): BindGroup[] {
  if (!incoming?.length) {
    return current.map((g) => ({ ...g, layerIds: [...g.layerIds] }));
  }
  const map = new Map(current.map((g) => [g.id, { ...g, layerIds: [...g.layerIds] }]));
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

/**
 * @public Merge partial LayoutPreset v2 into `current` (pages/layers/groups upsert by id).
 * Unmentioned entries are preserved. Result is normalized.
 */
export function mergeLayoutPreset(current: LayoutPreset, partial: LayoutPreset): LayoutPreset {
  return normalizeLayoutPreset({
    ...current,
    ...partial,
    version: LAYER_PRESET_VERSION,
    pages: mergePages(current.pages, partial.pages),
    layers: mergeLayers(current.layers, partial.layers),
    groups: mergeGroups(current.groups, partial.groups),
  });
}