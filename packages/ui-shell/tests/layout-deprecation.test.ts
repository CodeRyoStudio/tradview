import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountChartLayout } from '../src/chart-layout.js';
import { createLayoutGrid } from '../src/layout-engine.js';
import {
  LEGACY_LAYOUT_WARN_KEYS,
  MIGRATION_LAYOUT_URL,
  resetLegacyLayoutWarningsForTests,
  WARN_MSG_CREATE_LAYOUT_GRID,
  WARN_MSG_MOUNT_LEGACY_GRID,
  warnLegacyLayoutOnce,
} from '../src/layout-deprecation.js';
import { DEFAULT_LAYOUT_FEATURES } from '../src/layout-features.js';
import { DEFAULT_LAYOUT_SCHEMA } from '../src/layout-schema.js';

describe('layout deprecation (PR-L7a)', () => {
  beforeEach(() => {
    resetLegacyLayoutWarningsForTests();
  });

  afterEach(() => {
    resetLegacyLayoutWarningsForTests();
    vi.restoreAllMocks();
  });

  it('warn message constants cite stable migration URL and rc.2', () => {
    for (const msg of [WARN_MSG_CREATE_LAYOUT_GRID, WARN_MSG_MOUNT_LEGACY_GRID]) {
      expect(msg).toContain(MIGRATION_LAYOUT_URL);
      expect(msg).toContain('2.0.0-rc.2');
    }
  });

  it('warnLegacyLayoutOnce fires once per key, not twice', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLegacyLayoutOnce('test-key', 'first');
    warnLegacyLayoutOnce('test-key', 'second');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('first');
  });

  it('warnLegacyLayoutOnce emits once per distinct key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnLegacyLayoutOnce('key-a', 'a');
    warnLegacyLayoutOnce('key-b', 'b');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('createLayoutGrid warns once per session even when called twice', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const widgets = {
      topBar: document.createElement('div'),
      leftToolbar: document.createElement('aside'),
      bottomToolbar: document.createElement('div'),
      chartHost: document.createElement('div'),
      indicatorHost: document.createElement('div'),
      statusBar: document.createElement('div'),
      propertiesPanel: document.createElement('div'),
    };
    const opts = {
      schema: DEFAULT_LAYOUT_SCHEMA,
      features: DEFAULT_LAYOUT_FEATURES,
      widgets,
    };
    const a = createLayoutGrid(opts);
    const b = createLayoutGrid(opts);
    a.root.remove();
    b.root.remove();
    const gridWarns = warn.mock.calls.filter(
      (c) => c[0] === WARN_MSG_CREATE_LAYOUT_GRID,
    );
    expect(gridWarns).toHaveLength(1);
  });

  it('createLayoutGrid with suppressDeprecationWarn emits no warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grid = createLayoutGrid({
      schema: DEFAULT_LAYOUT_SCHEMA,
      features: DEFAULT_LAYOUT_FEATURES,
      suppressDeprecationWarn: true,
      widgets: {
        chartHost: document.createElement('div'),
      },
    });
    grid.root.remove();
    expect(warn).not.toHaveBeenCalled();
  });

  it('mountChartLayout legacy path warns only mount message (nested grid warn suppressed)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mountChartLayout(document.createElement('div'), {
      layerCompositorManaged: false,
      showTopBar: false,
      symbolInput: 'none',
    });
    mountChartLayout(document.createElement('div'), {
      showTopBar: false,
      symbolInput: 'none',
    });

    expect(warn.mock.calls.map((c) => c[0])).toEqual([WARN_MSG_MOUNT_LEGACY_GRID]);
    expect(
      warn.mock.calls.filter((c) => c[0] === WARN_MSG_CREATE_LAYOUT_GRID),
    ).toHaveLength(0);
    expect(LEGACY_LAYOUT_WARN_KEYS.mountChartLayoutLegacyGrid).toBe(
      'mountChartLayout:legacyGrid',
    );
  });

  it('mountChartLayout compositor path does not warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mountChartLayout(document.createElement('div'), {
      layerCompositorManaged: true,
      showTopBar: true,
    });
    mountChartLayout(document.createElement('div'), {
      layerCompositorManaged: true,
      showTopBar: true,
    });

    expect(warn).not.toHaveBeenCalled();
  });
});