import { createChart, type IChart } from '@tradview/core';
import { createGatewayDataProvider } from '@tradview/data';
import { bindChartKeyboard } from '@tradview/interaction';
import { mountChartLayout, type DrawingToolId, type TopBarOptions } from '@tradview/ui-shell';

const app = document.getElementById('app')!;
const connDot = document.getElementById('conn-dot')!;
const connLabel = document.getElementById('conn-label')!;
const barLabel = document.getElementById('bar-label')!;
const priceLabel = document.getElementById('price-label')!;
const errorEl = document.getElementById('demo-error')!;
const urlEl = document.getElementById('demo-url')!;

urlEl.textContent = location.origin;

/** Vite dev/preview proxy `/api` → mock :4010 (paths are /api/v1/… on gateway). */
const restBase = '';
const wsBase = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?v=1.0`;

const provider = createGatewayDataProvider({
  restBaseUrl: restBase,
  wsUrl: wsBase,
});

const chartRef: { current: IChart | null } = { current: null };

let drawingTool: DrawingToolId = 'cursor';

const shellOpts: TopBarOptions & {
  showLeftToolbar?: boolean;
  activeDrawingTool?: DrawingToolId;
  onDrawingToolSelect?: (tool: DrawingToolId) => void;
} = {
  showLeftToolbar: true,
  activeDrawingTool: drawingTool,
  onDrawingToolSelect: (tool) => {
    drawingTool = tool;
    shellOpts.activeDrawingTool = tool;
    chartRef.current?.setDrawingTool(tool);
  },
  initialSymbol: 'BINANCE:BTCUSDT',
  onSymbolSearch: (q) => chartRef.current?.searchSymbols(q) ?? provider.searchSymbols?.(q) ?? Promise.resolve([]),
  onSymbolSelect: (symbol) => {
    chartRef.current?.setSymbol(symbol);
  },
};
const { chartHost, indicatorHost } = mountChartLayout(app, shellOpts);

let theme: 'dark' | 'light' = 'dark';
let logScale = false;
let barCount = 0;
let lastClose: number | null = null;

const chart = createChart(chartHost, {
  dataProvider: provider,
  indicatorHost,
  symbol: 'BINANCE:BTCUSDT',
  interval: '1h',
  theme,
  scaleMode: 'linear',
});
chartRef.current = chart;

function setConnection(state: unknown) {
  const s = String(state ?? 'unknown');
  connLabel.textContent = `連線：${s}`;
  connDot.className = 'dot';
  if (s === 'connected' || s === 'open') connDot.classList.add('ok');
  else if (s === 'error' || s === 'disconnected') connDot.classList.add('err');
}

function setStatus() {
  barLabel.textContent = `K 線：${barCount}`;
  priceLabel.textContent =
    lastClose != null ? `收盤：${lastClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '收盤：—';
}

function showError(err: unknown) {
  errorEl.style.display = 'block';
  errorEl.textContent = err instanceof Error ? err.message : String(err);
}

shellOpts.onIntervalChange = (interval) => {
  chart.setInterval(interval);
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
  selectCursorTool: () => chart.setDrawingTool('cursor'),
});

chart.on('connectionChange', (state) => {
  setConnection(state);
});

chart.on('barUpdate', (bar) => {
  const b = bar as { c?: number; t?: number } | undefined;
  if (b?.c != null) {
    lastClose = b.c;
    barCount += 1;
    setStatus();
  }
});

chart.on('crosshairChange', (payload) => {
  const p = payload as {
    time?: number;
    price?: number | null;
    ohlcv?: { c?: number };
  } | null;
  if (!p?.ohlcv?.c) return;
  priceLabel.textContent = `十字：${p.ohlcv.c.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
});

chart.on('visibleRangeChange', (range) => {
  const r = range as { from?: number; to?: number } | undefined;
  if (r?.from != null && r?.to != null) {
    barLabel.textContent = `可見：${new Date(r.from).toLocaleString()} — ${new Date(r.to).toLocaleString()}`;
  }
});

chart.on('error', (err) => showError(err));

void provider
  .getHistory({
    mode: 'loadMore',
    symbol: 'BINANCE:BTCUSDT',
    interval: '1h',
    endTime: Date.now(),
    limit: 500,
  })
  .then((h) => {
    barCount = h.bars.length;
    lastClose = h.bars[h.bars.length - 1]?.c ?? null;
    setStatus();
    setConnection('connected');
  })
  .catch((e) => {
    showError(e);
    setConnection('error');
    console.error('[demo] mock unreachable — run: pnpm demo');
  });

console.log('[demo] TradView ready — MACD/RSI/KDJ panes · drawings · bridge crosshair');