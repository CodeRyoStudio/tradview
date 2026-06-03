import type { DrawingRecord } from '@coderyo/drawings';
import { t } from '@coderyo/i18n';

export interface DrawingPropertiesPanelOptions {
  onStyleChange?: (patch: { color?: string; lineWidth?: number; text?: string }) => void;
}

export function mountDrawingPropertiesPanel(
  parent: HTMLElement,
  opts: DrawingPropertiesPanelOptions = {},
): { el: HTMLElement; bind: (drawing: DrawingRecord | null) => void } {
  const panel = document.createElement('aside');
  panel.className = 'tv-drawing-props';
  panel.style.cssText =
    'display:none;width:220px;flex-shrink:0;border-left:1px solid #30363d;background:#161b22;padding:10px 12px;font-size:12px;color:#e6edf3;overflow:auto;';

  const title = document.createElement('div');
  title.textContent = t('drawing.props.title', '繪圖屬性');
  title.style.cssText = 'font-weight:600;margin-bottom:10px;';

  const typeEl = document.createElement('div');
  typeEl.style.color = '#8b949e';
  typeEl.style.marginBottom = '10px';

  const mkRow = (label: string) => {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;';
    const span = document.createElement('span');
    span.textContent = label;
    span.style.color = '#8b949e';
    row.appendChild(span);
    return row;
  };

  const colorRow = mkRow(t('drawing.props.color', '顏色'));
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.style.cssText = 'width:100%;height:28px;border:none;background:transparent;cursor:pointer;';
  colorRow.appendChild(colorInput);

  const widthRow = mkRow(t('drawing.props.lineWidth', '線寬'));
  const widthInput = document.createElement('input');
  widthInput.type = 'range';
  widthInput.min = '1';
  widthInput.max = '6';
  widthInput.style.width = '100%';
  widthRow.appendChild(widthInput);

  const textRow = mkRow(t('drawing.props.text', '文字'));
  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.style.cssText =
    'padding:4px 8px;border-radius:4px;border:1px solid #30363d;background:#0d1117;color:#e6edf3;';
  textRow.appendChild(textInput);

  const lockedHint = document.createElement('div');
  lockedHint.style.cssText = 'color:#f78166;font-size:11px;margin-top:6px;display:none;';
  lockedHint.textContent = t('drawing.props.locked', '已鎖定 — 解鎖後可編輯');

  panel.append(title, typeEl, colorRow, widthRow, textRow, lockedHint);
  parent.appendChild(panel);

  const emit = () => {
    opts.onStyleChange?.({
      color: colorInput.value,
      lineWidth: Number(widthInput.value),
      text: textInput.value,
    });
  };
  colorInput.oninput = emit;
  widthInput.oninput = emit;
  textInput.oninput = emit;

  const bind = (drawing: DrawingRecord | null) => {
    if (!drawing) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    typeEl.textContent = `${t('drawing.props.type', '類型')}: ${drawing.type}`;
    const meta = drawing.meta ?? {};
    colorInput.value = String(meta.color ?? '#58a6ff');
    widthInput.value = String(meta.lineWidth ?? 2);
    textInput.value = String(meta.text ?? 'Note');
    textRow.style.display = drawing.type === 'text' ? 'flex' : 'none';
    const locked = Boolean(meta.locked);
    lockedHint.style.display = locked ? 'block' : 'none';
    colorInput.disabled = locked;
    widthInput.disabled = locked;
    textInput.disabled = locked;
  };

  return { el: panel, bind };
}