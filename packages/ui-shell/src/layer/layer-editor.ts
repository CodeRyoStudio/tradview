import type { LayerController } from './layer-controller.js';
import { getLayersBoundingBox, resizeGroupFrames } from './group-utils.js';
import { clampFrame } from './normalize.js';
import type { LayerFrame } from './types.js';

export interface LayerEditorOptions {
  controller: LayerController;
  /** Called after drag/resize commits preset changes. */
  onPresetChange?: () => void;
  /** Shift+drag marquee selection on compositor root. */
  onMarqueeSelect?: (layerIds: string[]) => void;
}

export interface LayerEditorHandle {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  rebind(): void;
  destroy(): void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  se: 'nwse-resize',
};

const EPS = 1e-6;

function framesEqual(a: LayerFrame, b: LayerFrame, eps = EPS): boolean {
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.w - b.w) < eps &&
    Math.abs(a.h - b.h) < eps
  );
}

function frameIntersects(a: LayerFrame, b: LayerFrame): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Let wrap receive drag/resize; LWC and buttons live inside children. */
function setWrapContentPassthrough(wrap: HTMLElement, passthrough: boolean): void {
  for (const child of wrap.children) {
    if ((child as HTMLElement).classList.contains('tv-layer-handle')) continue;
    (child as HTMLElement).style.pointerEvents = passthrough ? 'none' : '';
  }
}

function clearWrapContentPassthrough(wrap: HTMLElement): void {
  for (const child of wrap.children) {
    if ((child as HTMLElement).classList.contains('tv-layer-handle')) continue;
    (child as HTMLElement).style.pointerEvents = '';
  }
}

