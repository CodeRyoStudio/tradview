import type { I18nProvider } from './i18n-provider.js';
import type { ThemeId, ThemeProvider } from './theme-provider.js';

export interface ThemeToggleOptions {
  themeProvider: ThemeProvider;
  i18n?: I18nProvider;
  onThemeChange?: (theme: ThemeId) => void;
}

export function mountThemeToggle(parent: HTMLElement, opts: ThemeToggleOptions): HTMLButtonElement {
  const i18n = opts.i18n;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tv-theme-toggle';
  btn.style.cssText =
    'background:var(--tv-btn-bg,#21262d);color:var(--tv-fg,#e6edf3);border:1px solid var(--tv-border,#30363d);border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;flex-shrink:0;';

  const paint = (theme: ThemeId) => {
    btn.textContent =
      theme === 'dark'
        ? (i18n?.t('theme.dark', '深色') ?? '深色')
        : (i18n?.t('theme.light', '淺色') ?? '淺色');
  };

  btn.onclick = () => {
    const next = opts.themeProvider.toggle();
    opts.onThemeChange?.(next);
  };

  opts.themeProvider.subscribe((theme) => paint(theme));
  parent.appendChild(btn);
  return btn;
}