import { WebGLPaneOrchestrator } from '@coderyo/renderer-webgl';
import { generateDemoBars } from './synthetic-bars.js';

const BAR_COUNT = 600;
const SYMBOL = 'BINANCE:BTCUSDT';
const INTERVAL = '1h';

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
  if (!vp) return;
  if (barsEl) barsEl.textContent = `bars: ${barCount}`;
  if (vpEl) {
    vpEl.textContent = `viewport: ${vp.visibleFrom.toFixed(1)} … ${vp.visibleTo.toFixed(1)}`;
  }
  if (spEl) spEl.textContent = `barSpacing: ${vp.barSpacing.toFixed(1)}px`;
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

  let orch: WebGLPaneOrchestrator;
  try {
    orch = new WebGLPaneOrchestrator({
      volumeHeightRatio: 0.22,
      barSpacing: 7,
    });
    orch.mount(root);
    orch.setBars(bars);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError(`WebGL init failed: ${msg}`);
    return;
  }

  updateHud(orch, bars.length);
  const hudTimer = window.setInterval(() => updateHud(orch, bars.length), 200);

  window.addEventListener('beforeunload', () => {
    window.clearInterval(hudTimer);
    orch.destroy();
  });
}

main();