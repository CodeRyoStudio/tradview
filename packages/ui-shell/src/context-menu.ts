import { t } from '@tradview/i18n';

export interface ContextMenuAction {
  id: string;
  label: string;
  onClick: () => void;
}

export interface ContextMenuOptions {
  actions?: ContextMenuAction[];
}

export function attachChartContextMenu(
  chartHost: HTMLElement,
  opts: ContextMenuOptions = {},
): () => void {
  let menu: HTMLDivElement | null = null;

  const close = () => {
    menu?.remove();
    menu = null;
  };

  const open = (x: number, y: number) => {
    close();
    menu = document.createElement('div');
    menu.style.cssText =
      'position:fixed;z-index:50;min-width:160px;padding:4px 0;background:#161b22;border:1px solid #30363d;border-radius:6px;box-shadow:0 8px 24px #01040988;';

    const actions: ContextMenuAction[] = opts.actions ?? [
      {
        id: 'fit',
        label: t('context.fitContent', '適配畫面'),
        onClick: () => {},
      },
    ];

    for (const action of actions) {
      const row = document.createElement('button');
      row.type = 'button';
      row.textContent = action.label;
      row.style.cssText =
        'display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:transparent;color:#e6edf3;font-size:12px;cursor:pointer;';
      row.onmouseenter = () => {
        row.style.background = '#21262d';
      };
      row.onmouseleave = () => {
        row.style.background = 'transparent';
      };
      row.onclick = () => {
        action.onClick();
        close();
      };
      menu.appendChild(row);
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    document.body.appendChild(menu);
  };

  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    open(e.clientX, e.clientY);
  };

  chartHost.addEventListener('contextmenu', onContext);
  document.addEventListener('click', close);
  document.addEventListener('scroll', close, true);

  return () => {
    chartHost.removeEventListener('contextmenu', onContext);
    document.removeEventListener('click', close);
    document.removeEventListener('scroll', close, true);
    close();
  };
}