import { describe, expect, it } from 'vitest';
import {
  clearedIndicatorConfig,
  DEFAULT_INDICATOR_CONFIG,
  hasAnyActiveIndicators,
  hasVisibleIndicatorPanes,
} from '../src/config.js';

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
    expect(hasVisibleIndicatorPanes(c)).toBe(false);
    expect(hasAnyActiveIndicators(c)).toBe(false);
  });

  it('hasVisibleIndicatorPanes respects individual flags', () => {
    expect(hasVisibleIndicatorPanes({ ...DEFAULT_INDICATOR_CONFIG, showRsi: false, showKdj: false, showMacd: true })).toBe(true);
    expect(hasVisibleIndicatorPanes(clearedIndicatorConfig())).toBe(false);
  });
});