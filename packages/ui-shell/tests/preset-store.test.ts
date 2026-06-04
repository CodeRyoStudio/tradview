import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteUserPreset,
  forkPreset,
  listPresets,
  loadPreset,
  presetStorageKey,
  savePreset,
} from '../src/layer/preset-store.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';

const INDEX_KEY = 'tradview:preset:v2:index';

afterEach(() => {
  localStorage.clear();
});

describe('preset-store fork/save', () => {
  it('forkPreset clones builtin preset with new id and persists', () => {
    const forked = forkPreset('vendor-default', 'user-test-1', 'My layout');
    expect(forked).not.toBeNull();
    expect(forked!.id).toBe('user-test-1');
    expect(forked!.name).toBe('My layout');
    expect(forked!.author).toBe('user');
    expect(forked!.forkedFrom).toBe('vendor-default');
    expect(forked!.layers.length).toBe(VENDOR_DEFAULT_PRESET.layers.length);

    const loaded = loadPreset('user-test-1');
    expect(loaded?.name).toBe('My layout');
    expect(listPresets().some((e) => e.id === 'user-test-1')).toBe(true);
  });

  it('savePreset writes index and round-trips', () => {
    const forked = forkPreset('vendor-default', 'user-test-2', 'Round trip');
    expect(forked).not.toBeNull();
    forked!.layers[0]!.visible = false;
    savePreset(forked!);
    const loaded = loadPreset('user-test-2');
    expect(loaded?.layers[0]?.visible).toBe(false);
    expect(localStorage.getItem(presetStorageKey('user-test-2'))).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]')).toContain('user-test-2');
  });

  it('deleteUserPreset removes user entry', () => {
    forkPreset('vendor-default', 'user-del', 'To delete');
    expect(deleteUserPreset('user-del')).toBe(true);
    expect(loadPreset('user-del')).toBeNull();
    expect(listPresets().some((e) => e.id === 'user-del')).toBe(false);
  });

  it('forkPreset returns null for unknown source', () => {
    expect(forkPreset('missing', 'user-x', 'X')).toBeNull();
  });
});