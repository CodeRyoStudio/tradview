import type { SymbolSearchHit } from '@coderyo/data';
import { t } from '@coderyo/i18n';

export interface SymbolSearchOptions {
  onSearch: (query: string) => Promise<SymbolSearchHit[]>;
  onSelect: (symbol: string) => void;
  initialSymbol?: string;
}

export function mountSymbolSearch(parent: HTMLElement, opts: SymbolSearchOptions): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-right:8px;';

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = t('symbol.search', '搜尋商品');
  input.value = opts.initialSymbol ?? '';
  input.style.cssText =
    'width:140px;padding:4px 8px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;font-size:12px;';

  const list = document.createElement('div');
  list.style.cssText =
    'display:none;position:absolute;top:100%;left:0;z-index:20;min-width:200px;max-height:200px;overflow:auto;background:#161b22;border:1px solid #30363d;border-radius:4px;';

  const box = document.createElement('div');
  box.style.position = 'relative';
  box.append(input, list);
  wrap.appendChild(box);

  let timer: ReturnType<typeof setTimeout> | undefined;

  const renderHits = (hits: SymbolSearchHit[]) => {
    list.replaceChildren();
    if (hits.length === 0) {
      list.style.display = 'none';
      return;
    }
    for (const hit of hits) {
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = hit.exchange ? `${hit.symbol} · ${hit.exchange}` : hit.symbol;
      row.style.cssText =
        'display:block;width:100%;text-align:left;padding:6px 10px;border:none;background:transparent;color:#e6edf3;cursor:pointer;font-size:12px;';
      row.onmouseenter = () => {
        row.style.background = '#21262d';
      };
      row.onmouseleave = () => {
        row.style.background = 'transparent';
      };
      row.onclick = () => {
        input.value = hit.symbol;
        list.style.display = 'none';
        opts.onSelect(hit.symbol);
      };
      list.appendChild(row);
    }
    list.style.display = 'block';
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 1) {
      list.style.display = 'none';
      return;
    }
    timer = setTimeout(() => {
      void opts.onSearch(q).then(renderHits).catch(() => {
        list.style.display = 'none';
      });
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target as Node)) list.style.display = 'none';
  });

  parent.appendChild(wrap);
  return wrap;
}