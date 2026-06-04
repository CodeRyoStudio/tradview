import { getBuiltinPreset, BUILTIN_PRESETS } from './default-presets.js';
import { cloneLayoutPreset, normalizeLayoutPreset } from './normalize.js';
import type { LayoutPreset } from './types.js';

const INDEX_KEY = 'tradview:preset:v2:index';

export function presetStorageKey(id: string): string {
  return `tradview:preset:v2:${id}`;
}

export interface PresetListEntry {
  id: string;
  name: string;
  author: LayoutPreset['author'];
  readonly?: boolean;
  builtin?: boolean;
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore */
  }
}

export function listPresets(): PresetListEntry[] {
  const out: PresetListEntry[] = BUILTIN_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    author: p.author,
    readonly: p.readonly,
    builtin: true,
  }));

  for (const id of readIndex()) {
    if (BUILTIN_PRESETS.some((p) => p.id === id)) continue;
    const loaded = loadPreset(id);
    if (loaded) {
      out.push({
        id: loaded.id,
        name: loaded.name,
        author: loaded.author,
        readonly: loaded.readonly,
        builtin: false,
      });
    }
  }
  return out;
}

export function loadPreset(id: string): LayoutPreset | null {
  const builtin = getBuiltinPreset(id);
  if (builtin) return cloneLayoutPreset(builtin);

  try {
    const raw = localStorage.getItem(presetStorageKey(id));
    if (!raw) return null;
    return normalizeLayoutPreset(JSON.parse(raw) as LayoutPreset);
  } catch {
    return null;
  }
}

export function savePreset(preset: LayoutPreset): void {
  const normalized = normalizeLayoutPreset(preset);
  if (getBuiltinPreset(normalized.id)) {
    throw new Error(`Cannot overwrite builtin preset: ${normalized.id}`);
  }
  try {
    localStorage.setItem(presetStorageKey(normalized.id), JSON.stringify(normalized));
    const ids = readIndex();
    if (!ids.includes(normalized.id)) {
      writeIndex([...ids, normalized.id]);
    }
  } catch {
    /* ignore */
  }
}

export function deleteUserPreset(id: string): boolean {
  if (getBuiltinPreset(id)) return false;
  try {
    localStorage.removeItem(presetStorageKey(id));
    writeIndex(readIndex().filter((x) => x !== id));
    return true;
  } catch {
    return false;
  }
}

export function forkPreset(
  sourceId: string,
  newId: string,
  newName: string,
): LayoutPreset | null {
  const src = loadPreset(sourceId);
  if (!src) return null;
  const forked = normalizeLayoutPreset({
    ...cloneLayoutPreset(src),
    id: newId,
    name: newName,
    author: 'user',
    readonly: false,
    forkedFrom: sourceId,
  });
  savePreset(forked);
  return forked;
}

export function resolvePreset(id: string | LayoutPreset | null | undefined): LayoutPreset {
  if (id && typeof id === 'object') return normalizeLayoutPreset(id);
  if (typeof id === 'string') {
    const loaded = loadPreset(id);
    if (loaded) return loaded;
  }
  return cloneLayoutPreset(getBuiltinPreset('vendor-default')!);
}