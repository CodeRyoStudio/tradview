import { t } from '@tradview/i18n';

const SHORTCUTS: Array<{ key: string; desc: string }> = [
  { key: '↖ / Esc', desc: '游標（選取/編輯繪圖）' },
  { key: 'Delete', desc: '刪除選中繪圖' },
  { key: 'R', desc: '適配畫面' },
  { key: 'End', desc: '跳到最新 K 線' },
  { key: 'F', desc: '全螢幕' },
  { key: 'S', desc: '截圖 PNG' },
  { key: 'L', desc: '對數價格軸' },
  { key: 'T', desc: '切換主題' },
  { key: '?', desc: '本說明' },
];

export function bindShortcutsModal(): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== '?' || e.ctrlKey || e.metaKey) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    openShortcutsModal();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}

export function openShortcutsModal(): void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;z-index:100;background:#01040999;display:flex;align-items:center;justify-content:center;';

  const box = document.createElement('div');
  box.style.cssText =
    'min-width:320px;max-width:90vw;padding:16px 20px;background:#161b22;border:1px solid #30363d;border-radius:8px;color:#e6edf3;';

  const h = document.createElement('h2');
  h.textContent = t('shortcuts.title', '快捷鍵');
  h.style.cssText = 'font-size:16px;margin:0 0 12px;';

  const list = document.createElement('div');
  list.style.cssText = 'font-size:13px;line-height:1.8;';
  for (const s of SHORTCUTS) {
    const row = document.createElement('div');
    row.innerHTML = `<kbd style="background:#21262d;padding:2px 6px;border-radius:4px;margin-right:8px;">${s.key}</kbd>${s.desc}`;
    list.appendChild(row);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = t('shortcuts.close', '關閉');
  closeBtn.style.cssText =
    'margin-top:14px;padding:6px 14px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;';
  const close = () => backdrop.remove();
  closeBtn.onclick = close;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close();
  };

  box.append(h, list, closeBtn);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
}