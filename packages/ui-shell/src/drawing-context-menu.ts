import type { DrawingRecord } from '@coderyo/drawings';
import { t } from '@coderyo/i18n';

export interface DrawingContextMenuHandlers {
  onDelete?: () => void;
  onCopy?: () => void;
  onToggleLock?: () => void;
  onDeselect?: () => void;
  onEditText?: () => void;
}

export function openDrawingContextMenu(
  clientX: number,
  clientY: number,
  drawing: DrawingRecord | null,
  handlers: DrawingContextMenuHandlers,
): () => void {
  const menu = document.createElement('div');
  menu.style.cssText =
    'position:fixed;z-index:60;min-width:168px;padding:4px 0;background:#161b22;border:1px solid #30363d;border-radius:6px;box-shadow:0 8px 24px #01040988;';
  menu.style.left = `${clientX}px`;
  menu.style.top = `${clientY}px`;

  const add = (label: string, fn?: () => void, disabled = false) => {
    if (!fn) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.disabled = disabled;
    btn.style.cssText =
      'display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:transparent;color:#e6edf3;font-size:12px;cursor:pointer;';
    if (disabled) btn.style.opacity = '0.45';
    btn.onclick = () => {
      fn();
      close();
    };
    menu.appendChild(btn);
  };

  if (drawing) {
    const locked = Boolean(drawing.meta?.locked);
    add(t('drawing.ctx.delete', '刪除'), handlers.onDelete);
    add(t('drawing.ctx.copy', '複製'), handlers.onCopy);
    add(
      locked ? t('drawing.ctx.unlock', '解鎖') : t('drawing.ctx.lock', '鎖定'),
      handlers.onToggleLock,
    );
    if (drawing.type === 'text') {
      add(t('drawing.ctx.editText', '編輯文字'), handlers.onEditText);
    }
    add(t('drawing.ctx.deselect', '取消選取'), handlers.onDeselect);
  }

  document.body.appendChild(menu);

  const close = () => {
    menu.remove();
    document.removeEventListener('click', close);
  };
  setTimeout(() => document.addEventListener('click', close), 0);
  return close;
}