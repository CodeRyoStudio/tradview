import { describe, expect, it } from 'vitest';
import { createCompositorShell } from '../src/layer/compositor-shell.js';

describe('createCompositorShell (P5)', () => {
  it('creates hidden anchor grid with widget cells', () => {
    const topBar = document.createElement('header');
    const chartHost = document.createElement('div');
    const shell = createCompositorShell({
      widgets: { topBar, chartHost },
    });

    expect(shell.root.classList.contains('tv-layout-root--compositor')).toBe(true);
    expect(shell.grid.classList.contains('tv-compositor-shell-grid')).toBe(true);
    expect(shell.grid.style.visibility).toBe('hidden');
    expect(shell.grid.style.pointerEvents).toBe('none');

    const topCell = shell.cells.get('topBar')!;
    expect(topCell.dataset.widgetId).toBe('topBar');
    expect(topCell.contains(topBar)).toBe(true);

    const chartCell = shell.cells.get('chartHost')!;
    expect(chartCell.contains(chartHost)).toBe(true);
    expect(chartHost.style.position).toBe('relative');
  });
});