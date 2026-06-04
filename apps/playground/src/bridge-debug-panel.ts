import { createDefaultBridge, LAYER_HOST_EVENTS } from '@coderyo/bridge';
import { wireChartBridge } from '@coderyo/core';
import type { ChartController, IChart } from '@coderyo/core';
import { createLayerBridgeRegistration, type LayerController } from '@coderyo/ui-shell';

const TEMPLATES: Record<string, object> = {
  'host.layer.setSyncGroup': {
    type: 'host.layer.setSyncGroup',
    payload: {
      chartId: 'default',
      pane: 'main',
      groupId: 'prices',
      allPages: false,
    },
  },
  'host.layer.setVisible': {
    type: 'host.layer.setVisible',
    payload: {
      chartId: 'default',
      pane: 'volume',
      visible: false,
      allPages: false,
    },
  },
  'host.layer.setActivePage': {
    type: 'host.layer.setActivePage',
    payload: { chartId: 'default', pageId: 'page-1' },
  },
  'host.layer.setPreset': {
    type: 'host.layer.setPreset',
    payload: {
      chartId: 'default',
      replace: false,
      preset: {
        version: 2,
        revision: 2,
        id: 'remote-layout',
        name: 'Remote',
        author: 'integrator',
        pages: [{ id: 'page-1', title: 'Chart' }],
        layers: [],
        groups: [],
      },
    },
  },
  'host.layer.applyTimeScaleSync': {
    type: 'host.layer.applyTimeScaleSync',
    payload: { chartId: 'default', allPages: false },
  },
};

export interface MountBridgeDebugPanelOptions {
  chart: IChart;
  controller: ChartController;
  layerController: LayerController;
  compositorApply: () => void;
  syncCompositorShellVisibility?: () => void;
  chartId?: string;
}

export interface BridgeDebugPanelHandle {
  bridge: ReturnType<typeof createDefaultBridge>;
  teardown: () => void;
  dispatchInbound: (msg: { type: string; payload?: Record<string, unknown> }) => void;
}

