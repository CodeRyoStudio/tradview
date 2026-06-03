import type { SymbolSearchHit } from '@coderyo/data';
import type { I18nProvider } from './i18n-provider.js';

export interface SymbolSearchDialogOptions {
  onSearch: (query: string) => Promise<SymbolSearchHit[]>;
  onSelect: (symbol: string) => void;
  initialSymbol?: string;
  i18n?: I18nProvider;
}

export interface SymbolSearchDialogHandle {
  open(): void;
  close(): void;
  destroy(): void;
}

export function createSymbolSearchDialog(opts: SymbolSearchDialogOptions): SymbolSearchDialogHandle {
  const i18n = opts.i18n;
  const backdrop = document.createElement('div');
  backdrop.className = 'tv-symbol-dialog-backdrop';
  backdrop.style.cssText =
    'display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.55);align-items:flex-start;justify-content:center;padding:12vh 16px 16px;';

  const panel = document.createElement('div');
  panel.className = 'tv-symbol-dialog';
  panel.style.cssText =
    'width:min(420px,100%);background:var(--tv-surface,#161b22);border:1px solid var(--tv-border,#30363d);border-radius:8px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';

  const title = document.createElement('div');
  title.textContent = i18n?.t('symbol.search', '搜尋商品') ?? '搜尋商品';
  title.style.cssText = 'font-size:13px;font-weight:600;color:var(--tv-fg,#e6edf3);margin-bottom:8px;';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = i18n?.t('symbol.search', '搜尋商品') ?? '搜尋商品';
  input.value = opts.initialSymbol ?? '';
  input.style.cssText =
    'width:100%;box-sizing:border-box;padding:8px 10px;border-radius:4px;border:1px solid var(--tv-border,#30363d);background:var(--tv-bg,#0d1117);color:var(--tv-fg,#e6edf3);font-size:13px;';

  const list = document.createElement('div');
  list.style.cssText = 'margin-top:8px;max-height:240px;overflow:auto;';

  panel.append(title, input, list);
  backdrop.appendChild(panel);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let mounted = false;

  const renderHits = (hits: SymbolSearchHit[]) => {
    list.replaceChildren();
    if (hits.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '—';
      empty.style.cssText = 'padding:8px;color:var(--tv-muted,#8b949e);font-size:12px;';
      list.appendChild(empty);
      return;
    }
    for (const hit of hits) {
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = hit.exchange ? `${hit.symbol} · ${hit.exchange}` : hit.symbol;
      row.style.cssText =
        'display:block;width:100%;text-align:left;padding:8px 10px;border:none;background:transparent;color:var(--tv-fg,#e6edf3);cursor:pointer;font-size:12px;border-radius:4px;';
      row.onmouseenter = () => {
        row.style.background = 'var(--tv-btn-bg,#21262d)';
      };
      row.onmouseleave = () => {
        row.style.background = 'transparent';
      };
      row.onclick = () => {
        opts.onSelect(hit.symbol);
        close();
      };
      list.appendChild(row);
    }
  };

  const runSearch = () => {
    const q = input.value.trim();
    if (q.length < 1) {
      list.replaceChildren();
      return;
    }
    void opts.onSearch(q).then(renderHits).catch(() => list.replaceChildren());
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 200);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') runSearch();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  const open = () => {
    if (!mounted) {
      document.body.appendChild(backdrop);
      mounted = true;
    }
    backdrop.style.display = 'flex';
    input.focus();
    input.select();
    runSearch();
  };

  const close = () => {
    backdrop.style.display = 'none';
  };

  const destroy = () => {
    clearTimeout(timer);
    backdrop.remove();
    mounted = false;
  };

  return { open, close, destroy };
}

/** TopBar trigger: shows current symbol and opens the dialog. */
export function mountSymbolSearchDialogTrigger(
  parent: HTMLElement,
  dialog: SymbolSearchDialogHandle,
  opts: { initialSymbol?: string; i18n?: I18nProvider },
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;margin-right:8px;flex-shrink:0;';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = opts.initialSymbol ?? (opts.i18n?.t('symbol.search', '搜尋商品') ?? '搜尋商品');
  btn.style.cssText =
    'min-width:140px;text-align:left;background:var(--tv-bg,#0d1117);color:var(--tv-fg,#e6edf3);border:1px solid var(--tv-border,#30363d);border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;';
  btn.onclick = () => dialog.open();

  wrap.appendChild(btn);
  parent.appendChild(wrap);
  return wrap;
}