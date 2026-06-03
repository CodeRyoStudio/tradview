export function attachPaneResizer(
  topPane: HTMLElement,
  bottomPane: HTMLElement,
  opts: { minTopPx?: number; minBottomPx?: number; storageKey?: string } = {},
): () => void {
  const minTop = opts.minTopPx ?? 120;
  const minBottom = opts.minBottomPx ?? 60;
  const parent = topPane.parentElement;
  if (!parent) return () => {};

  const handle = document.createElement('div');
  handle.style.cssText =
    'height:4px;cursor:row-resize;background:#30363d;flex-shrink:0;touch-action:none;';
  bottomPane.insertAdjacentElement('beforebegin', handle);

  const saved = opts.storageKey ? localStorage.getItem(opts.storageKey) : null;
  if (saved) {
    const ratio = Number(saved);
    if (Number.isFinite(ratio) && ratio > 0 && ratio < 1) {
      topPane.style.flex = `${ratio * 10}`;
      bottomPane.style.flex = `${(1 - ratio) * 10}`;
    }
  }

  let dragging = false;

  const onMove = (clientY: number) => {
    const rect = parent.getBoundingClientRect();
    const y = clientY - rect.top;
    const ratio = Math.min(0.85, Math.max(0.15, y / rect.height));
    const topPx = ratio * rect.height;
    const bottomPx = rect.height - topPx - handle.offsetHeight;
    if (topPx < minTop || bottomPx < minBottom) return;
    topPane.style.flex = `${ratio * 10}`;
    bottomPane.style.flex = `${(1 - ratio) * 10}`;
    if (opts.storageKey) localStorage.setItem(opts.storageKey, String(ratio));
  };

  const stop = () => {
    dragging = false;
    document.body.style.cursor = '';
  };

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'row-resize';
  });
  handle.addEventListener('pointermove', (e) => {
    if (dragging) onMove(e.clientY);
  });
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  return () => handle.remove();
}