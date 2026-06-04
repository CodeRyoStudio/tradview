import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as UiShell from '../src/index.js';

/** Runtime root export allowlist (@coderyo/ui-shell). */
const PUBLIC_UI_SHELL_VALUE_EXPORTS = [
  'BUILTIN_PRESETS',
  'CHART_PANE_LAYER_TYPES',
  'DEFAULT_LAYOUT_FEATURES',
  'DEFAULT_LAYOUT_SCHEMA',
  'DEFAULT_SYNC_TIME_SCALE_GROUP',
  'GRID_SETTING_KEY',
  'LAYER_PRESET_VERSION',
  'LAYOUT_SCHEMA_VERSION',
  'LayerController',
  'PINE_SCRIPT_STORAGE_KEY',
  'RETURN_CURSOR_KEY',
  'THEME_STORAGE_KEY',
  'VENDOR_COMPACT_PRESET',
  'VENDOR_DUAL_SYNC_PRESET',
  'VENDOR_DEFAULT_PRESET',
  'applyCompositorShellFeatures',
  'applyThemeToDocument',
  'attachChartContextMenu',
  'attachLayerEditor',
  'bindLayerTimeScaleSync',
  'createLayerBridgeRegistration',
  'wrapLayerController',
  'bindShortcutsModal',
  'clampBBox',
  'clampFrame',
  'cloneLayoutPreset',
  'cloneLayoutSchema',
  'createDemoLayoutOptions',
  'createI18nProvider',
  'createLayoutGrid',
  'createSymbolSearchDialog',
  'createThemeProvider',
  'deleteUserPreset',
  'expandLegacyChartHostLayers',
  'forkPreset',
  'getDrawingOverlayVisible',
  'getBuiltinPreset',
  'getLayersBoundingBox',
  'getWidgetPlacement',
  'isChartPaneLayerType',
  'layoutSchemaToPreset',
  'layoutStorageKey',
  'listPresets',
  'loadIndicatorConfig',
  'loadLayoutSchema',
  'loadPineScriptPreference',
  'loadPreset',
  'loadReturnToCursorPreference',
  'loadShowGridPreference',
  'loadTheme',
  'mergeLayoutFeatures',
  'mergeLayoutPreset',
  'mountChartLayout',
  'mountCodeSnippetPanel',
  'mountCrosshairLegend',
  'mountDrawingPropertiesPanel',
  'mountLayerCompositor',
  'mountLayerPanel',
  'mountPageNavigator',
  'createCompositorShell',
  'isOverlayLayerType',
  'OVERLAY_LAYER_TYPES',
  'syncOverlayLayersToMain',
  'ensureOverlayLayers',
  'mountLogoSlot',
  'mountPineEditorPanel',
  'mountSettingsMenu',
  'mountSettingsPanel',
  'mountStatusBar',
  'mountSymbolSearch',
  'mountSymbolSearchDialogTrigger',
  'mountThemeToggle',
  'mountTopBar',
  'moveLayerFrames',
  'normalizeLayoutPreset',
  'normalizeLayoutSchema',
  'openDrawingContextMenu',
  'openShortcutsModal',
  'paneIdFromWidgetKey',
  'pineLanguage',
  'presetStorageKey',
  'resizeGroupFrames',
  'resolveLayoutFeatures',
  'resolveLayoutSchema',
  'resolvePaneLayerIds',
  'resolvePreset',
  'isValidBridgeLayerPane',
  'layerTypeForBridgePane',
  'saveIndicatorConfig',
  'saveLayoutSchema',
  'savePineScriptPreference',
  'savePreset',
  'saveReturnToCursorPreference',
  'saveShowGridPreference',
  'saveTheme',
  'splitLegacyChartHost',
  'syncAllOverlayLayersToMain',
  'syncCompositorShellVisibilityFromFeatures',
  'syncCrosshairLegendToMain',
  'upgradeIndicatorHostType',
  'widgetKeyForChartPaneType',
] as const;

describe('@coderyo/ui-shell public exports', () => {
  it('package.json exposes only root entry', () => {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
        'utf8',
      ),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(pkg.exports).sort()).toEqual(['.']);
  });

  it('index runtime exports match allowlist', () => {
    expect(Object.keys(UiShell).sort()).toEqual([...PUBLIC_UI_SHELL_VALUE_EXPORTS].sort());
  });

  it('exports frozen preset store symbols', () => {
    expect(typeof UiShell.forkPreset).toBe('function');
    expect(typeof UiShell.resolvePreset).toBe('function');
    expect(typeof UiShell.deleteUserPreset).toBe('function');
  });

  it('mountChartLayout return type documents compositor helpers', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/chart-layout.ts'),
      'utf8',
    );
    expect(src).toContain('handleDrawingSelection');
    expect(src).toContain('syncCompositorShellVisibility');
    expect(src).toContain('bindLayerCompositorController');
    expect(src).toContain('layerCompositorManaged');
  });
});