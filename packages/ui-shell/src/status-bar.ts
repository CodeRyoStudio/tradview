import { getLocale, setLocale, t } from '@tradview/i18n';

export interface OhlcvSnapshot {
  o?: number;
  h?: number;
  l?: number;
  c?: number;
  v?: number;
}

export interface StatusBarOptions {
  connection?: string;
  symbol?: string;
  interval?: string;
  ohlcv?: OhlcvSnapshot | null;
  locale?: string;
  onLocaleChange?: (locale: string) => void;
}

function fmt(n: number | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function mountStatusBar(parent: HTMLElement, opts: StatusBarOptions = {}): {
  el: HTMLElement;
  update: (patch: StatusBarOptions) => void;
} {
  const bar = document.createElement('div');
  bar.className = 'tv-statusbar';
  bar.style.cssText =
    'display:flex;align-items:center;gap:14px;padding:6px 12px;font-size:11px;color:#8b949e;border-top:1px solid #30363d;background:#161b22;flex-shrink:0;';

  const conn = document.createElement('span');
  const sym = document.createElement('span');
  const ohlcv = document.createElement('span');
  ohlcv.style.flex = '1';
  ohlcv.style.color = '#e6edf3';

  const localeWrap = document.createElement('label');
  localeWrap.style.cssText = 'display:flex;align-items:center;gap:4px;margin-left:auto;';
  const localeLabel = document.createElement('span');
  localeLabel.textContent = t('status.locale', '語系');
  const localeSelect = document.createElement('select');
  localeSelect.style.cssText =
    'background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:4px;font-size:11px;padding:2px 4px;';
  for (const loc of ['zh-TW', 'en']) {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    localeSelect.appendChild(opt);
  }
  localeSelect.value = opts.locale ?? getLocale();
  localeSelect.onchange = () => {
    setLocale(localeSelect.value);
    opts.onLocaleChange?.(localeSelect.value);
    localeLabel.textContent = t('status.locale', '語系');
    render(opts);
  };
  localeWrap.append(localeLabel, localeSelect);

  bar.append(conn, sym, ohlcv, localeWrap);
  parent.appendChild(bar);

  const render = (state: StatusBarOptions) => {
    const merged = { ...opts, ...state };
    conn.textContent = `${t('status.connection', '連線')}：${merged.connection ?? '—'}`;
    const parts = [merged.symbol, merged.interval].filter(Boolean);
    sym.textContent = parts.length ? parts.join(' · ') : '';
    const o = merged.ohlcv;
    if (o && (o.o != null || o.c != null)) {
      ohlcv.textContent = `O ${fmt(o.o)}  H ${fmt(o.h)}  L ${fmt(o.l)}  C ${fmt(o.c)}  V ${fmt(o.v, 0)}`;
    } else {
      ohlcv.textContent = t('status.ohlcvHint', '移動十字線查看 OHLCV');
    }
  };

  render(opts);
  return {
    el: bar,
    update: (patch) => {
      Object.assign(opts, patch);
      render(opts);
    },
  };
}