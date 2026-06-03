export interface LogoSlotOptions {
  label?: string;
  href?: string;
  imageSrc?: string;
}

export function mountLogoSlot(parent: HTMLElement, opts: LogoSlotOptions = {}): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'tv-logo-slot';
  slot.style.cssText =
    'display:flex;align-items:center;gap:8px;margin-right:12px;flex-shrink:0;font-weight:600;font-size:13px;color:var(--tv-fg,#e6edf3);';

  const label = opts.label ?? 'TradView';
  const text = document.createElement('span');
  text.textContent = label;

  const children: HTMLElement[] = [];
  if (opts.imageSrc) {
    const img = document.createElement('img');
    img.src = opts.imageSrc;
    img.alt = label;
    img.style.cssText = 'height:22px;width:auto;display:block;';
    children.push(img);
  }
  children.push(text);

  if (opts.href) {
    const link = document.createElement('a');
    link.href = opts.href;
    link.style.cssText = 'color:inherit;text-decoration:none;display:flex;align-items:center;gap:8px;';
    link.append(...children);
    slot.appendChild(link);
  } else {
    slot.append(...children);
  }

  parent.appendChild(slot);
  return slot;
}