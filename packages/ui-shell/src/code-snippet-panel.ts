export function mountCodeSnippetPanel(parent: HTMLElement, getCode: () => string): HTMLElement {
  const wrap = document.createElement('details');
  wrap.style.cssText =
    'flex-shrink:0;border-top:1px solid #30363d;background:#161b22;padding:6px 12px;font-size:11px;color:#8b949e;';

  const summary = document.createElement('summary');
  summary.textContent = '嵌入程式碼（整合方）';
  summary.style.cssText = 'cursor:pointer;color:#58a6ff;user-select:none;';

  const pre = document.createElement('pre');
  pre.style.cssText =
    'margin:8px 0 0;padding:10px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3;font-size:11px;overflow:auto;max-height:160px;white-space:pre-wrap;';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '複製';
  copyBtn.style.cssText =
    'margin-top:6px;padding:4px 10px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:11px;';
  copyBtn.onclick = () => {
    const code = getCode();
    pre.textContent = code;
    void navigator.clipboard.writeText(code);
  };

  wrap.ontoggle = () => {
    if (wrap.open) pre.textContent = getCode();
  };

  wrap.append(summary, pre, copyBtn);
  parent.appendChild(wrap);
  return wrap;
}