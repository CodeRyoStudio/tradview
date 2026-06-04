import {
  createChart,
  createDemoChartOptions,
  type ChartController,
  type IChart,
} from '@coderyo/core';
import { mountBridgeDebugPanel } from './bridge-debug-panel.js';
import { createGatewayDataProvider } from '@coderyo/data/client';
import { createPassthroughSymbolResolver } from '@coderyo/data';
import { EXTENDED_INTERVALS, type Interval } from '@coderyo/data';
import { bindChartKeyboard } from '@coderyo/interaction';
import { t } from '@coderyo/i18n';
import {
  loadIndicatorConfig,
  loadReturnToCursorPreference,
  loadShowGridPreference,
  createDemoLayoutOptions,
  createI18nProvider,
  createThemeProvider,
  loadTheme,
  mountChartLayout,
  mountCodeSnippetPanel,
  mountPineEditorPanel,
  loadPineScriptPreference,
  openDrawingContextMenu,
  type DrawingToolId,
  listPresets,
  loadPreset,
  savePreset,
  forkPreset,
  resolvePreset,
  getBuiltinPreset,
  bindLayerTimeScaleSync,
  mountLayerCompositor,
  mountLayerPanel,
  mountPageNavigator,
} from '@coderyo/ui-shell';
import type { IndicatorConfig } from '@coderyo/indicators';
import { PINE_EDITOR_DEFAULT } from '@coderyo/core';

const app = document.getElementById('app')!;
const errorEl = document.getElementById('demo-error')!;
const urlEl = document.getElementById('demo-url')!;

urlEl.textContent = location.origin;

