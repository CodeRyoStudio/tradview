import { describe, expect, it, vi } from 'vitest';
import { mountChartLayout, type ChartLayoutOptions } from './chart-layout.js';

describe('mountChartLayout interval wiring', () => {
  it('calls onIntervalChange assigned after mount (same opts reference)', () => {
    const root = document.createElement('div');
    const onIntervalChange = vi.fn();
    const opts: ChartLayoutOptions = {
      showTopBar: true,
      intervals: ['1m', '1h'],
      activeInterval: '1m',
    };
    mountChartLayout(root, opts);
    opts.onIntervalChange = onIntervalChange;

    const intervalButtons = root.querySelectorAll('.tv-topbar button');
    expect(intervalButtons.length).toBeGreaterThanOrEqual(2);
    intervalButtons[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onIntervalChange).toHaveBeenCalledWith('1h');
  });
});