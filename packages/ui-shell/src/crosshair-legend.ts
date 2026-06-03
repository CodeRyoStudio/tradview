import type { OhlcvSnapshot } from './status-bar.js';

export interface CrosshairLegendOptions {
  symbol?: string;
  interval?: string;
}

export function mountCrosshairLegend(
  chartHost: HTMLElement,
  opts: CrosshairLegendOptions = {},
): {
  el: HTMLElement;
  update: (payload: { time?: number; ohlcv?: OhlcvSnapshot | null }) => void;
  setMeta: (meta: CrosshairLegendOptions) => void;
  hide: () => void;
} {
  const box = document.createElement('div');
  box.className = 'tv-crosshair-legend';
  box.style.cssText =
    'display:none;position:absolute;top:8px;left:8px;z-index:10;padding:6px 10px;border-radius:6px;background:#161b22e6;border:1px solid #30363d;font-size:11px;color:#e6edf3;pointer-events:none;line-height:1.5;';

  const title = document.createElement('div');
  title.style.cssText = 'color:#8b949e;margin-bottom:2px;';
  const body = document.createElement('div');
  box.append(title, body);
  chartHost.appendChild(box);

  const fmt = (n: number | undefined) =>
    n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const render = (payload: { time?: number; ohlcv?: OhlcvSnapshot | null }) => {
    const parts = [opts.symbol, opts.interval].filter(Boolean);
    title.textContent = parts.length ? parts.join(' · ') : '';
    const o = payload.ohlcv;
    if (!o?.c && o?.o == null) {
      box.style.display = 'none';
      return;
    }
    const timeStr = payload.time != null ? new Date(payload.time).toLocaleString() : '';
    body.textContent = `${timeStr}\nO ${fmt(o?.o)}  H ${fmt(o?.h)}  L ${fmt(o?.l)}  C ${fmt(o?.c)}`;
    box.style.display = 'block';
  };

  return {
    el: box,
    update: render,
    setMeta: (meta) => {
      Object.assign(opts, meta);
      title.textContent = [opts.symbol, opts.interval].filter(Boolean).join(' · ');
    },
    hide: () => {
      box.style.display = 'none';
    },
  };
}