export function mountBridgeDebugPanel(
  parent: HTMLElement,
  opts: MountBridgeDebugPanelOptions,
): BridgeDebugPanelHandle {
  const chartId = opts.chartId ?? 'default';
  const bridge = createDefaultBridge({ target: window.parent, origin: '*' });

  let hostMessageHandler: ((msg: { type: string; payload?: Record<string, unknown> }) => void) | null =
    null;
  const origOnMessage = bridge.onMessage.bind(bridge);
  bridge.onMessage = (handler) => {
    hostMessageHandler = handler;
    return origOnMessage(handler);
  };

  const log: Array<{ dir: 'in' | 'out'; ts: number; body: unknown }> = [];
  let renderLog = () => {};

  const teardownWire = wireChartBridge({
    controller: opts.controller,
    chart: opts.chart,
    bridge,
    chartId,
    layerBridge: createLayerBridgeRegistration({
      chartId,
      chart: opts.chart,
      layerController: opts.layerController,
      compositorApply: opts.compositorApply,
      syncCompositorShellVisibility: opts.syncCompositorShellVisibility,
    }),
  });

  const panel = document.createElement('aside');
  panel.className = 'tv-bridge-debug';
  panel.style.cssText =
    'position:fixed;right:8px;bottom:48px;width:360px;max-height:50vh;z-index:9999;display:flex;flex-direction:column;gap:6px;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:8px;font:11px/1.4 ui-monospace,monospace;color:#e6edf3;box-shadow:0 8px 24px rgba(0,0,0,.4);';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;';
  const title = document.createElement('strong');
  title.textContent = 'Bridge debug (schema 2)';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = '−';
  toggle.style.cssText =
    'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:0 6px;cursor:pointer;';
  header.append(title, toggle);

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-height:0;';

  const strictChartIdLabel = document.createElement('label');
  strictChartIdLabel.style.cssText =
    'display:flex;align-items:center;gap:6px;color:#8b949e;font-size:10px;';
  const strictChartIdToggle = document.createElement('input');
  strictChartIdToggle.type = 'checkbox';
  strictChartIdToggle.checked = false;
  strictChartIdLabel.append(strictChartIdToggle, document.createTextNode('Strict payload (no auto chartId)'));

  const templateSelect = document.createElement('select');
  templateSelect.style.cssText =
    'background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:4px;font-size:11px;';
  for (const t of LAYER_HOST_EVENTS) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    templateSelect.appendChild(opt);
  }

  const editor = document.createElement('textarea');
  editor.rows = 8;
  editor.spellcheck = false;
  editor.style.cssText =
    'width:100%;resize:vertical;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:6px;font:inherit;';

  const loadTemplate = () => {
    const key = templateSelect.value;
    editor.value = JSON.stringify(TEMPLATES[key] ?? { type: key, payload: { chartId } }, null, 2);
  };
  templateSelect.onchange = loadTemplate;
  loadTemplate();

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.textContent = 'Send inbound';
  sendBtn.style.cssText =
    'background:#238636;color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;';
  const copyLogBtn = document.createElement('button');
  copyLogBtn.type = 'button';
  copyLogBtn.textContent = 'Copy log';
  copyLogBtn.style.cssText =
    'background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;padding:4px 8px;cursor:pointer;';
  const clearLogBtn = document.createElement('button');
  clearLogBtn.type = 'button';
  clearLogBtn.textContent = 'Clear';
  clearLogBtn.style.cssText = copyLogBtn.style.cssText;
  btnRow.append(sendBtn, copyLogBtn, clearLogBtn);

  const logEl = document.createElement('pre');
  logEl.style.cssText =
    'margin:0;overflow:auto;max-height:140px;background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:6px;white-space:pre-wrap;word-break:break-all;';

  renderLog = () => {
    logEl.textContent = log
      .slice(-40)
      .map((e) => {
        const arrow = e.dir === 'in' ? '←' : '→';
        return `${arrow} ${new Date(e.ts).toISOString().slice(11, 23)} ${JSON.stringify(e.body)}`;
      })
      .join('\n');
  };

  const origPost = bridge.post.bind(bridge);
  bridge.post = (event) => {
    log.push({ dir: 'out', ts: Date.now(), body: event });
    renderLog();
    origPost(event);
  };

  const dispatchInbound = (msg: { type: string; payload?: Record<string, unknown> }) => {
    hostMessageHandler?.(msg);
  };

  sendBtn.onclick = () => {
    try {
      const parsed = JSON.parse(editor.value) as { type?: string; payload?: Record<string, unknown> };
      if (!parsed?.type) throw new Error('JSON must include "type"');
      const payload = strictChartIdToggle.checked
        ? { ...parsed.payload }
        : { chartId, ...parsed.payload };
      const msg = {
        type: parsed.type,
        payload,
      };
      log.push({ dir: 'in', ts: Date.now(), body: msg });
      renderLog();
      dispatchInbound(msg);
    } catch (err) {
      log.push({
        dir: 'in',
        ts: Date.now(),
        body: { error: err instanceof Error ? err.message : String(err) },
      });
      renderLog();
    }
  };

  copyLogBtn.onclick = () => {
    const text = log.map((e) => `${e.dir}\t${e.ts}\t${JSON.stringify(e.body)}`).join('\n');
    void navigator.clipboard?.writeText(text);
  };

  clearLogBtn.onclick = () => {
    log.length = 0;
    renderLog();
  };

  let collapsed = false;
  toggle.onclick = () => {
    collapsed = !collapsed;
    body.style.display = collapsed ? 'none' : 'flex';
    toggle.textContent = collapsed ? '+' : '−';
  };

  body.append(strictChartIdLabel, templateSelect, editor, btnRow, logEl);
  panel.append(header, body);
  parent.appendChild(panel);

  const onHostMessage = (ev: MessageEvent) => {
    const data = ev.data as { type?: string };
    if (data?.type?.startsWith('host.')) {
      log.push({ dir: 'in', ts: Date.now(), body: data });
      renderLog();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('message', onHostMessage);
  }

  return {
    bridge,
    teardown: () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', onHostMessage);
      }
      teardownWire();
      panel.remove();
    },
    dispatchInbound,
  };
}