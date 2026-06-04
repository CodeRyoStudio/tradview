import { t } from '@coderyo/i18n';
import { isChartPaneLayerType } from './chart-pane-mount.js';
import type { LayerController } from './layer-controller.js';

export interface LayerPanelOptions {
  onSaveAsPreset?: (preset: ReturnType<LayerController['getPreset']>) => void;
}

export interface LayerPanelHandle {
  el: HTMLElement;
  destroy: () => void;
  toggle: () => boolean;
  /** Replace panel checkbox selection (e.g. compositor shift+marquee). */
  selectLayers(layerIds: string[]): void;
}

/** @public Layer list UI bound to a LayerController. */
export function mountLayerPanel(
  parent: HTMLElement,
  controller: LayerController,
  opts: LayerPanelOptions = {},
): LayerPanelHandle {
  const panel = document.createElement('aside');
  panel.className = 'tv-layer-panel';
  panel.style.cssText =
    'display:none;position:fixed;right:12px;top:72px;width:240px;max-height:min(70vh,480px);z-index:2100;background:#161b22;border:1px solid #30363d;border-radius:8px;box-shadow:0 8px 24px #01040999;flex-direction:column;overflow:hidden;font-size:11px;color:#e6edf3;';

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #30363d;flex-shrink:0;';
  const title = document.createElement('span');
  title.textContent = t('layer.panel.title', '圖層');
  title.style.fontWeight = '600';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.style.cssText =
    'background:transparent;border:none;color:#8b949e;font-size:18px;cursor:pointer;line-height:1;';
  header.append(title, closeBtn);

  const groupBar = document.createElement('div');
  groupBar.style.cssText =
    'display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #30363d;flex-shrink:0;flex-wrap:wrap;';
  const createGroupBtn = document.createElement('button');
  createGroupBtn.type = 'button';
  createGroupBtn.textContent = t('layer.panel.createGroup', '建立群組');
  createGroupBtn.style.cssText =
    'flex:1;min-width:0;padding:4px 6px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:10px;';
  const removeFromGroupBtn = document.createElement('button');
  removeFromGroupBtn.type = 'button';
  removeFromGroupBtn.textContent = t('layer.panel.removeFromGroup', '移出群組');
  removeFromGroupBtn.style.cssText = createGroupBtn.style.cssText;
  const ungroupBtn = document.createElement('button');
  ungroupBtn.type = 'button';
  ungroupBtn.textContent = t('layer.panel.ungroup', '解散群組');
  ungroupBtn.style.cssText = createGroupBtn.style.cssText;
  groupBar.append(createGroupBtn, removeFromGroupBtn, ungroupBtn);

  const list = document.createElement('div');
  list.style.cssText = 'overflow:auto;flex:1;min-height:0;padding:6px 4px;';

  const footer = document.createElement('div');
  footer.style.cssText = 'padding:8px;border-top:1px solid #30363d;flex-shrink:0;';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = t('layer.panel.saveAs', '另存為我的範本');
  saveBtn.style.cssText =
    'width:100%;padding:6px 8px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:4px;cursor:pointer;font-size:11px;';
  footer.appendChild(saveBtn);

  panel.append(header, groupBar, list, footer);
  parent.appendChild(panel);

  let open = false;
  const selected = new Set<string>();
  let dragLayerId: string | null = null;

  const btnStyle =
    'width:24px;height:22px;padding:0;border:1px solid #30363d;border-radius:3px;background:#21262d;cursor:pointer;font-size:10px;';

  const render = () => {
    list.replaceChildren();
    const layers = [...controller.getLayersForActivePage()].sort((a, b) => b.zIndex - a.zIndex);

    for (const id of [...selected]) {
      if (!layers.some((l) => l.id === id)) selected.delete(id);
    }

    createGroupBtn.disabled = selected.size < 2;
    const selectedWithGroup = layers.filter((l) => selected.has(l.id) && l.groupId);
    ungroupBtn.disabled = selectedWithGroup.length === 0;
    const singleInGroup =
      selected.size === 1 &&
      [...selected].some((id) => controller.getLayer(id)?.groupId);
    removeFromGroupBtn.disabled = !singleInGroup;

    for (const layer of layers) {
      const row = document.createElement('div');
      row.draggable = !layer.locked;
      row.dataset.layerId = layer.id;
      row.style.cssText =
        'display:flex;align-items:center;gap:4px;padding:4px 6px;margin-bottom:2px;border-radius:4px;background:#0d1117;border:1px solid #21262d;cursor:grab;';

      row.ondragstart = (e) => {
        if (layer.locked) return;
        dragLayerId = layer.id;
        e.dataTransfer?.setData('text/plain', layer.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        row.style.opacity = '0.55';
      };
      row.ondragend = () => {
        row.style.opacity = '';
        dragLayerId = null;
      };
      row.ondragover = (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      };
      row.ondrop = (e) => {
        e.preventDefault();
        if (!dragLayerId || dragLayerId === layer.id) return;
        const visual = [...controller.getLayersForActivePage()].sort(
          (a, b) => b.zIndex - a.zIndex,
        );
        const ids = visual.map((l) => l.id);
        const from = ids.indexOf(dragLayerId);
        const to = ids.indexOf(layer.id);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, dragLayerId);
        controller.reorderLayers([...ids].reverse());
        dragLayerId = null;
      };

      const pick = document.createElement('input');
      pick.type = 'checkbox';
      pick.checked = selected.has(layer.id);
      pick.title = t('layer.panel.select', '選取');
      pick.style.cssText = 'width:14px;height:14px;cursor:pointer;flex-shrink:0;';
      pick.onchange = () => {
        if (pick.checked) selected.add(layer.id);
        else selected.delete(layer.id);
        render();
      };

      const eye = document.createElement('button');
      eye.type = 'button';
      eye.textContent = layer.visible ? '👁' : '—';
      eye.title = t('layer.panel.visibility', '顯示');
      eye.style.cssText = btnStyle;

      const lock = document.createElement('button');
      lock.type = 'button';
      lock.textContent = layer.locked ? '🔒' : '🔓';
      lock.title = t('layer.panel.lock', '鎖定');
      lock.style.cssText = btnStyle;

      const label = document.createElement('span');
      const groupTag = layer.groupId ? ` [${layer.groupId.slice(-4)}]` : '';
      label.textContent = `${layer.widgetKey}${groupTag}`;
      label.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

      let syncIn: HTMLInputElement | null = null;
      if (isChartPaneLayerType(layer.type)) {
        syncIn = document.createElement('input');
        syncIn.type = 'text';
        syncIn.placeholder = t('layer.panel.syncGroup', '時間軸組');
        syncIn.value = layer.syncTimeScaleGroupId ?? '';
        syncIn.title = t(
          'layer.panel.syncGroupHint',
          '相同組名同步縮放；留空則獨立',
        );
        syncIn.style.cssText =
          'width:52px;flex-shrink:0;padding:2px 4px;font-size:10px;background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:3px;';
        syncIn.onchange = () => {
          controller.setLayerSyncGroup(layer.id, syncIn!.value);
        };
      }

      const zUp = document.createElement('button');
      zUp.type = 'button';
      zUp.textContent = '▲';
      zUp.title = 'z+';
      zUp.style.cssText = btnStyle;
      const zDown = document.createElement('button');
      zDown.type = 'button';
      zDown.textContent = '▼';
      zDown.title = 'z-';
      zDown.style.cssText = btnStyle;

      eye.onclick = () => controller.setLayerVisible(layer.id, !layer.visible);
      lock.onclick = () => controller.setLayerLocked(layer.id, !layer.locked);
      zUp.onclick = () => controller.bumpZIndex(layer.id, 1);
      zDown.onclick = () => controller.bumpZIndex(layer.id, -1);

      if (syncIn) row.append(pick, eye, lock, label, syncIn, zUp, zDown);
      else row.append(pick, eye, lock, label, zUp, zDown);
      list.appendChild(row);
    }
  };

  createGroupBtn.onclick = () => {
    const ids = [...selected];
    if (ids.length < 2) return;
    controller.createBindGroup(ids);
    selected.clear();
    render();
  };

  removeFromGroupBtn.onclick = () => {
    const id = [...selected][0];
    if (!id) return;
    controller.removeLayerFromGroup(id);
    render();
  };

  ungroupBtn.onclick = () => {
    const groupIds = new Set<string>();
    for (const id of selected) {
      const layer = controller.getLayer(id);
      if (layer?.groupId) groupIds.add(layer.groupId);
    }
    for (const gid of groupIds) controller.dissolveGroup(gid);
    render();
  };

  const unsub = controller.subscribe(render);
  render();

  closeBtn.onclick = () => {
    open = false;
    panel.style.display = 'none';
  };

  saveBtn.onclick = () => opts.onSaveAsPreset?.(controller.getPreset());

  return {
    el: panel,
    destroy: () => {
      unsub();
      panel.remove();
    },
    toggle: () => {
      open = !open;
      panel.style.display = open ? 'flex' : 'none';
      return open;
    },
    selectLayers(layerIds: string[]) {
      selected.clear();
      for (const id of layerIds) selected.add(id);
      render();
    },
  };
}