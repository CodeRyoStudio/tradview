import { describe, expect, it } from 'vitest';
import { clearedIndicatorConfig, DEFAULT_INDICATOR_CONFIG } from '../src/config.js';

describe('clearedIndicatorConfig', () => {
  it('disables all panes and overlays', () => {
    const c = clearedIndicatorConfig();
    expect(c.showMacd).toBe(false);
    expect(c.showRsi).toBe(false);
    expect(c.showKdj).toBe(false);
    expect(c.showEma).toBe(false);
    expect(c.showBoll).toBe(false);
    expect(c.showMa).toBe(false);
    expect(c.showVolMa).toBe(false);
    expect(c.macdFast).toBe(DEFAULT_INDICATOR_CONFIG.macdFast);
  });
});