import { describe, expect, it } from 'vitest';
import { createWorkspaceChartSlots } from '../src/layer/workspace-chart-slots.js';

describe('createWorkspaceChartSlots (V2-L1)', () => {
  it('creates slots with stable container ids', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const slots = createWorkspaceChartSlots(parent, {
      slotIds: ['left', 'right'],
      idPrefix: 'slot-',
    });
    expect(slots).toHaveLength(2);
    expect(slots[0]?.containerId).toBe('slot-left');
    expect(document.getElementById('slot-left')).toBe(slots[0]?.element);
    expect(slots[1]?.chartId).toBe('right');
    parent.remove();
  });
});