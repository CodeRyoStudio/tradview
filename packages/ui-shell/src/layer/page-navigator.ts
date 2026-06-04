import { t } from '@coderyo/i18n';
import type { LayerController } from './layer-controller.js';

export interface PageNavigatorOptions {
  /** Show tab bar even on wide viewports (default: narrow only). */
  alwaysVisible?: boolean;
  narrowMq?: string;
  onPageChange?: (pageId: string) => void;
}

export interface PageNavigatorHandle {
  el: HTMLElement;
  destroy: () => void;
  refresh: () => void;
}

/** @public Mobile-style page tabs for LayoutPreset v2 (P4). */
export function mountPageNavigator(
  parent: HTMLElement,
  controller: LayerController,
  opts: PageNavigatorOptions = {},
): PageNavigatorHandle {
  const mq = opts.narrowMq ?? '(max-width: 768px)';
  const nav = document.createElement('nav');
  nav.className = 'tv-page-navigator';
  nav.style.cssText =
    'display:none;align-items:center;gap:4px;padding:4px 8px;border-top:1px solid #30363d;background:#161b22;flex-shrink:0;flex-wrap:wrap;font-size:11px;color:#e6edf3;';

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;flex:1;min-width:0;';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:4px;flex-shrink:0;';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.title = t('page.nav.add', '新增頁面');
  addBtn.textContent = '+';
  addBtn.style.cssText =
    'width:28px;height:24px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:14px;line-height:1;';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.title = t('page.nav.rename', '重新命名');
  renameBtn.textContent = '✎';
  renameBtn.style.cssText =
    'width:28px;height:24px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:12px;';

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.title = t('page.nav.delete', '刪除頁面');
  delBtn.textContent = '×';
  delBtn.style.cssText = renameBtn.style.cssText;

  actions.append(addBtn, renameBtn, delBtn);
  nav.append(tabs, actions);
  parent.appendChild(nav);

  const tabBtnStyle =
    'padding:4px 10px;background:#21262d;color:#8b949e;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  const tabBtnActiveStyle = tabBtnStyle.replace('#21262d', '#388bfd').replace('#8b949e', '#fff');

  const refresh = () => {
    tabs.replaceChildren();
    const preset = controller.getPreset();
    for (const page of preset.pages) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = page.title;
      btn.title = page.title;
      btn.style.cssText =
        page.id === controller.activePageId ? tabBtnActiveStyle : tabBtnStyle;
      btn.onclick = () => {
        if (controller.setActivePage(page.id)) {
          opts.onPageChange?.(page.id);
        }
      };
      tabs.appendChild(btn);
    }
    delBtn.disabled = preset.pages.length <= 1;
  };

  addBtn.onclick = () => {
    const title = window.prompt(t('page.nav.addPrompt', '新頁面名稱'), '');
    const id = controller.addPage(title ?? undefined);
    opts.onPageChange?.(id);
  };

  renameBtn.onclick = () => {
    const page = controller.getPreset().pages.find((p) => p.id === controller.activePageId);
    if (!page) return;
    let title = window.prompt(t('page.nav.renamePrompt', '頁面名稱'), page.title);
    if (title == null) return;
    while (title !== null && !controller.renamePage(page.id, title)) {
      title = window.prompt(
        t('page.nav.renameEmpty', '名稱不可為空，請重新輸入'),
        title,
      );
      if (title == null) return;
    }
  };

  delBtn.onclick = () => {
    const page = controller.getPreset().pages.find((p) => p.id === controller.activePageId);
    if (!page || controller.getPreset().pages.length <= 1) return;
    if (!window.confirm(t('page.nav.deleteConfirm', `刪除「${page.title}」？`))) return;
    controller.removePage(page.id);
    opts.onPageChange?.(controller.activePageId);
  };

  const media = window.matchMedia(mq);
  const syncVisible = () => {
    nav.style.display = opts.alwaysVisible || media.matches ? 'flex' : 'none';
  };
  media.addEventListener('change', syncVisible);
  syncVisible();

  const unsub = controller.subscribe(refresh);
  refresh();

  return {
    el: nav,
    destroy: () => {
      unsub();
      media.removeEventListener('change', syncVisible);
      nav.remove();
    },
    refresh,
  };
}