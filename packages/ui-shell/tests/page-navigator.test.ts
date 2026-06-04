import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LayerController } from '../src/layer/layer-controller.js';
import { mountPageNavigator } from '../src/layer/page-navigator.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';

describe('PageNavigator (P4)', () => {
  it('adds and switches pages', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const page2 = ctrl.addPage('Mobile');
    expect(ctrl.getPreset().pages).toHaveLength(2);
    expect(ctrl.activePageId).toBe(page2);
    expect(ctrl.getLayersForActivePage().every((l) => l.pageId === page2)).toBe(true);
    ctrl.setActivePage('page-1');
    expect(ctrl.activePageId).toBe('page-1');
  });

  it('removes page and reassigns active to neighbor', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const page2 = ctrl.addPage('Temp');
    const page3 = ctrl.addPage('Third');
    ctrl.setActivePage(page3);
    expect(ctrl.removePage(page3)).toBe(true);
    expect(ctrl.activePageId).toBe(page2);
    expect(ctrl.getPreset().layers.every((l) => l.pageId !== page3)).toBe(true);
    expect(ctrl.removePage('page-1')).toBe(true);
    expect(ctrl.getPreset().pages).toHaveLength(1);
    expect(ctrl.removePage('page-1')).toBe(false);
  });

  it('renamePage updates title', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    expect(ctrl.renamePage('page-1', 'Charts')).toBe(true);
    expect(ctrl.getPreset().pages[0]!.title).toBe('Charts');
    expect(ctrl.renamePage('page-1', '   ')).toBe(false);
  });

  it('mountPageNavigator tab click fires onPageChange', () => {
    const parent = document.createElement('div');
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const page2 = ctrl.addPage('Page 2');
    ctrl.setActivePage('page-1');
    const onPageChange = vi.fn();
    const nav = mountPageNavigator(parent, ctrl, { alwaysVisible: true, onPageChange });
    const buttons = parent.querySelectorAll('.tv-page-navigator button');
    const page2Tab = [...buttons].find((b) => b.textContent === 'Page 2') as HTMLButtonElement;
    page2Tab.click();
    expect(ctrl.activePageId).toBe(page2);
    expect(onPageChange).toHaveBeenCalledWith(page2);
    nav.destroy();
  });

  it('delete active page fires onPageChange with new active id', () => {
    const parent = document.createElement('div');
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const page2 = ctrl.addPage('Page 2');
    ctrl.setActivePage(page2);
    const onPageChange = vi.fn();
    const nav = mountPageNavigator(parent, ctrl, { alwaysVisible: true, onPageChange });
    vi.stubGlobal('confirm', () => true);
    const delBtn = parent.querySelector(
      '.tv-page-navigator button[title*="刪除"]',
    ) as HTMLButtonElement;
    delBtn.click();
    expect(ctrl.activePageId).toBe('page-1');
    expect(onPageChange).toHaveBeenCalledWith('page-1');
    nav.destroy();
    vi.unstubAllGlobals();
  });

  it('disables delete when only one page remains', () => {
    const parent = document.createElement('div');
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    mountPageNavigator(parent, ctrl, { alwaysVisible: true });
    const delBtn = parent.querySelector(
      '.tv-page-navigator button[title*="刪除"]',
    ) as HTMLButtonElement;
    expect(delBtn.disabled).toBe(true);
  });

  describe('matchMedia visibility', () => {
    let listeners: Array<() => void> = [];
    const media = { matches: false, addEventListener: vi.fn((_e: string, fn: () => void) => {
      listeners.push(fn);
    }), removeEventListener: vi.fn() };

    beforeEach(() => {
      listeners = [];
      vi.stubGlobal('matchMedia', () => media);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('hides navigator on wide viewport unless alwaysVisible', () => {
      media.matches = false;
      const parent = document.createElement('div');
      const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
      mountPageNavigator(parent, ctrl, { alwaysVisible: false });
      const nav = parent.querySelector('.tv-page-navigator') as HTMLElement;
      expect(nav.style.display).toBe('none');
    });

    it('shows navigator when matchMedia matches narrow', () => {
      media.matches = true;
      const parent = document.createElement('div');
      const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
      mountPageNavigator(parent, ctrl, { alwaysVisible: false });
      const nav = parent.querySelector('.tv-page-navigator') as HTMLElement;
      expect(nav.style.display).toBe('flex');
    });

    it('alwaysVisible overrides matchMedia', () => {
      media.matches = false;
      const parent = document.createElement('div');
      const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
      mountPageNavigator(parent, ctrl, { alwaysVisible: true });
      const nav = parent.querySelector('.tv-page-navigator') as HTMLElement;
      expect(nav.style.display).toBe('flex');
    });
  });
});