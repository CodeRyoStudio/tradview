import { DEFAULT_INTERVALS, type Interval, type SymbolSearchHit } from '@coderyo/data';
import { t } from '@coderyo/i18n';
import { mountSettingsMenu, type SettingsMenuOptions } from './settings-menu.js';
import { mountSymbolSearch } from './symbol-search.js';

export type SymbolInputMode = 'manual' | 'search' | 'none';

export interface TopBarOptions {
  intervals?: Interval[];
  initialSymbol?: string;
  onSymbolSearch?: (query: string) => Promise<SymbolSearchHit[]>;
  onSymbolSelect?: (symbol: string) => void;
  onIntervalChange?: (interval: Interval) => void;
  onThemeToggle?: () => void;
  onFullscreen?: () => void;
  onScreenshot?: () => void;
  settings?: SettingsMenuOptions;
  symbolInput?: SymbolInputMode;
  showSettings?: boolean;
}

function mountManualSymbolInput(
  parent: HTMLElement,
  opts: { initialSymbol?: string; onSymbolSelect?: (symbol: string) => void },
): void {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:4px;margin-right:8px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t('symbol.search', 'Symbol');
  input.value = opts.initialSymbol ?? '';
  input.style.cssText =
    'width:140px;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 8px;font-size:12px;';
  const apply = () => {
    const v = input.value.trim();
    if (v) opts.onSymbolSelect?.(v);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') apply();
  });
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '↵';
  btn.title = 'Apply symbol';
  btn.style.cssText =
    'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px;';
  btn.onclick = apply;
  wrap.append(input, btn);
  parent.appendChild(wrap);
}

export function mountTopBar(parent: HTMLElement, opts: TopBarOptions = {}): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'tv-topbar';
  bar.style.cssText =
    'display:flex;gap:8px;padding:8px 12px;align-items:center;border-bottom:1px solid #30363d;background:#161b22;';

  const symbolMode = opts.symbolInput ?? 'manual';
  if (symbolMode === 'search' && opts.onSymbolSearch && opts.onSymbolSelect) {
    mountSymbolSearch(bar, {
      initialSymbol: opts.initialSymbol,
      onSearch: opts.onSymbolSearch,
      onSelect: opts.onSymbolSelect,
    });
  } else if (symbolMode === 'manual' && opts.onSymbolSelect) {
    mountManualSymbolInput(bar, {
      initialSymbol: opts.initialSymbol,
      onSymbolSelect: opts.onSymbolSelect,
    });
  }

  const intervals = opts.intervals ?? DEFAULT_INTERVALS;
  for (const iv of intervals) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t(`interval.${iv}`, iv);
    btn.style.cssText =
      'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
    btn.onclick = () => opts.onIntervalChange?.(iv);
    bar.appendChild(btn);
  }

  const spacer = document.createElement('div');
  spacer.style.flex = '1';
  bar.appendChild(spacer);

  const mkBtn = (label: string, fn?: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText =
      'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
    b.onclick = () => fn?.();
    return b;
  };

  bar.appendChild(mkBtn(t('theme.dark', '主題'), opts.onThemeToggle));
  if (opts.showSettings && opts.settings) mountSettingsMenu(bar, opts.settings);
  bar.appendChild(mkBtn('⛶', opts.onFullscreen));
  bar.appendChild(mkBtn('📷', opts.onScreenshot));

  parent.prepend(bar);
  return bar;
}