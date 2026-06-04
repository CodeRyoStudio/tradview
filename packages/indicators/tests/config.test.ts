import { describe, expect, it } from 'vitest';
import {
  clearedIndicatorConfig,
  DEFAULT_INDICATOR_CONFIG,
  disableIndicatorLayer,
  hasAnyActiveIndicators,
  hasVisibleIndicatorPanes,
  listActiveIndicatorLayers,
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
    expect(c.showVolume).toBe(false);
    expect(c.macdFast).toBe(DEFAULT_INDICATOR_CONFIG.macdFast);
    expect(hasVisibleIndicatorPanes(c)).toBe(false);
    expect(hasAnyActiveIndicators(c)).toBe(false);
  });

  it('hasVisibleIndicatorPanes respects individual flags', () => {
    expect(hasVisibleIndicatorPanes({ ...DEFAULT_INDICATOR_CONFIG, showRsi: false, showKdj: false, showMacd: true })).toBe(true);
    expect(hasVisibleIndicatorPanes(clearedIndicatorConfig())).toBe(false);
  });
});

describe('indicator layers', () => {
  it('lists active main and pane layers', () => {
    const layers = listActiveIndicatorLayers(DEFAULT_INDICATOR_CONFIG);
    expect(layers.some((l) => l.id === 'ma' && l.target === 'main')).toBe(true);
    expect(layers.some((l) => l.id === 'macd' && l.target === 'pane')).toBe(true);
    expect(layers.some((l) => l.id === 'volume' && l.target === 'pane')).toBe(true);
  });

  it('disableIndicatorLayer removes one layer only', () => {
    const next = disableIndicatorLayer(DEFAULT_INDICATOR_CONFIG, 'rsi');
    expect(next.showRsi).toBe(false);
    expect(next.showMacd).toBe(true);
    expect(next.showMa).toBe(true);
  });
});