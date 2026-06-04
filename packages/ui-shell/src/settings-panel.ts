import {
  DEFAULT_INDICATOR_CONFIG,
  disableIndicatorLayer,
  listActiveIndicatorLayers,
  type IndicatorConfig,
  type IndicatorLayerId,
} from '@coderyo/indicators';
import { t } from '@coderyo/i18n';
import {
  loadReturnToCursorPreference,
  loadShowGridPreference,
  saveReturnToCursorPreference,
  saveShowGridPreference,
} from './user-preferences.js';

export interface SettingsPanelOptions {
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
  returnToCursorAfterDraw?: boolean;
  onReturnToCursorChange?: (v: boolean) => void;
  indicatorConfig?: IndicatorConfig;
  onIndicatorConfigChange?: (config: IndicatorConfig) => void;
  onClearAllIndicators?: () => void;
  onClearAllDrawings?: () => void;
}

export function mountSettingsPanel(parent: HTMLElement, opts: SettingsPanelOptions = {}): HTMLElement {
  let open = false;
  let tab: 'chart' | 'drawing' | 'indicator' = 'chart';
  let showGrid = opts.showGrid ?? loadShowGridPreference();
  let returnToCursor = opts.returnToCursorAfterDraw ?? loadReturnToCursorPreference();
  let indicatorConfig = { ...(opts.indicatorConfig ?? DEFAULT_INDICATOR_CONFIG) };

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = t('settings.title', '設定');
  btn.textContent = '⚙';
  btn.style.cssText =
    'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:14px;';

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'display:none;position:fixed;inset:0;z-index:2000;background:#01040999;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.style.cssText =
    'width:min(420px,100%);max-height:min(85vh,640px);display:flex;flex-direction:column;background:#161b22;border:1px solid #30363d;border-radius:8px;box-shadow:0 16px 48px #010409cc;overflow:hidden;';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #30363d;';
  const title = document.createElement('span');
  title.textContent = t('settings.title', '設定');
  title.style.cssText = 'font-size:14px;font-weight:600;color:#e6edf3;';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.title = t('settings.close', '關閉');
  closeBtn.style.cssText =
    'background:transparent;border:none;color:#8b949e;font-size:20px;line-height:1;cursor:pointer;padding:0 4px;';
  header.append(title, closeBtn);

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;border-bottom:1px solid #30363d;flex-shrink:0;';
  const content = document.createElement('div');
  content.style.cssText = 'padding:10px 12px;font-size:12px;overflow:auto;flex:1;min-height:0;';

  const tabIds = [
    ['chart', t('settings.tab.chart', '圖表')],
    ['drawing', t('settings.tab.drawing', '繪圖')],
    ['indicator', t('settings.tab.indicator', '指標')],
  ] as const;

  const renderTabs = () => {
    tabs.replaceChildren();
    for (const [id, label] of tabIds) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `flex:1;padding:8px;border:none;cursor:pointer;font-size:12px;${
        tab === id ? 'background:#21262d;color:#e6edf3;' : 'background:transparent;color:#8b949e;'
      }`;
      b.onclick = (e) => {
        e.stopPropagation();
        tab = id;
        renderTabs();
        renderContent();
      };
      tabs.appendChild(b);
    }
  };

  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
    const row = document.createElement('label');
    row.style.cssText =
      'display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;color:#e6edf3;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.onchange = () => onChange(input.checked);
    row.append(input, document.createTextNode(label));
    return row;
  };

  const actionButton = (label: string, onClick: () => void, danger = true) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `display:block;width:100%;margin-top:10px;padding:6px 10px;border-radius:4px;border:1px solid ${
      danger ? '#f85149' : '#30363d'
    };background:#21262d;color:${danger ? '#f85149' : '#e6edf3'};cursor:pointer;font-size:12px;`;
    b.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    return b;
  };

  const numberField = (label: string, value: number, onChange: (n: number) => void) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
    row.innerHTML = `<span style="color:#8b949e">${label}</span>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.style.cssText =
      'width:72px;padding:2px 6px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;';
    input.onchange = () => onChange(Number(input.value) || value);
    row.appendChild(input);
    return row;
  };

  const renderLayerList = () => {
    const layers = listActiveIndicatorLayers(indicatorConfig);
    const section = document.createElement('div');
    section.style.marginBottom = '12px';
    const heading = document.createElement('div');
    heading.textContent = t('settings.ind.layers', '指標圖層');
    heading.style.cssText = 'font-weight:600;color:#e6edf3;margin-bottom:6px;font-size:12px;';
    section.appendChild(heading);
    if (layers.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = t('settings.ind.layersEmpty', '目前沒有指標');
      empty.style.cssText = 'color:#8b949e;font-size:11px;';
      section.appendChild(empty);
      return section;
    }
    for (const layer of layers) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;margin-bottom:4px;border-radius:4px;background:#0d1117;border:1px solid #30363d;';
      const meta = document.createElement('div');
      meta.style.cssText = 'min-width:0;';
      const name = document.createElement('div');
      name.textContent = layer.label;
      name.style.cssText = 'color:#e6edf3;font-size:12px;';
      const target = document.createElement('div');
      target.textContent =
        layer.target === 'main'
          ? t('settings.ind.layerMain', '主圖')
          : t('settings.ind.layerPane', '副圖');
      target.style.cssText = 'color:#8b949e;font-size:10px;margin-top:2px;';
      meta.append(name, target);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = t('settings.ind.layerRemove', '移除');
      remove.title = t('settings.ind.layerRemove', '移除');
      remove.style.cssText =
        'flex-shrink:0;padding:2px 8px;border-radius:4px;border:1px solid #f85149;background:transparent;color:#f85149;cursor:pointer;font-size:11px;';
      remove.onclick = (e) => {
        e.stopPropagation();
        indicatorConfig = disableIndicatorLayer(indicatorConfig, layer.id as IndicatorLayerId);
        opts.onIndicatorConfigChange?.(indicatorConfig);
        renderContent();
      };
      row.append(meta, remove);
      section.appendChild(row);
    }
    return section;
  };

  const renderContent = () => {
    content.replaceChildren();
    if (tab === 'chart') {
      content.appendChild(
        checkbox(t('settings.showGrid', '顯示網格'), showGrid, (v) => {
          showGrid = v;
          saveShowGridPreference(v);
          opts.onShowGridChange?.(v);
        }),
      );
    } else if (tab === 'drawing') {
      content.appendChild(
        checkbox(t('settings.returnCursor', '畫完切回游標'), returnToCursor, (v) => {
          returnToCursor = v;
          saveReturnToCursorPreference(v);
          opts.onReturnToCursorChange?.(v);
        }),
      );
      content.appendChild(
        actionButton(t('settings.drawing.clearAll', '清除所有畫線'), () => {
          opts.onClearAllDrawings?.();
          renderContent();
        }),
      );
    } else {
      content.appendChild(renderLayerList());
      content.appendChild(
        checkbox(t('settings.ind.volume', '成交量副圖'), indicatorConfig.showVolume, (v) => {
          indicatorConfig = { ...indicatorConfig, showVolume: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
          renderContent();
        }),
      );
      const divider = document.createElement('div');
      divider.style.cssText = 'height:1px;background:#30363d;margin:10px 0;';
      content.appendChild(divider);
      content.appendChild(
        checkbox(t('settings.ind.macd', 'MACD 窗格'), indicatorConfig.showMacd, (v) => {
          indicatorConfig = { ...indicatorConfig, showMacd: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
          renderContent();
        }),
      );
      content.appendChild(
        checkbox(t('settings.ind.rsi', 'RSI 窗格'), indicatorConfig.showRsi, (v) => {
          indicatorConfig = { ...indicatorConfig, showRsi: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
          renderContent();
        }),
      );
      content.appendChild(
        checkbox(t('settings.ind.kdj', 'KDJ 窗格'), indicatorConfig.showKdj, (v) => {
          indicatorConfig = { ...indicatorConfig, showKdj: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
          renderContent();
        }),
      );
      const src = document.createElement('label');
      src.style.cssText = 'display:flex;justify-content:space-between;margin:8px 0 6px;';
      src.innerHTML = `<span style="color:#8b949e">${t('settings.ind.source', '源')}</span>`;
      const sel = document.createElement('select');
      sel.style.cssText =
        'background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:2px 6px;';
      for (const v of ['close', 'hlc3'] as const) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
      }
      sel.value = indicatorConfig.source;
      sel.onchange = () => {
        indicatorConfig = { ...indicatorConfig, source: sel.value as IndicatorConfig['source'] };
        opts.onIndicatorConfigChange?.(indicatorConfig);
      };
      src.appendChild(sel);
      content.appendChild(src);
      content.appendChild(
        checkbox(t('settings.ind.ema', 'EMA 疊加'), indicatorConfig.showEma, (v) => {
          indicatorConfig = { ...indicatorConfig, showEma: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
          renderContent();
        }),
      );
      content.appendChild(
        numberField('EMA', indicatorConfig.emaPeriod, (n) => {
          indicatorConfig = { ...indicatorConfig, emaPeriod: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        checkbox(t('settings.ind.boll', 'BOLL 通道'), indicatorConfig.showBoll, (v) => {
          indicatorConfig = { ...indicatorConfig, showBoll: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
          renderContent();
        }),
      );
      content.appendChild(
        numberField('BOLL', indicatorConfig.bollPeriod, (n) => {
          indicatorConfig = { ...indicatorConfig, bollPeriod: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        numberField('MA', indicatorConfig.maPeriod, (n) => {
          indicatorConfig = { ...indicatorConfig, maPeriod: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        numberField('MACD fast', indicatorConfig.macdFast, (n) => {
          indicatorConfig = { ...indicatorConfig, macdFast: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        numberField('MACD slow', indicatorConfig.macdSlow, (n) => {
          indicatorConfig = { ...indicatorConfig, macdSlow: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        numberField('RSI', indicatorConfig.rsiPeriod, (n) => {
          indicatorConfig = { ...indicatorConfig, rsiPeriod: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        numberField('KDJ', indicatorConfig.kdjPeriod, (n) => {
          indicatorConfig = { ...indicatorConfig, kdjPeriod: n };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        actionButton(t('settings.ind.clearAll', '清空所有指標'), () => {
          opts.onClearAllIndicators?.();
          if (opts.indicatorConfig) indicatorConfig = { ...opts.indicatorConfig };
          renderContent();
        }),
      );
    }
  };

  const setOpen = (next: boolean) => {
    open = next;
    overlay.style.display = open ? 'flex' : 'none';
    if (open) {
      if (opts.indicatorConfig) indicatorConfig = { ...opts.indicatorConfig };
      renderContent();
    }
  };

  renderTabs();
  renderContent();
  dialog.append(header, tabs, content);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  btn.onclick = (e) => {
    e.stopPropagation();
    setOpen(!open);
  };
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    setOpen(false);
  };
  overlay.onclick = () => setOpen(false);
  dialog.onclick = (e) => e.stopPropagation();

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) setOpen(false);
  };
  document.addEventListener('keydown', onKey);

  wrap.append(btn);
  parent.appendChild(wrap);

  const origRemove = wrap.remove.bind(wrap);
  wrap.remove = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    origRemove();
  };

  return wrap;
}