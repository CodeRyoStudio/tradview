import { compilePineLite } from '@coderyo/pine-lite';

interface PineDiagnostic {
  line: number;
  col: number;
  message: string;
  severity: 'error' | 'warning';
  endCol?: number;
}
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { linter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view';
import { t } from '@coderyo/i18n';
import { pineLanguage } from './pine-language.js';

export const PINE_SCRIPT_STORAGE_KEY = 'tradview:pine:script';

export function loadPineScriptPreference(): string | null {
  try {
    return localStorage.getItem(PINE_SCRIPT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function savePineScriptPreference(script: string): void {
  try {
    localStorage.setItem(PINE_SCRIPT_STORAGE_KEY, script);
  } catch {
    /* ignore */
  }
}

function offsetAtLineCol(doc: string, line: number, col: number): number {
  const lines = doc.split('\n');
  let off = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    off += lines[i]!.length + 1;
  }
  return off + Math.max(0, col - 1);
}

function pineDiagnosticsToCm(doc: string, diags: PineDiagnostic[]): CmDiagnostic[] {
  return diags.map((d) => {
    const from = offsetAtLineCol(doc, d.line, d.col);
    const to = d.endCol != null ? offsetAtLineCol(doc, d.line, d.endCol) : from + 1;
    return {
      from,
      to: Math.max(from + 1, to),
      severity: d.severity,
      message: d.message,
    };
  });
}

function createPineLinter(onStatus?: (msg: string, ok: boolean) => void) {
  return linter((view) => {
    const src = view.state.doc.toString();
    const result = compilePineLite(src);
    if (result.ok) {
      onStatus?.(t('pine.status.ok', '語法正確'), true);
      return [];
    }
    onStatus?.(result.errors[0] ?? t('pine.status.error', '語法錯誤'), false);
    return pineDiagnosticsToCm(src, result.diagnostics ?? []);
  });
}

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#0d1117',
    color: '#e6edf3',
    fontSize: '12px',
  },
  '.cm-content': { caretColor: '#58a6ff', fontFamily: 'Consolas, "Cascadia Code", monospace' },
  '.cm-gutters': {
    backgroundColor: '#161b22',
    color: '#8b949e',
    borderRight: '1px solid #30363d',
  },
  '.cm-activeLine': { backgroundColor: '#161b22aa' },
  '.cm-activeLineGutter': { backgroundColor: '#21262d' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#264f78' },
  '.cm-cursor': { borderLeftColor: '#58a6ff' },
  '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '2px wavy #f85149' },
  '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '2px wavy #d29922' },
});

export interface PineEditorPanelOptions {
  initialScript?: string;
  /** Debounced apply to chart (ms). Default 400. */
  debounceMs?: number;
  onApply?: (script: string, compileOk: boolean) => void;
}

export function mountPineEditorPanel(
  parent: HTMLElement,
  opts: PineEditorPanelOptions = {},
): {
  el: HTMLElement;
  getScript: () => string;
  setScript: (script: string) => void;
  applyNow: () => void;
  destroy: () => void;
} {
  const wrap = document.createElement('details');
  wrap.className = 'tv-pine-editor';
  wrap.open = true;
  wrap.style.cssText =
    'flex-shrink:0;border-top:1px solid #30363d;background:#161b22;max-height:220px;display:flex;flex-direction:column;';

  const summary = document.createElement('summary');
  summary.textContent = t('pine.editor.title', 'Pine 腳本編輯器');
  summary.style.cssText =
    'cursor:pointer;color:#58a6ff;user-select:none;padding:6px 12px;font-size:12px;flex-shrink:0;';

  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:0 12px 6px;flex-shrink:0;';

  const status = document.createElement('span');
  status.style.cssText = 'font-size:11px;color:#8b949e;flex:1;';
  status.textContent = t('pine.status.idle', '就緒');

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.textContent = t('pine.apply', '套用至圖表');
  applyBtn.style.cssText =
    'padding:4px 10px;background:#238636;color:#fff;border:1px solid #2ea043;border-radius:4px;cursor:pointer;font-size:11px;';

  const host = document.createElement('div');
  host.style.cssText = 'flex:1;min-height:120px;max-height:160px;overflow:hidden;border-top:1px solid #30363d;';

  toolbar.append(status, applyBtn);
  wrap.append(summary, toolbar, host);
  parent.appendChild(wrap);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = opts.debounceMs ?? 400;

  const runApply = (src: string) => {
    const r = compilePineLite(src);
    opts.onApply?.(src, r.ok);
    savePineScriptPreference(src);
    if (r.ok) {
      status.style.color = '#3fb950';
      status.textContent = t('pine.status.ok', '語法正確');
    } else {
      status.style.color = '#f85149';
      status.textContent = r.errors[0] ?? t('pine.status.error', '語法錯誤');
    }
  };

  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    bracketMatching(),
    history(),
    pineLanguage,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    darkTheme,
    createPineLinter((msg, ok) => {
      status.style.color = ok ? '#8b949e' : '#f85149';
      status.textContent = msg;
    }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    placeholder(t('pine.placeholder', '// plot(sma(close, 20))')),
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runApply(u.state.doc.toString()), debounceMs);
    }),
  ];

  const state = EditorState.create({
    doc: opts.initialScript ?? '',
    extensions,
  });

  const view = new EditorView({ state, parent: host });

  applyBtn.onclick = () => runApply(view.state.doc.toString());

  return {
    el: wrap,
    getScript: () => view.state.doc.toString(),
    setScript: (script) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: script },
      });
    },
    applyNow: () => runApply(view.state.doc.toString()),
    destroy: () => {
      view.destroy();
      wrap.remove();
    },
  };
}