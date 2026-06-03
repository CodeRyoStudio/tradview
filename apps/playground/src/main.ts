import { createChart, createDemoChartOptions, type IChart } from '@coderyo/core';
import { createGatewayDataProvider, createPassthroughSymbolResolver } from '@coderyo/data';
import { EXTENDED_INTERVALS, type Interval } from '@coderyo/data';
import { bindChartKeyboard } from '@coderyo/interaction';
import { t } from '@coderyo/i18n';
import {
  loadIndicatorConfig,
  loadReturnToCursorPreference,
  loadShowGridPreference,
  createDemoLayoutOptions,
  mountChartLayout,
  mountCodeSnippetPanel,
  mountPineEditorPanel,
  loadPineScriptPreference,
  openDrawingContextMenu,
  saveIndicatorConfig,
  type DrawingToolId,
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
let theme: 'dark' | 'light' = 'dark';
let logScale = false;
let lastSymbol = 'BINANCE:BTCUSDT';
let lastInterval: Interval = '1h';
let indicatorConfig = loadIndicatorConfig(lastSymbol, lastInterval);

const symbolResolver = createPassthroughSymbolResolver((q) =>
  provider.searchSymbols?.(q) ?? Promise.resolve([]),
);

const shellOpts = createDemoLayoutOptions({
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
      saveIndicatorConfig(lastSymbol, lastInterval, cfg);
      chartRef.current?.setIndicatorConfig(cfg);
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

let bindDrawingProps: ((d: import('@coderyo/drawings').DrawingRecord | null) => void) | null =
  null;

shellOpts.onDrawingSelectionBind = (bind) => {
  bindDrawingProps = bind;
};

const {
  chartHost,
  indicatorHost,
  statusBar,
  crosshairLegend,
  setActiveDrawingTool,
  propertiesPanel,
  setActiveInterval,
} = mountChartLayout(app, shellOpts);

const chart = createChart(
  chartHost,
  createDemoChartOptions({
    dataProvider: provider,
    symbolResolver,
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

const initialPineScript = loadPineScriptPreference() ?? PINE_EDITOR_DEFAULT;
chart.setFeatures({ pineEnabled: true, pineScript: initialPineScript });

const updateShellMeta = () => {
  statusBar.update({ interval: lastInterval, symbol: lastSymbol });
  crosshairLegend.setMeta({ symbol: lastSymbol, interval: lastInterval });
};

shellOpts.onIntervalChange = (interval) => {
  lastInterval = interval;
  indicatorConfig = loadIndicatorConfig(lastSymbol, lastInterval);
  shellOpts.settings!.indicatorConfig = indicatorConfig;
  chart.setInterval(interval);
  chart.setIndicatorConfig(indicatorConfig);
  updateShellMeta();
};

shellOpts.onThemeToggle = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
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
import { createGatewayDataProvider } from '@coderyo/data';

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
  errorEl.textContent = err instanceof Error ? err.message : String(err);
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
  toggleTheme: () => shellOpts.onThemeToggle?.(),
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
  bindDrawingProps?.(p?.record ?? null);
  propertiesPanel.bind(p?.record ?? null);
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
  indicatorConfig = loadIndicatorConfig(lastSymbol, lastInterval);
  chart.setIndicatorConfig(indicatorConfig);
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
  saveIndicatorConfig(lastSymbol, lastInterval, indicatorConfig);
});

chart.on('error', (err) => showError(err));

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