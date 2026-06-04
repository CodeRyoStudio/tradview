import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountChartLayout } from './chart-layout.js';
import { resetLegacyLayoutWarningsForTests } from './layout-deprecation.js';

describe('TopBar interval layout (issue #4)', () => {
  beforeEach(() => {
    resetLegacyLayoutWarningsForTests();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    resetLegacyLayoutWarningsForTests();
    vi.restoreAllMocks();
  });

  it('keeps first interval label intact inside a dedicated header above the body', () => {
    const root = document.createElement('div');
    root.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;width:1280px;height:720px;';
    document.body.appendChild(root);

    mountChartLayout(root, {
      showTopBar: true,
      showLeftToolbar: true,
      symbolInput: 'none',
      intervals: ['1s', '5s', '15s', '1m', '5m', '15m', '1h'],
      activeInterval: '1s',
    });

    const header = root.querySelector('.tv-layout-header');
    const bar = root.querySelector('.tv-topbar');
    const intervals = root.querySelector('.tv-topbar-intervals');
    const firstBtn = intervals?.querySelector('button');

    expect(header).not.toBeNull();
    expect(bar?.parentElement).toBe(header);
    expect(root.querySelector('.tv-layout-grid')).not.toBeNull();
    expect(firstBtn?.textContent).toBe('1s');

    const headerZ = header instanceof HTMLElement ? header.style.zIndex : '';
    expect(headerZ).toBe('30');

    root.remove();
  });
});