import { describe, expect, it, vi } from 'vitest';
import { mountLayerCompositor } from '../src/layer/compositor.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import type { LayerWidgetKey } from '../src/layer/types.js';

function mountTestCompositor(onPresetChange = vi.fn(), onMarqueeSelect = vi.fn()) {
  const parent = document.createElement('div');
  parent.style.cssText = 'position:relative;width:800px;height:600px;';
  document.body.appendChild(parent);

  const preset = cloneLayoutPreset(VENDOR_DEFAULT_PRESET);
  const widgets: Partial<Record<LayerWidgetKey, HTMLElement>> = {};
  for (const layer of preset.layers) {
    if (!widgets[layer.widgetKey as LayerWidgetKey]) {
      widgets[layer.widgetKey as LayerWidgetKey] = document.createElement('div');
    }
  }

  const compositor = mountLayerCompositor(parent, {
    preset,
    widgets,
    onPresetChange,
    onMarqueeSelect,
  });
  compositor.enableLayerEditor(true);
  return { parent, compositor, onPresetChange, onMarqueeSelect };
}

function pointer(
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  clientX: number,
  clientY: number,
  init: PointerEventInit = {},
) {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      ...init,
    }),
  );
}

describe('attachLayerEditor (DOM)', () => {
  it('commits move on pointerup with delta', () => {
    const onPresetChange = vi.fn();
    const { compositor } = mountTestCompositor(onPresetChange);
    const left = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.widgetKey === 'leftToolbar')!;
    const wrap = compositor.root.querySelector(
      `[data-layer-id="${left.id}"]`,
    ) as HTMLElement;
    const y0 = left.frame.y;

    pointer(wrap, 'pointerdown', 100, 100);
    pointer(wrap, 'pointermove', 100, 160);
    pointer(wrap, 'pointerup', 100, 160);

    expect(onPresetChange).toHaveBeenCalledTimes(1);
    expect(compositor.controller.getLayer(left.id)!.frame.y).toBeGreaterThan(y0);
  });

  it('does not commit resize when unchanged', () => {
    const onPresetChange = vi.fn();
    const { compositor } = mountTestCompositor(onPresetChange);
    const left = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.widgetKey === 'leftToolbar')!;
    const wrap = compositor.root.querySelector(
      `[data-layer-id="${left.id}"]`,
    ) as HTMLElement;
    const handle = wrap.querySelector('.tv-layer-handle-se') as HTMLElement;

    pointer(handle, 'pointerdown', 200, 200);
    pointer(handle, 'pointerup', 200, 200);

    expect(onPresetChange).not.toHaveBeenCalled();
  });

  it('rebinds handles after apply()', () => {
    const { compositor } = mountTestCompositor();
    const left = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.widgetKey === 'leftToolbar')!;
    compositor.apply();
    const wrap = compositor.root.querySelector(
      `[data-layer-id="${left.id}"]`,
    ) as HTMLElement;
    expect(wrap.querySelectorAll('.tv-layer-handle').length).toBe(4);
  });

  it('shift+marquee selects intersecting layers', () => {
    const onMarqueeSelect = vi.fn();
    const { compositor } = mountTestCompositor(vi.fn(), onMarqueeSelect);
    pointer(compositor.root, 'pointerdown', 10, 10, { shiftKey: true });
    pointer(compositor.root, 'pointermove', 400, 400);
    pointer(compositor.root, 'pointerup', 400, 400);
    expect(onMarqueeSelect).toHaveBeenCalled();
    expect(onMarqueeSelect.mock.calls[0]![0].length).toBeGreaterThan(0);
  });

  it('chart pane drag works when child captures pointer (LWC-like)', () => {
    const onPresetChange = vi.fn();
    const { compositor } = mountTestCompositor(onPresetChange);
    const main = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.type === 'chart.main')!;
    const wrap = compositor.root.querySelector(
      `[data-layer-id="${main.id}"]`,
    ) as HTMLElement;
    const blocker = document.createElement('div');
    blocker.style.cssText = 'width:100%;height:100%;pointer-events:auto;';
    wrap.appendChild(blocker);
    compositor.enableLayerEditor(true);

    const y0 = main.frame.y;
    pointer(wrap, 'pointerdown', 120, 120);
    pointer(wrap, 'pointermove', 120, 200);
    pointer(wrap, 'pointerup', 120, 200);

    expect(onPresetChange).toHaveBeenCalled();
    expect(compositor.controller.getLayer(main.id)!.frame.y).toBeGreaterThan(y0);
  });

  it('chart pane drag works on same gesture when focus changes', async () => {
    const onPresetChange = vi.fn();
    const { compositor } = mountTestCompositor(onPresetChange);
    const main = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.type === 'chart.main')!;
    const vol = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.type === 'chart.volume')!;
    compositor.controller.focusChartPane(main.id);

    const volWrap = compositor.root.querySelector(
      `[data-layer-id="${vol.id}"]`,
    ) as HTMLElement;
    const y0 = vol.frame.y;

    pointer(volWrap, 'pointerdown', 100, 100);
    pointer(volWrap, 'pointermove', 100, 180);
    pointer(volWrap, 'pointerup', 100, 180);
    await Promise.resolve();

    expect(onPresetChange).toHaveBeenCalled();
    expect(compositor.controller.getLayer(vol.id)!.frame.y).toBeGreaterThan(y0);
    expect(compositor.controller.getFocusedPaneLayerId()).toBe(vol.id);
    expect(
      compositor.root.querySelector(`[data-layer-id="${main.id}"]`),
    ).toBeTruthy();
  });

  it('blocks setPreset during active drag', () => {
    const { compositor } = mountTestCompositor();
    const left = compositor.controller
      .getLayersForActivePage()
      .find((l) => l.widgetKey === 'leftToolbar')!;
    const wrap = compositor.root.querySelector(
      `[data-layer-id="${left.id}"]`,
    ) as HTMLElement;
    pointer(wrap, 'pointerdown', 50, 50);
    expect(compositor.controller.isInteracting()).toBe(true);
    const ok = compositor.controller.setPreset(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    expect(ok).toBe(false);
    pointer(wrap, 'pointerup', 50, 120);
    expect(compositor.controller.isInteracting()).toBe(false);
  });
});