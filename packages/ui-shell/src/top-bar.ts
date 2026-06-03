import { DEFAULT_INTERVALS, type Interval, type SymbolSearchHit } from '@coderyo/data';
import type { I18nProvider } from './i18n-provider.js';
import { mountLogoSlot, type LogoSlotOptions } from './logo-slot.js';
import { mountSettingsMenu, type SettingsMenuOptions } from './settings-menu.js';
import {
  createSymbolSearchDialog,
  mountSymbolSearchDialogTrigger,
} from './symbol-search-dialog.js';
import { mountSymbolSearch } from './symbol-search.js';
import { mountThemeToggle } from './theme-toggle.js';
import type { ThemeProvider } from './theme-provider.js';

export type SymbolInputMode = 'manual' | 'search' | 'dialog' | 'none';

export interface TopBarOptions {
  intervals?: Interval[];
  /** Highlighted interval button (defaults to first in `intervals`). */
  activeInterval?: Interval;
  initialSymbol?: string;
  onSymbolSearch?: (query: string) => Promise<SymbolSearchHit[]>;
  onSymbolSelect?: (symbol: string) => void;
  onIntervalChange?: (interval: Interval) => void;
  onThemeToggle?: () => void;
  onThemeChange?: (theme: 'dark' | 'light') => void;
  themeProvider?: ThemeProvider;
  i18n?: I18nProvider;
  logo?: LogoSlotOptions | false;
  onFullscreen?: () => void;
  onScreenshot?: () => void;
  settings?: SettingsMenuOptions;
  symbolInput?: SymbolInputMode;
  showSettings?: boolean;
}

function mountManualSymbolInput(
  parent: HTMLElement,
  opts: {
    initialSymbol?: string;
    onSymbolSelect?: (symbol: string) => void;
    i18n?: I18nProvider;
  },
): void {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:4px;margin-right:8px;';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = opts.i18n?.t('symbol.search', 'Symbol') ?? 'Symbol';
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

export function mountTopBar(
  parent: HTMLElement,
  opts: TopBarOptions = {},
): { el: HTMLElement; setActiveInterval: (interval: Interval) => void } {
  const i18n = opts.i18n;
  const tKey = (key: string, fallback: string) => i18n?.t(key, fallback) ?? fallback;

  const bar = document.createElement('div');
  bar.className = 'tv-topbar';
  bar.style.cssText =
    'display:flex;gap:8px;padding:8px 12px;align-items:center;border-bottom:1px solid var(--tv-border,#30363d);background:var(--tv-surface,#161b22);flex-shrink:0;box-sizing:border-box;width:100%;min-width:0;overflow-x:auto;overflow-y:visible;position:relative;';

  if (opts.logo !== false) {
    mountLogoSlot(bar, opts.logo ?? { label: 'TradView' });
  }

  const symbolMode = opts.symbolInput ?? 'manual';
  if (symbolMode === 'search' && opts.onSymbolSearch && opts.onSymbolSelect) {
    mountSymbolSearch(bar, {
      initialSymbol: opts.initialSymbol,
      onSearch: opts.onSymbolSearch,
      onSelect: opts.onSymbolSelect,
    });
  } else if (symbolMode === 'dialog' && opts.onSymbolSearch && opts.onSymbolSelect) {
    const dialog = createSymbolSearchDialog({
      initialSymbol: opts.initialSymbol,
      onSearch: opts.onSymbolSearch,
      onSelect: opts.onSymbolSelect,
      i18n,
    });
    mountSymbolSearchDialogTrigger(bar, dialog, {
      initialSymbol: opts.initialSymbol,
      i18n,
    });
  } else if (symbolMode === 'manual' && opts.onSymbolSelect) {
    mountManualSymbolInput(bar, {
      initialSymbol: opts.initialSymbol,
      onSymbolSelect: opts.onSymbolSelect,
      i18n,
    });
  }

  const intervals = opts.intervals ?? DEFAULT_INTERVALS;
  const btnStyle =
    'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;flex-shrink:0;';
  const btnActiveStyle = btnStyle.replace('#21262d', '#388bfd').replace('#e6edf3', '#fff');
  const intervalButtons = new Map<Interval, HTMLButtonElement>();
  let activeInterval = opts.activeInterval ?? intervals[0];

  const intervalRow = document.createElement('div');
  intervalRow.className = 'tv-topbar-intervals';
  intervalRow.style.cssText = 'display:flex;gap:8px;flex-wrap:nowrap;align-items:center;flex-shrink:0;';

  const paintIntervalButtons = () => {
    for (const [iv, btn] of intervalButtons) {
      btn.style.cssText = iv === activeInterval ? btnActiveStyle : btnStyle;
    }
  };

  for (const iv of intervals) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = tKey(`interval.${iv}`, iv);
    btn.style.cssText = btnStyle;
    btn.onclick = () => {
      if (activeInterval === iv) return;
      activeInterval = iv;
      paintIntervalButtons();
      opts.onIntervalChange?.(iv);
    };
    intervalButtons.set(iv, btn);
    intervalRow.appendChild(btn);
  }
  paintIntervalButtons();
  bar.appendChild(intervalRow);

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

  if (opts.themeProvider) {
    mountThemeToggle(bar, {
      themeProvider: opts.themeProvider,
      i18n,
      onThemeChange: opts.onThemeChange,
    });
  } else {
    bar.appendChild(mkBtn(tKey('theme.dark', '主題'), opts.onThemeToggle));
  }
  if (opts.showSettings && opts.settings) mountSettingsMenu(bar, opts.settings);
  bar.appendChild(mkBtn('⛶', opts.onFullscreen));
  bar.appendChild(mkBtn('📷', opts.onScreenshot));

  parent.appendChild(bar);
  return {
    el: bar,
    setActiveInterval: (interval) => {
      if (!intervalButtons.has(interval)) return;
      activeInterval = interval;
      paintIntervalButtons();
    },
  };
}