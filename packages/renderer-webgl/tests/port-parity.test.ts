import { describe, it } from 'vitest';

/**
 * GA gate (DESIGN-v2 Appendix A): full lite vs WebGL fixture parity @ V2-R13 (W15 / rc.4).
 * Skeleton + todos @ rc.3 per DESIGN §13 (R12 landed; R13 before rc.4).
 */
describe('renderer-webgl port parity (V2-R13 skeleton)', () => {
  it.todo('TimeScaleBusRegistry per chart — independent buses');
  it.todo('prepend compensatePrependOnRegistry on WebGL path');
  it.todo('lodDecimateBars matches lite fixture tolerance');
  it.todo('indicator panes MACD/RSI/KDJ visible range sync');
  it.todo('smoothPriceUpdate BarSmoothAnimator');
  it.todo('gaps.whitespace feature');
  it.todo('chart.crosshair payload parity with lite');
  it.todo('pine-lite plot overlay on WebGL orchestrator');
});