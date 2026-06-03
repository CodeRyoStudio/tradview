import { DEFAULT_INDICATOR_CONFIG, type IndicatorConfig } from '@coderyo/indicators';
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

  const panel = document.createElement('div');
  panel.style.cssText =
    'display:none;position:absolute;right:0;top:100%;margin-top:4px;width:280px;max-height:70vh;overflow:auto;padding:0;background:#161b22;border:1px solid #30363d;border-radius:6px;box-shadow:0 8px 24px #01040988;z-index:30;';

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;border-bottom:1px solid #30363d;';
  const content = document.createElement('div');
  content.style.cssText = 'padding:10px 12px;font-size:12px;';

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
    } else {
      content.appendChild(
        checkbox(t('settings.ind.macd', 'MACD 窗格'), indicatorConfig.showMacd, (v) => {
          indicatorConfig = { ...indicatorConfig, showMacd: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        checkbox(t('settings.ind.rsi', 'RSI 窗格'), indicatorConfig.showRsi, (v) => {
          indicatorConfig = { ...indicatorConfig, showRsi: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
        }),
      );
      content.appendChild(
        checkbox(t('settings.ind.kdj', 'KDJ 窗格'), indicatorConfig.showKdj, (v) => {
          indicatorConfig = { ...indicatorConfig, showKdj: v };
          opts.onIndicatorConfigChange?.(indicatorConfig);
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
    }
  };

  renderTabs();
  renderContent();
  panel.append(tabs, content);

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