import { isChartPaneLayerType } from './chart-pane-mount.js';
import { isOverlayLayerType } from './overlay-mount.js';
import type { LayerWidgetKey } from './types.js';
import { LayerController } from './layer-controller.js';
import type { LayerNode, LayoutPreset } from './types.js';
import { attachLayerEditor } from './layer-editor.js';

export type LayerWidgetElements = Partial<Record<LayerWidgetKey, HTMLElement>>;

export interface LayerCompositorOptions {
  preset: LayoutPreset;
  widgets: LayerWidgetElements;
  /** Hide legacy grid container when compositor positions widgets. */
  hideLegacyGrid?: HTMLElement;
  /** Fired after user drag/resize commits a preset change. */
  onPresetChange?: (preset: LayoutPreset) => void;
  /** Shift+drag marquee on compositor root (edit mode). */
  onMarqueeSelect?: (layerIds: string[]) => void;
  /** P2: chart pane focus changed (main / volume / indicator). */
  onChartPaneFocus?: (pane: 'main' | 'volume' | 'indicator' | null) => void;
}

export interface LayerCompositorHandle {
  root: HTMLElement;
  controller: LayerController;
  apply(): void;
  enableLayerEditor(enabled: boolean): void;
  isLayerEditorEnabled(): boolean;
  destroy(): void;
}

function resolveWidgetEl(
  widgets: LayerWidgetElements,
  layer: LayerNode,
): HTMLElement | undefined {
  const key = layer.widgetKey as LayerWidgetKey;
  if (layer.type === 'overlay.drawing') {
    return widgets.drawingOverlay ?? widgets.chartMain ?? widgets.chartHost;
  }
  return (
    widgets[key] ??
    (layer.widgetKey === 'chartMain' ? widgets.chartHost : undefined) ??
    (layer.widgetKey === 'chartIndicator' ? widgets.indicatorHost : undefined)
  );
}

function applyWrapFrame(wrap: HTMLElement, layer: LayerNode): void {
  wrap.style.left = `${layer.frame.x * 100}%`;
  wrap.style.top = `${layer.frame.y * 100}%`;
  wrap.style.width = `${layer.frame.w * 100}%`;
  wrap.style.height = `${layer.frame.h * 100}%`;
  wrap.style.zIndex = String(layer.zIndex + 1);
}

function layerStructureSignature(layers: LayerNode[], activePageId: string): string {
  return `${activePageId}|${layers
    .map((l) => `${l.id}:${l.type}:${l.widgetKey}:${l.visible}:${l.locked}`)
    .join('|')}`;
}

function wrapPointerEventsForLayer(layer: LayerNode, editorEnabled: boolean): string {
  if (layer.locked) return 'none';
  if (isOverlayLayerType(layer.type)) return 'none';
  if (isChartPaneLayerType(layer.type) && editorEnabled) return 'none';
  return 'auto';
}

