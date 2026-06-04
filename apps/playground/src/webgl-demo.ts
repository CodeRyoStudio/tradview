import {
  DEFAULT_INDICATOR_CONFIG,
  type IndicatorConfig,
} from '@coderyo/indicators';
import { WebGLPaneOrchestrator } from '@coderyo/renderer-webgl';
import { generateDemoBars } from './synthetic-bars.js';

const BAR_COUNT = 12_000;
const SYMBOL = 'BINANCE:BTCUSDT';
const INTERVAL = '1h';
const benchMode = new URLSearchParams(location.search).get('bench') === '1';

function showError(message: string): void {
  const el = document.getElementById('error');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function updateHud(orch: WebGLPaneOrchestrator, barCount: number): void {
  const vp = orch.getViewport();
  const barsEl = document.getElementById('hud-bars');
  const vpEl = document.getElementById('hud-viewport');
  const spEl = document.getElementById('hud-spacing');
  const indEl = document.getElementById('hud-indicators');
  const lodEl = document.getElementById('hud-lod');
  const perfEl = document.getElementById('hud-perf');
  if (!vp) return;
  const lod = orch.getLodStats();
  const perf = orch.getRenderPerfStats();
  if (barsEl) {
    barsEl.textContent =
      lod.inputCount > lod.outputCount
        ? `bars: ${lod.outputCount} (lod ${lod.inputCount}→${lod.outputCount})`
        : `bars: ${barCount}`;
  }
  if (vpEl) {
    vpEl.textContent = `viewport: ${vp.visibleFrom.toFixed(1)} … ${vp.visibleTo.toFixed(1)}`;
  }
  if (spEl) spEl.textContent = `barSpacing: ${vp.barSpacing.toFixed(1)}px`;
  const cfg = orch.getIndicatorConfig();
  if (indEl) {
    const on = [
      cfg.showMa && 'MA',
      cfg.showEma && 'EMA',
      cfg.showBoll && 'BOLL',
      cfg.showMacd && 'MACD',
      cfg.showRsi && 'RSI',
      cfg.showKdj && 'KDJ',
    ].filter(Boolean);
    indEl.textContent = `layers: ${on.length ? on.join(', ') : 'off'}`;
  }
  if (lodEl && lod.inputCount > 0) {
    lodEl.textContent = `lod: ${lod.inputCount} → ${lod.outputCount} @ max 4000`;
  }
  if (perfEl) {
    const parts = [`render: ${perf.lastRenderMs.toFixed(2)}ms`];
    if (perf.benchAvgMs != null) parts.push(`bench avg: ${perf.benchAvgMs.toFixed(2)}ms`);
    perfEl.textContent = parts.join(' · ');
  }
}

function buildToggles(
  initial: IndicatorConfig,
  onChange: (config: IndicatorConfig) => void,
): void {
  const host = document.getElementById('indicator-toggles');
  if (!host) return;

  let config = { ...initial };
  const keys: Array<{ key: keyof IndicatorConfig; label: string }> = [
    { key: 'showMa', label: 'MA' },
    { key: 'showEma', label: 'EMA' },
    { key: 'showBoll', label: 'BOLL' },
    { key: 'showMacd', label: 'MACD' },
    { key: 'showRsi', label: 'RSI' },
    { key: 'showKdj', label: 'KDJ' },
  ];

  for (const { key, label } of keys) {
    const labelEl = document.createElement('label');
    labelEl.style.cssText = 'font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(config[key]);
    input.onchange = () => {
      config = { ...config, [key]: input.checked };
      onChange(config);
    };
    labelEl.append(input, document.createTextNode(label));
    host.appendChild(labelEl);
  }
}

function main(): void {
  const root = document.getElementById('chart-root');
  if (!root) {
    showError('Missing #chart-root');
    return;
  }

  const endTime = Date.now();
  const bars = generateDemoBars({
    endTime,
    count: BAR_COUNT,
    basePrice: 94_250,
    seed: SYMBOL.length * 31 + INTERVAL.length,
  });

  let indicatorConfig: IndicatorConfig = {
    ...DEFAULT_INDICATOR_CONFIG,
    showMa: true,
    showBoll: true,
    showMacd: true,
    showRsi: true,
    showKdj: true,
  };

  let orch: WebGLPaneOrchestrator;
  try {
    orch = new WebGLPaneOrchestrator({
      volumeHeightRatio: 0.22,
      barSpacing: 7,
      maxRenderPoints: 4000,
      indicatorConfig,
      onIndicatorConfigChange: (cfg) => {
        indicatorConfig = cfg;
        updateHud(orch, bars.length);
      },
    });
    orch.mount(root);
    orch.setBars(bars);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError(`WebGL init failed: ${msg}`);
    return;
  }

  buildToggles(indicatorConfig, (cfg) => {
    indicatorConfig = cfg;
    orch.setIndicatorConfig(cfg);
  });

  updateHud(orch, bars.length);
  const hudTimer = window.setInterval(() => updateHud(orch, bars.length), 200);

  if (benchMode) {
    const avg = orch.runRenderBenchmark(80);
    console.log(`[webgl-bench] avg render: ${avg.toFixed(2)} ms (80 frames)`);
    updateHud(orch, bars.length);
  }

  window.addEventListener('beforeunload', () => {
    window.clearInterval(hudTimer);
    orch.destroy();
  });
}

main();