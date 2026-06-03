import { DEFAULT_INTERVALS, type Interval } from '@tradview/data';
import { t } from '@tradview/i18n';

export interface TopBarOptions {
  intervals?: Interval[];
  onIntervalChange?: (interval: Interval) => void;
  onThemeToggle?: () => void;
  onFullscreen?: () => void;
  onScreenshot?: () => void;
}

export function mountTopBar(parent: HTMLElement, opts: TopBarOptions = {}): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'tv-topbar';
  bar.style.cssText =
    'display:flex;gap:8px;padding:8px 12px;align-items:center;border-bottom:1px solid #30363d;background:#161b22;';

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
  bar.appendChild(mkBtn('⛶', opts.onFullscreen));
  bar.appendChild(mkBtn('📷', opts.onScreenshot));

  parent.prepend(bar);
  return bar;
}