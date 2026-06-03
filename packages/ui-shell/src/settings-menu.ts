import { t } from '@tradview/i18n';

export const GRID_SETTING_KEY = 'tradview:settings:showGrid';

export function loadShowGridPreference(): boolean {
  try {
    return localStorage.getItem(GRID_SETTING_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveShowGridPreference(show: boolean): void {
  try {
    localStorage.setItem(GRID_SETTING_KEY, show ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

export interface SettingsMenuOptions {
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
}

export function mountSettingsMenu(parent: HTMLElement, opts: SettingsMenuOptions = {}): HTMLElement {
  let open = false;
  let showGrid = opts.showGrid ?? loadShowGridPreference();

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = t('settings.title', '設定');
  btn.textContent = '⚙';
  btn.style.cssText =
    'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'display:none;position:absolute;right:0;top:100%;margin-top:4px;min-width:180px;padding:10px 12px;background:#161b22;border:1px solid #30363d;border-radius:6px;box-shadow:0 8px 24px #01040988;z-index:20;';

  const row = document.createElement('label');
  row.style.cssText =
    'display:flex;align-items:center;gap:8px;font-size:12px;color:#e6edf3;cursor:pointer;user-select:none;';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = showGrid;
  const label = document.createElement('span');
  label.textContent = t('settings.showGrid', '顯示網格');
  row.append(checkbox, label);
  panel.appendChild(row);

  checkbox.onchange = () => {
    showGrid = checkbox.checked;
    saveShowGridPreference(showGrid);
    opts.onShowGridChange?.(showGrid);
  };

  btn.onclick = (e) => {
    e.stopPropagation();
    open = !open;
    panel.style.display = open ? 'block' : 'none';
  };

  const close = () => {
    open = false;
    panel.style.display = 'none';
  };
  document.addEventListener('click', close);
  panel.onclick = (e) => e.stopPropagation();

  wrap.append(btn, panel);
  parent.appendChild(wrap);
  return wrap;
}