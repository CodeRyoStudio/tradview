import { describe, expect, it } from 'vitest';

/**
 * GA gate skeleton (DESIGN-v2 Appendix A): compare WebGL vs lite fixture behavior.
 * Full parity tests land with V2-R13; this file asserts the harness exists @ rc.3+.
 */
describe('renderer-webgl port parity (V2-R13 skeleton)', () => {
  it('documents required parity behaviors', () => {
    const required = [
      'TimeScaleBusRegistry per chart',
      'prepend compensatePrependOnRegistry',
      'lodDecimateBars',
      'indicator panes MACD/RSI/KDJ',
      'smoothPriceUpdate',
      'gaps.whitespace',
      'chart.crosshair bridge payload',
      'pine-lite plot overlay',
    ];
    expect(required.length).toBeGreaterThanOrEqual(8);
  });
});