export function attachLayerEditor(
  compositorRoot: HTMLElement,
  opts: LayerEditorOptions,
): LayerEditorHandle {
  const { controller, onPresetChange, onMarqueeSelect } = opts;
  let enabled = false;
  let abort: AbortController | null = null;
  let captureEl: HTMLElement | null = null;
  let capturePointerId: number | null = null;

  const releaseCapture = () => {
    if (captureEl && capturePointerId !== null) {
      try {
        captureEl.releasePointerCapture(capturePointerId);
      } catch {
        /* already released */
      }
    }
    if (capturePointerId !== null && controller.isInteracting()) {
      controller.endInteraction();
    }
    captureEl = null;
    capturePointerId = null;
  };

  const setCapture = (el: HTMLElement, pointerId: number) => {
    releaseCapture();
    captureEl = el;
    capturePointerId = pointerId;
    controller.beginInteraction();
    try {
      el.setPointerCapture(pointerId);
    } catch {
      controller.endInteraction();
      captureEl = null;
      capturePointerId = null;
    }
  };

  const normDelta = (dxPx: number, dyPx: number) => {
    const w = compositorRoot.clientWidth || 1;
    const h = compositorRoot.clientHeight || 1;
    return { dx: dxPx / w, dy: dyPx / h };
  };

  const applyWrapStyle = (wrap: HTMLElement, frame: LayerFrame) => {
    wrap.style.left = `${frame.x * 100}%`;
    wrap.style.top = `${frame.y * 100}%`;
    wrap.style.width = `${frame.w * 100}%`;
    wrap.style.height = `${frame.h * 100}%`;
  };

  const decorateWrap = (wrap: HTMLElement, layerId: string) => {
    wrap.querySelectorAll('.tv-layer-handle').forEach((el) => el.remove());
    const layer = controller.getLayer(layerId);
    if (!layer || layer.locked) {
      wrap.classList.remove('tv-layer-editable');
      wrap.style.cursor = '';
      wrap.style.outline = '';
      clearWrapContentPassthrough(wrap);
      return;
    }
    wrap.classList.add('tv-layer-editable');
    wrap.style.cursor = 'move';
    setWrapContentPassthrough(wrap, true);
    if (wrap.dataset.focused === '1') {
      wrap.style.outline = '2px solid #58a6ff';
      wrap.style.outlineOffset = '-2px';
    } else {
      wrap.style.outline = '1px dashed #58a6ff88';
      wrap.style.outlineOffset = '';
    }

    const handles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
    for (const h of handles) {
      const handle = document.createElement('div');
      handle.className = `tv-layer-handle tv-layer-handle-${h}`;
      handle.dataset.handle = h;
      handle.style.cssText = [
        'position:absolute',
        'width:8px',
        'height:8px',
        'background:#58a6ff',
        'border:1px solid #0d1117',
        'border-radius:2px',
        'z-index:2',
        `cursor:${HANDLE_CURSORS[h]}`,
        h.includes('n') ? 'top:-4px' : 'bottom:-4px',
        h.includes('w') ? 'left:-4px' : 'right:-4px',
      ].join(';');
      wrap.appendChild(handle);
    }
  };

  const commitChange = () => {
    onPresetChange?.();
  };

  const computeResizeBbox = (
    startBbox: LayerFrame,
    corner: ResizeHandle,
    dx: number,
    dy: number,
  ): LayerFrame => {
    let newBbox = { ...startBbox };
    if (corner.includes('e')) newBbox.w = startBbox.w + dx;
    if (corner.includes('w')) {
      newBbox.x = startBbox.x + dx;
      newBbox.w = startBbox.w - dx;
    }
    if (corner.includes('s')) newBbox.h = startBbox.h + dy;
    if (corner.includes('n')) {
      newBbox.y = startBbox.y + dy;
      newBbox.h = startBbox.h - dy;
    }
    return clampFrame(newBbox);
  };

  const bindMarquee = (signal: AbortSignal) => {
    compositorRoot.addEventListener(
      'pointerdown',
      (e) => {
        if (!e.shiftKey) return;
        if ((e.target as HTMLElement).closest('.tv-layer-wrap')) return;
        e.preventDefault();
        const rootRect = compositorRoot.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const marquee = document.createElement('div');
        marquee.className = 'tv-layer-marquee';
        marquee.style.cssText =
          'position:absolute;border:1px dashed #58a6ff;background:#58a6ff22;pointer-events:none;z-index:9999;';
        compositorRoot.appendChild(marquee);
        setCapture(compositorRoot, e.pointerId);

        const updateMarquee = (cx: number, cy: number) => {
          const x1 = Math.min(startX, cx) - rootRect.left;
          const y1 = Math.min(startY, cy) - rootRect.top;
          const x2 = Math.max(startX, cx) - rootRect.left;
          const y2 = Math.max(startY, cy) - rootRect.top;
          marquee.style.left = `${x1}px`;
          marquee.style.top = `${y1}px`;
          marquee.style.width = `${x2 - x1}px`;
          marquee.style.height = `${y2 - y1}px`;
        };

        const onMove = (ev: PointerEvent) => updateMarquee(ev.clientX, ev.clientY);

        const onUp = (ev: PointerEvent) => {
          releaseCapture();
          compositorRoot.removeEventListener('pointermove', onMove);
          compositorRoot.removeEventListener('pointerup', onUp);
          compositorRoot.removeEventListener('pointercancel', onUp);
          const w = compositorRoot.clientWidth || 1;
          const h = compositorRoot.clientHeight || 1;
          const sel: LayerFrame = clampFrame({
            x: (Math.min(startX, ev.clientX) - rootRect.left) / w,
            y: (Math.min(startY, ev.clientY) - rootRect.top) / h,
            w: Math.abs(ev.clientX - startX) / w,
            h: Math.abs(ev.clientY - startY) / h,
          });
          marquee.remove();
          if (sel.w < EPS && sel.h < EPS) return;
          const hits = controller
            .getLayersForActivePage()
            .filter((l) => frameIntersects(l.frame, sel))
            .map((l) => l.id);
          if (hits.length > 0) onMarqueeSelect?.(hits);
        };

        updateMarquee(startX, startY);
        compositorRoot.addEventListener('pointermove', onMove, { signal });
        compositorRoot.addEventListener('pointerup', onUp, { signal });
        compositorRoot.addEventListener('pointercancel', onUp, { signal });
      },
      { signal },
    );
  };

  const bindWrap = (wrap: HTMLElement, signal: AbortSignal) => {
    const layerId = wrap.dataset.layerId;
    if (!layerId) return;
    const layer = controller.getLayer(layerId);
    if (!layer || layer.locked) return;

    const transformIds = () => controller.getTransformLayerIds(layerId);

    const onPointerDownMove = (e: PointerEvent) => {
      if ((e.target as HTMLElement).classList.contains('tv-layer-handle')) return;
      e.preventDefault();
      e.stopPropagation();
      const ids = transformIds();
      const members = ids.map((id) => controller.getLayer(id)!).filter(Boolean);
      const startFrames = members.map((m) => ({ ...m.frame }));
      const startX = e.clientX;
      const startY = e.clientY;
      setCapture(wrap, e.pointerId);
      wrap.classList.add('tv-layer-dragging');

      const onMove = (ev: PointerEvent) => {
        const { dx, dy } = normDelta(ev.clientX - startX, ev.clientY - startY);
        const moved = startFrames.map((f) =>
          clampFrame({ ...f, x: f.x + dx, y: f.y + dy }),
        );
        compositorRoot.querySelectorAll('.tv-layer-wrap').forEach((el) => {
          const w = el as HTMLElement;
          const lid = w.dataset.layerId;
          if (!lid || !ids.includes(lid)) return;
          const idx = ids.indexOf(lid);
          if (idx >= 0) applyWrapStyle(w, moved[idx]!);
        });
      };

      const onUp = (ev: PointerEvent) => {
        releaseCapture();
        wrap.classList.remove('tv-layer-dragging');
        wrap.removeEventListener('pointermove', onMove);
        wrap.removeEventListener('pointerup', onUp);
        wrap.removeEventListener('pointercancel', onUp);
        const { dx, dy } = normDelta(ev.clientX - startX, ev.clientY - startY);
        if (Math.abs(dx) > EPS || Math.abs(dy) > EPS) {
          controller.moveLayers(ids, dx, dy);
          commitChange();
        }
      };

      wrap.addEventListener('pointermove', onMove, { signal });
      wrap.addEventListener('pointerup', onUp, { signal });
      wrap.addEventListener('pointercancel', onUp, { signal });
    };

    wrap.addEventListener('pointerdown', onPointerDownMove, { signal });

    wrap.querySelectorAll('.tv-layer-handle').forEach((handleEl) => {
      const handle = handleEl as HTMLElement;
      const corner = handle.dataset.handle as ResizeHandle;
      handle.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          const ids = transformIds();
          const members = ids.map((id) => controller.getLayer(id)!).filter(Boolean);
          let startBbox: LayerFrame | null;
          if (members.length === 1) {
            startBbox = { ...members[0]!.frame };
          } else {
            startBbox = getLayersBoundingBox(members);
          }
          if (!startBbox) return;
          const startX = e.clientX;
          const startY = e.clientY;
          setCapture(handle, e.pointerId);

          const onMove = (ev: PointerEvent) => {
            const { dx, dy } = normDelta(ev.clientX - startX, ev.clientY - startY);
            const newBbox = computeResizeBbox(startBbox!, corner, dx, dy);

            if (ids.length === 1) {
              applyWrapStyle(wrap, newBbox);
            } else {
              const resized = resizeGroupFrames(members, startBbox!, newBbox);
              compositorRoot.querySelectorAll('.tv-layer-wrap').forEach((el) => {
                const w = el as HTMLElement;
                const lid = w.dataset.layerId;
                if (!lid || !ids.includes(lid)) return;
                const idx = ids.indexOf(lid);
                if (idx >= 0) applyWrapStyle(w, resized[idx]!);
              });
            }
          };

          const onUp = (ev: PointerEvent) => {
            releaseCapture();
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
            handle.removeEventListener('pointercancel', onUp);
            const { dx, dy } = normDelta(ev.clientX - startX, ev.clientY - startY);
            const newBbox = computeResizeBbox(startBbox, corner, dx, dy);
            if (!framesEqual(newBbox, startBbox) && (Math.abs(dx) > EPS || Math.abs(dy) > EPS)) {
              controller.resizeLayersFromBbox(ids, newBbox);
              commitChange();
            }
          };

          handle.addEventListener('pointermove', onMove, { signal });
          handle.addEventListener('pointerup', onUp, { signal });
          handle.addEventListener('pointercancel', onUp, { signal });
        },
        { signal },
      );
    });
  };

  const cleanupEditChrome = () => {
    compositorRoot.classList.remove('tv-layer-edit-mode');
    compositorRoot.querySelectorAll('.tv-layer-marquee').forEach((el) => el.remove());
    compositorRoot.querySelectorAll('.tv-layer-wrap').forEach((w) => {
      const el = w as HTMLElement;
      el.classList.remove('tv-layer-editable', 'tv-layer-dragging');
      el.style.outline = '';
      el.style.cursor = '';
      el.querySelectorAll('.tv-layer-handle').forEach((h) => h.remove());
      clearWrapContentPassthrough(el);
    });
    compositorRoot.style.zIndex = '';
  };

  const rebind = () => {
    releaseCapture();
    abort?.abort();
    if (!enabled) {
      cleanupEditChrome();
      return;
    }
    compositorRoot.classList.add('tv-layer-edit-mode');
    compositorRoot.style.zIndex = '80';
    abort = new AbortController();
    const { signal } = abort;
    bindMarquee(signal);
    compositorRoot.querySelectorAll('.tv-layer-wrap').forEach((w) => {
      const wrap = w as HTMLElement;
      const layerId = wrap.dataset.layerId;
      if (!layerId) return;
      decorateWrap(wrap, layerId);
      bindWrap(wrap, signal);
    });
  };

  return {
    setEnabled(next: boolean) {
      enabled = next;
      rebind();
    },
    isEnabled: () => enabled,
    rebind,
    destroy: () => {
      enabled = false;
      releaseCapture();
      abort?.abort();
      cleanupEditChrome();
    },
  };
}