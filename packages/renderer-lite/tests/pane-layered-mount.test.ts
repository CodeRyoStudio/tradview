import { describe, expect, it } from 'vitest';
import {
  isLayeredPaneMount,
  shouldResizeChartPane,
} from '../src/pane-orchestrator.js';

describe('PaneOrchestrator layered mounts', () => {
  it('detects layered mode when volumeMount is provided', () => {
    expect(isLayeredPaneMount({ volumeMount: undefined })).toBe(false);
    expect(isLayeredPaneMount({ volumeMount: {} as HTMLElement })).toBe(true);
  });

  it('shouldResizeChartPane respects focus set', () => {
    const focus = new Set<'main' | 'volume'>(['main']);
    expect(shouldResizeChartPane(focus, 'main')).toBe(true);
    expect(shouldResizeChartPane(focus, 'volume')).toBe(false);
    expect(shouldResizeChartPane(null, 'indicator')).toBe(true);
  });
});