const provider = createGatewayDataProvider({
  restBaseUrl: '',
  wsUrl: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`,
});

const chartRef: { current: IChart | null } = { current: null };

let drawingTool: DrawingToolId = 'cursor';
let showGrid = loadShowGridPreference();
let returnToCursor = loadReturnToCursorPreference();
const themeProvider = createThemeProvider(loadTheme());
const i18n = createI18nProvider('zh-TW');
let theme: 'dark' | 'light' = themeProvider.getTheme();
let logScale = false;
let lastSymbol = 'BINANCE:BTCUSDT';
let lastInterval: Interval = '1h';
let indicatorConfig = loadIndicatorConfig(lastSymbol, lastInterval);

const symbolResolver = createPassthroughSymbolResolver((q) =>
  provider.searchSymbols?.(q) ?? Promise.resolve([]),
);

const shellOpts = createDemoLayoutOptions({
  layerCompositorManaged: true,
  themeProvider,
  i18n,
  intervals: EXTENDED_INTERVALS,
  activeDrawingTool: drawingTool,
  onDrawingToolSelect: (tool) => {
    drawingTool = tool;
    chartRef.current?.setDrawingTool(tool);
  },
  onDrawingStyleChange: (patch) => chartRef.current?.updateSelectedDrawingStyle(patch),
  initialSymbol: lastSymbol,
  onSymbolSearch: (q) => symbolResolver.search?.(q) ?? Promise.resolve([]),
  onSymbolSelect: (symbol) => {
    chartRef.current?.setSymbol(symbol);
  },
  settings: {
    showGrid,
    returnToCursorAfterDraw: returnToCursor,
    indicatorConfig,
    onShowGridChange: (next) => {
      showGrid = next;
      chartRef.current?.setShowGrid(next);
    },
    onReturnToCursorChange: (v) => {
      returnToCursor = v;
      chartRef.current?.setReturnToCursorAfterDraw(v);
    },
    onIndicatorConfigChange: (cfg) => {
      indicatorConfig = cfg;
      chartRef.current?.setIndicatorConfig(cfg);
    },
    onClearAllIndicators: () => {
      const cfg = chartRef.current?.clearAllIndicators();
      if (!cfg) return;
      indicatorConfig = cfg;
      shellOpts.settings!.indicatorConfig = cfg;
    },
    onClearAllDrawings: () => {
      chartRef.current?.clearAllDrawings();
      chartRef.current?.deselectDrawing();
    },
  },
  activeInterval: lastInterval,
  statusBar: {
    connection: 'connecting',
    symbol: lastSymbol,
    interval: lastInterval,
  },
  contextMenuActions: [
    {
      id: 'fit',
      label: t('context.fitContent', '適配畫面'),
      onClick: () => chartRef.current?.fitContent(),
    },
    {
      id: 'realtime',
      label: t('context.scrollRealtime', '跳到最新'),
      onClick: () => chartRef.current?.scrollToRealtime(),
    },
    {
      id: 'shot',
      label: t('context.screenshot', '截圖'),
      onClick: () => shellOpts.onScreenshot?.(),
    },
  ],
  symbolInput: 'search',
});

const LAYER_PRESET_ACTIVE_KEY = 'tradview:preset:v2:active';

const {
  layoutRoot,
  layoutGrid,
  chartMain,
  chartVolume,
  indicatorHost,
  topBar,
  statusBar,
  crosshairLegend,
  setActiveDrawingTool,
  handleDrawingSelection,
  syncCompositorShellVisibility,
  bindLayerCompositorController,
  drawingOverlay,
  setActiveInterval,
} = mountChartLayout(app, shellOpts);
void layoutWidgetEl('propertiesPanel');

function layoutWidgetEl(widgetId: string): HTMLElement | undefined {
  const cell = app.querySelector(`[data-widget-id="${widgetId}"]`);
  return (cell?.firstElementChild ?? undefined) as HTMLElement | undefined;
}

const chart = createChart(
  chartMain,
  createDemoChartOptions({
    dataProvider: provider,
    symbolResolver,
    volumeMount: chartVolume,
    indicatorHost,
    symbol: lastSymbol,
    interval: lastInterval,
    theme,
    showGrid,
    indicatorConfig,
    returnToCursorAfterDraw: returnToCursor,
  }),
);
chartRef.current = chart;
const syncChartLayout = () => {
  chart.setChartPaneResizeFocus('all');
  chart.resize();
};

const syncChartAfterLayout = (fitIfEmpty = false) => {
  syncChartLayout();
  if (fitIfEmpty && !chart.getVisibleRange()) chart.fitContent();
};
requestAnimationFrame(() => requestAnimationFrame(() => syncChartAfterLayout(true)));

let activePresetId = localStorage.getItem(LAYER_PRESET_ACTIVE_KEY) ?? 'vendor-default';

let presetSaveTimer: ReturnType<typeof setTimeout> | null = null;

function clearPresetSaveTimer(): void {
  if (presetSaveTimer) {
    clearTimeout(presetSaveTimer);
    presetSaveTimer = null;
  }
}

function schedulePresetSave(presetId: string): void {
  if (getBuiltinPreset(presetId)) return;
  clearPresetSaveTimer();
  presetSaveTimer = setTimeout(() => {
    presetSaveTimer = null;
    if (getBuiltinPreset(activePresetId) || presetId !== activePresetId) return;
    savePreset({
      ...layerCompositor.controller.getPreset(),
      id: activePresetId,
      author: 'user',
    });
  }, 500);
}

const panelRef: { current: ReturnType<typeof mountLayerPanel> | null } = { current: null };

let layerCompositor!: ReturnType<typeof mountLayerCompositor>;

layerCompositor = mountLayerCompositor(layoutRoot, {
  preset: resolvePreset(activePresetId),
  hideLegacyGrid: layoutGrid,
  widgets: {
    topBar,
    leftToolbar: layoutWidgetEl('leftToolbar'),
    bottomToolbar: layoutWidgetEl('bottomToolbar'),
    chartMain,
    chartVolume,
    chartIndicator: layoutWidgetEl('indicatorHost') ?? indicatorHost,
    statusBar: statusBar.el,
    propertiesPanel: layoutWidgetEl('propertiesPanel'),
    crosshairLegend: crosshairLegend.el,
    drawingOverlay,
  },
  onPresetChange: () => {
    schedulePresetSave(activePresetId);
  },
  onMarqueeSelect: (ids) => panelRef.current?.selectLayers(ids),
  onChartPaneFocus: (pane) => {
    if (pane) chart.setChartPaneResizeFocus(pane);
  },
});

bindLayerTimeScaleSync(chart, layerCompositor.controller, {
  onSync: () => requestAnimationFrame(() => syncChartAfterLayout()),
});

const layerPanel = mountLayerPanel(document.body, layerCompositor.controller, {
  onSaveAsPreset: (preset) => {
    const name = window.prompt(t('layer.fork.name', '新範本名稱'), `${preset.name} (我的)`);
    if (!name?.trim()) return;
    clearPresetSaveTimer();
    const id = `user-${Date.now()}`;
    const forked = forkPreset(activePresetId, id, name.trim());
    if (!forked) return;
    activePresetId = id;
    localStorage.setItem(LAYER_PRESET_ACTIVE_KEY, id);
    if (!layerCompositor.controller.setPreset(forked)) return;
    refreshPresetSelect();
    requestAnimationFrame(() => syncChartAfterLayout());
  },
});
panelRef.current = layerPanel;

bindLayerCompositorController?.(layerCompositor.controller);

const syncShellCompositorVisibility = () => {
  syncCompositorShellVisibility?.(layerCompositor.controller);
};

mountBridgeDebugPanel(document.body, {
  chart,
  controller: {
    getContainer: () => chartMain,
    getSymbol: () => lastSymbol,
    getInterval: () => lastInterval,
  } as ChartController,
  layerController: layerCompositor.controller,
  compositorApply: () => layerCompositor.apply(),
  syncCompositorShellVisibility: () => syncShellCompositorVisibility(),
  chartId: 'default',
});

const footerEl = document.getElementById('demo-footer')!;
const presetLabel = document.createElement('label');
presetLabel.style.cssText = 'display:flex;align-items:center;gap:6px;';
const presetSelect = document.createElement('select');
presetSelect.style.cssText =
  'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;font-size:11px;padding:2px 6px;';
presetLabel.append(document.createTextNode(t('layer.preset.label', '版面範本')), presetSelect);

const layerBtn = document.createElement('button');
layerBtn.type = 'button';
layerBtn.textContent = t('layer.panel.open', '圖層');
layerBtn.style.cssText =
  'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;font-size:11px;padding:2px 8px;cursor:pointer;';

const editLayoutBtn = document.createElement('button');
editLayoutBtn.type = 'button';
editLayoutBtn.textContent = t('layer.editLayout', '編輯版面');
const editBtnBaseStyle =
  'color:#e6edf3;border:1px solid #30363d;border-radius:4px;font-size:11px;padding:2px 8px;cursor:pointer;';
editLayoutBtn.style.cssText = `background:#21262d;${editBtnBaseStyle}`;

const LAYER_EDIT_KEY = 'tradview:layer-edit';
const urlEdit =
  new URLSearchParams(location.search).get('edit') === '1' ||
  new URLSearchParams(location.search).get('layerEdit') === '1';
let layoutEditMode =
  urlEdit || localStorage.getItem(LAYER_EDIT_KEY) === '1';
const syncEditLayoutBtn = () => {
  editLayoutBtn.style.background = layoutEditMode ? '#238636' : '#21262d';
  editLayoutBtn.setAttribute('aria-pressed', String(layoutEditMode));
};
const applyLayoutEditMode = () => {
  layerCompositor.enableLayerEditor(layoutEditMode);
  localStorage.setItem(LAYER_EDIT_KEY, layoutEditMode ? '1' : '0');
  syncEditLayoutBtn();
};
editLayoutBtn.onclick = () => {
  layoutEditMode = !layoutEditMode;
  applyLayoutEditMode();
};
applyLayoutEditMode();

layerBtn.onclick = () => layerPanel.toggle();

footerEl.append(presetLabel, layerBtn, editLayoutBtn);

const syncDrawingOverlayFromLayer = () => {
  const drawing = layerCompositor.controller
    .getLayersForActivePage()
    .find((l) => l.type === 'overlay.drawing');
  if (drawing) {
    chart.setFeatures({ drawings: { layer: drawing.visible } });
  }
};

mountPageNavigator(footerEl, layerCompositor.controller, {
  onPageChange: () => {
    syncShellCompositorVisibility();
    syncDrawingOverlayFromLayer();
  },
});

layerCompositor.controller.subscribe(syncDrawingOverlayFromLayer);
syncDrawingOverlayFromLayer();

function refreshPresetSelect(): void {
  const entries = listPresets();
  presetSelect.replaceChildren();
  for (const e of entries) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.builtin ? `${e.name} ★` : e.name;
    if (e.id === activePresetId) opt.selected = true;
    presetSelect.appendChild(opt);
  }
}

refreshPresetSelect();
presetSelect.onchange = () => {
  clearPresetSaveTimer();
  activePresetId = presetSelect.value;
  localStorage.setItem(LAYER_PRESET_ACTIVE_KEY, activePresetId);
  const preset = loadPreset(activePresetId);
  if (!preset) return;
  if (!layerCompositor.controller.setPreset(preset)) {
    console.warn('[tradview] setPreset rejected (interaction in progress); retrying next frame');
    requestAnimationFrame(() => {
      if (layerCompositor.controller.setPreset(preset)) syncChartAfterLayout();
    });
    return;
  }
  requestAnimationFrame(() => syncChartAfterLayout());
};

const initialPineScript = loadPineScriptPreference() ?? PINE_EDITOR_DEFAULT;
chart.setFeatures({ pineEnabled: true, pineScript: initialPineScript });

const updateShellMeta = () => {
  statusBar.update({ interval: lastInterval, symbol: lastSymbol });
  crosshairLegend.setMeta({ symbol: lastSymbol, interval: lastInterval });
};

shellOpts.onIntervalChange = (interval) => {
  lastInterval = interval;
  void chart.setInterval(interval);
  updateShellMeta();
};

shellOpts.onThemeChange = (next) => {
  theme = next;
  chart.setTheme(theme);
  document.body.style.background = theme === 'dark' ? '#0d1117' : '#f6f8fa';
  document.body.style.color = theme === 'dark' ? '#e6edf3' : '#24292f';
};

shellOpts.onFullscreen = () => chart.setFullscreen(true);
shellOpts.onScreenshot = () => {
  void chart.exportImage({ pixelRatio: 2 }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradview-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

mountPineEditorPanel(document.body, {
  initialScript: initialPineScript,
  onApply: (script, ok) => {
    if (!ok) return;
    chart.setFeatures({ pineEnabled: true, pineScript: script });
  },
});

mountCodeSnippetPanel(document.body, () =>
  `import { createChart } from '@coderyo/core';
import { createGatewayDataProvider } from '@coderyo/data/client';

const chart = createChart(document.getElementById('chart'), {
  dataProvider: createGatewayDataProvider({
    restBaseUrl: '${location.origin}/api',
    wsUrl: '${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0',
  }),
  symbol: '${lastSymbol}',
  interval: '${lastInterval}',
  showGrid: ${showGrid},
  drawingDefaults: { returnToCursorAfterDraw: ${returnToCursor} },
  // showCrosshairLegend: true (layout)
  // showStatusBar: false (layout, integrator debug)
});`,
);

function showError(err: unknown) {
  errorEl.style.display = 'block';
  if (err instanceof Error) {
    errorEl.textContent = err.message;
    return;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    errorEl.textContent = String((err as { message: unknown }).message);
    return;
  }
  errorEl.textContent = String(err);
}

bindChartKeyboard({
  fitContent: () => chart.fitContent(),
  scrollToRealtime: () => chart.scrollToRealtime(),
  toggleFullscreen: () => chart.setFullscreen(true),
  exportImage: () => shellOpts.onScreenshot?.(),
  toggleLogScale: () => {
    logScale = !logScale;
    chart.setLogScale(logScale);
  },
  toggleTheme: () => {
    const next = themeProvider.toggle();
    shellOpts.onThemeChange?.(next);
  },
  selectCursorTool: () => {
    chart.setDrawingTool('cursor');
    setActiveDrawingTool('cursor');
  },
  deleteSelectedDrawing: () => chart.deleteSelectedDrawing(),
});

chart.on('requestCursorTool', () => {
  setActiveDrawingTool('cursor');
  drawingTool = 'cursor';
});

chart.on('drawingSelectionChange', (payload) => {
  const p = payload as { record?: import('@coderyo/drawings').DrawingRecord | null };
  handleDrawingSelection(p?.record ?? null);
});

chart.on('drawingContextMenu', (payload) => {
  const p = payload as {
    clientX: number;
    clientY: number;
    drawing: import('@coderyo/drawings').DrawingRecord | null;
  };
  openDrawingContextMenu(p.clientX, p.clientY, p.drawing, {
    onDelete: () => chart.deleteSelectedDrawing(),
    onCopy: () => chart.copySelectedDrawing(),
    onToggleLock: () => chart.toggleLockSelectedDrawing(),
    onDeselect: () => chart.deselectDrawing(),
    onEditText: () => {
      const text = window.prompt(t('drawing.ctx.editText', '編輯文字'), String(p.drawing?.meta?.text ?? ''));
      if (text != null) chart.updateSelectedDrawingStyle({ text });
    },
  });
});

chart.on('connectionChange', (state) => {
  statusBar.update({ connection: String(state ?? 'unknown') });
});

chart.on('crosshairChange', (payload) => {
  const p = payload as {
    time?: number;
    ohlcv?: { o?: number; h?: number; l?: number; c?: number; v?: number };
  } | null;
  if (!p?.ohlcv) {
    crosshairLegend.hide();
    return;
  }
  crosshairLegend.update({ time: p.time, ohlcv: p.ohlcv });
  statusBar.update({ ohlcv: p.ohlcv });
});

chart.on('symbolChange', (info) => {
  const row = info as { symbol?: string; description?: string; exchange?: string };
  lastSymbol = row.symbol ?? lastSymbol;
  const label = row.description
    ? `${lastSymbol} — ${row.description}`
    : row.exchange
      ? `${lastSymbol} · ${row.exchange}`
      : lastSymbol;
  statusBar.update({ symbol: label });
  crosshairLegend.setMeta({ symbol: lastSymbol });
});

chart.on('intervalChange', (iv) => {
  lastInterval = iv as Interval;
  setActiveInterval(lastInterval);
  statusBar.update({ interval: lastInterval });
  crosshairLegend.setMeta({ interval: lastInterval });
});

chart.on('featuresChange', () => {
  const cfg = chart.getFeatures().indicators;
  if (!cfg) return;
  indicatorConfig = cfg as IndicatorConfig;
  if (shellOpts.settings) shellOpts.settings.indicatorConfig = indicatorConfig;
});

chart.on('error', (err) => {
  showError(err);
  console.error('[demo] chart error', err);
});

void provider
  .getHistory({
    mode: 'loadMore',
    symbol: lastSymbol,
    interval: lastInterval,
    endTime: Date.now(),
    limit: 500,
  })
  .then(() => statusBar.update({ connection: 'connected' }))
  .catch((e) => {
    showError(e);
    statusBar.update({ connection: 'error' });
    console.error('[demo] mock unreachable — run: pnpm demo');
  });