/** @public Mount floating layer compositor (LayoutPreset v2) over shell widgets. */
export function mountLayerCompositor(
  parent: HTMLElement,
  opts: LayerCompositorOptions,
): LayerCompositorHandle {
  const controller = new LayerController(opts.preset);
  const wrappers = new Map<string, HTMLElement>();
  let lastStructureSig = '';

  const root = document.createElement('div');
  root.className = 'tv-layer-compositor';
  root.style.cssText =
    'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;';
  parent.style.position = parent.style.position || 'relative';
  parent.appendChild(root);

  const editor = attachLayerEditor(root, {
    controller,
    onPresetChange: () => opts.onPresetChange?.(controller.getPreset()),
    onMarqueeSelect: opts.onMarqueeSelect,
  });

  const applyFocusStyles = () => {
    const focused = controller.focusedPaneLayerId;
    for (const [id, wrap] of wrappers) {
      const layer = controller.getLayer(id);
      if (!layer || !isChartPaneLayerType(layer.type)) continue;
      const active = id === focused;
      wrap.dataset.focused = active ? '1' : '0';
      wrap.style.outline = active ? '2px solid #58a6ff' : 'none';
      wrap.style.outlineOffset = active ? '-2px' : '';
    }
  };

  const patchFocusVisuals = (layers: LayerNode[]) => {
    for (const layer of layers) {
      const wrap = wrappers.get(layer.id);
      if (wrap) applyWrapFrame(wrap, layer);
    }
    applyFocusStyles();
  };

  const patchLayoutFrames = (layers: LayerNode[], patchOpts: { rebind?: boolean } = {}) => {
    patchFocusVisuals(layers);
    if (patchOpts.rebind !== false) editor.rebind();
  };

  const ensureDefaultChartFocus = (chartPaneIds: string[]) => {
    if (
      controller.focusedPaneLayerId &&
      !chartPaneIds.includes(controller.focusedPaneLayerId)
    ) {
      controller.focusedPaneLayerId = chartPaneIds[chartPaneIds.length - 1] ?? null;
    }
    if (!controller.focusedPaneLayerId && chartPaneIds.length > 0) {
      controller.focusedPaneLayerId = chartPaneIds[chartPaneIds.length - 1]!;
    }
  };

  const bindChartPanePointer = (wrap: HTMLElement, layer: LayerNode) => {
    wrap.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || controller.isInteracting()) return;
      const prev = controller.focusedPaneLayerId;
      if (prev === layer.id) return;
      queueMicrotask(() => {
        if (controller.isInteracting()) return;
        controller.focusChartPane(layer.id);
        opts.onChartPaneFocus?.(controller.getFocusedPaneId());
      });
    });
  };

  const syncRootPointerEvents = () => {
    root.style.pointerEvents = editor.isEnabled() ? 'auto' : 'none';
  };

  const apply = () => {
    syncRootPointerEvents();
    const preset = controller.getPreset();
    const layers = preset.layers
      .filter((l) => l.pageId === controller.activePageId && l.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    if (opts.hideLegacyGrid) opts.hideLegacyGrid.style.visibility = 'hidden';

    const chartPaneIds = layers.filter((l) => isChartPaneLayerType(l.type)).map((l) => l.id);
    ensureDefaultChartFocus(chartPaneIds);

    const structureSig = layerStructureSignature(layers, controller.activePageId);
    if (structureSig === lastStructureSig && wrappers.size > 0) {
      patchLayoutFrames(layers);
      return;
    }
    lastStructureSig = structureSig;

    root.replaceChildren();
    wrappers.clear();

    const editorOn = editor.isEnabled();

    for (const layer of layers) {
      if (layer.type === 'overlay.drawing') continue;

      const el = resolveWidgetEl(opts.widgets, layer);
      if (!el) continue;

      const wrap = document.createElement('div');
      wrap.className = 'tv-layer-wrap';
      if (isChartPaneLayerType(layer.type)) wrap.classList.add('tv-chart-pane-wrap');
      if (isOverlayLayerType(layer.type)) wrap.classList.add('tv-overlay-wrap');
      wrap.dataset.layerId = layer.id;
      wrap.dataset.widgetKey = layer.widgetKey;
      wrap.dataset.layerType = layer.type;
      if (layer.groupId) wrap.dataset.groupId = layer.groupId;

      const pe = wrapPointerEventsForLayer(layer, editorOn);
      wrap.style.cssText = [
        'position:absolute',
        'overflow:visible',
        'box-sizing:border-box',
        `pointer-events:${pe}`,
      ].join(';');
      applyWrapFrame(wrap, layer);

      if (isChartPaneLayerType(layer.type) && !layer.locked && !editorOn) {
        bindChartPanePointer(wrap, layer);
      }

      if (layer.type === 'overlay.crosshairLegend') {
        el.style.pointerEvents = 'none';
      }

      el.style.width = '100%';
      el.style.height = '100%';
      el.style.minWidth = '0';
      el.style.minHeight = '0';
      el.style.overflow = layer.type === 'overlay.crosshairLegend' ? 'visible' : 'hidden';
      wrap.appendChild(el);
      root.appendChild(wrap);
      wrappers.set(layer.id, wrap);
    }

    applyFocusStyles();
    editor.rebind();
  };

  const unsubLayout = controller.subscribe(apply);
  const unsubFocus = controller.subscribeFocus(() => {
    const visible = controller
      .getLayersForActivePage()
      .filter((l) => l.visible);
    patchFocusVisuals(visible);
  });

  apply();

  return {
    root,
    controller,
    apply,
    enableLayerEditor: (enabled) => {
      editor.setEnabled(enabled);
      syncRootPointerEvents();
      apply();
    },
    isLayerEditorEnabled: () => editor.isEnabled(),
    destroy: () => {
      unsubLayout();
      unsubFocus();
      editor.destroy();
      root.remove();
      if (opts.hideLegacyGrid) opts.hideLegacyGrid.style.visibility = '';
    },
  };
}