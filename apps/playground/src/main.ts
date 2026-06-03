import { createChart, type IChart } from '@tradview/core';
import { createGatewayDataProvider, createPassthroughSymbolResolver } from '@tradview/data';
import { bindChartKeyboard } from '@tradview/interaction';
import { t } from '@tradview/i18n';
import type { Interval } from '@tradview/data';
import {
  loadShowGridPreference,
  mountChartLayout,
  type ChartLayoutOptions,
  type DrawingToolId,
} from '@tradview/ui-shell';

const app = document.getElementById('app')!;
const errorEl = document.getElementById('demo-error')!;
const urlEl = document.getElementById('demo-url')!;

urlEl.textContent = location.origin;

const restBase = '';
const wsBase = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`;

const provider = createGatewayDataProvider({
  restBaseUrl: restBase,
  wsUrl: wsBase,
});

const chartRef: { current: IChart | null } = { current: null };

let drawingTool: DrawingToolId = 'cursor';
let showGrid = loadShowGridPreference();
let theme: 'dark' | 'light' = 'dark';
let logScale = false;
let barCount = 0;
let lastSymbol = 'BINANCE:BTCUSDT';
let lastInterval: Interval = '1h';

const symbolResolver = createPassthroughSymbolResolver((q) =>
  provider.searchSymbols?.(q) ?? Promise.resolve([]),
);

const shellOpts: ChartLayoutOptions = {
  showLeftToolbar: true,
  activeDrawingTool: drawingTool,
  onDrawingToolSelect: (tool) => {
    drawingTool = tool;
    shellOpts.activeDrawingTool = tool;
    chartRef.current?.setDrawingTool(tool);
  },
  initialSymbol: lastSymbol,
  onSymbolSearch: (q) => symbolResolver.search?.(q) ?? Promise.resolve([]),
  onSymbolSelect: (symbol) => {
    chartRef.current?.setSymbol(symbol);
  },
  settings: {
    showGrid,
    onShowGridChange: (next) => {
      showGrid = next;
      chartRef.current?.setShowGrid(next);
    },
  },
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
};

const { chartHost, indicatorHost, statusBar, crosshairLegend, setActiveDrawingTool } =
  mountChartLayout(app, shellOpts);

const chart = createChart(chartHost, {
  dataProvider: provider,
  symbolResolver,
  indicatorHost,
  symbol: lastSymbol,
  interval: lastInterval,
  theme,
  scaleMode: 'linear',
  showGrid,
});
chartRef.current = chart;

function showError(err: unknown) {
  errorEl.style.display = 'block';
  errorEl.textContent = err instanceof Error ? err.message : String(err);
}

shellOpts.onIntervalChange = (interval) => {
  lastInterval = interval;
  chart.setInterval(interval);
  statusBar.update({ interval });
  crosshairLegend.setMeta({ interval });
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

chart.on('connectionChange', (state) => {
  statusBar.update({ connection: String(state ?? 'unknown') });
});

chart.on('barUpdate', () => {
  barCount += 1;
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
  statusBar.update({ interval: lastInterval });
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
  .then((h) => {
    barCount = h.bars.length;
    statusBar.update({ connection: 'connected' });
  })
  .catch((e) => {
    showError(e);
    statusBar.update({ connection: 'error' });
    console.error('[demo] mock unreachable — run: pnpm demo');
  });

console.log('[demo] TradView — grid off by default · StatusBar · crosshair legend · context menu');