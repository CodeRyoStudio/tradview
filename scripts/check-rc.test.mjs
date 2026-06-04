import { describe, expect, it } from 'vitest';
import {
  CHECK_RC_STEP_LWC,
  CHECK_RC_STEP_WEBGL,
  CHECK_RC_STEPS_BASE,
  getCheckRcSteps,
  shouldSkipLwcSizeGate,
} from './rc-version-gates.mjs';

describe('shouldSkipLwcSizeGate (V2-00)', () => {
  it('skips LWC size gate for 2.0.0 GA and 2.0.0-rc.N', () => {
    expect(shouldSkipLwcSizeGate('2.0.0')).toBe(true);
    expect(shouldSkipLwcSizeGate('2.0.0-rc.1')).toBe(true);
    expect(shouldSkipLwcSizeGate('2.0.0-rc.4')).toBe(true);
  });

  it('trims whitespace before matching', () => {
    expect(shouldSkipLwcSizeGate('2.0.0-rc.1\n')).toBe(true);
    expect(shouldSkipLwcSizeGate('  2.0.0  ')).toBe(true);
    expect(shouldSkipLwcSizeGate('\t1.1.1\n')).toBe(false);
  });

  it('keeps LWC size gate for 1.x and non-2.0.0 lines', () => {
    expect(shouldSkipLwcSizeGate('1.1.1')).toBe(false);
    expect(shouldSkipLwcSizeGate('1.0.0-rc.1')).toBe(false);
    expect(shouldSkipLwcSizeGate('2.0.1')).toBe(false);
    expect(shouldSkipLwcSizeGate('2.1.0-rc.1')).toBe(false);
    expect(shouldSkipLwcSizeGate('2.0.0-beta.1')).toBe(false);
    expect(shouldSkipLwcSizeGate('')).toBe(false);
    expect(shouldSkipLwcSizeGate('v2.0.0')).toBe(false);
  });
});

describe('getCheckRcSteps', () => {
  it('always includes check:webgl-size (V2-R2)', () => {
    expect(CHECK_RC_STEPS_BASE).toContain(CHECK_RC_STEP_WEBGL);
    expect(getCheckRcSteps('1.1.1')).toContain(CHECK_RC_STEP_WEBGL);
    expect(getCheckRcSteps('2.0.0-rc.1')).toContain(CHECK_RC_STEP_WEBGL);
  });

  it('omits check:lwc-size for 2.0.0-rc.1', () => {
    const steps = getCheckRcSteps('2.0.0-rc.1');
    expect(steps).toEqual(CHECK_RC_STEPS_BASE);
    expect(steps).not.toContain(CHECK_RC_STEP_LWC);
  });

  it('includes check:lwc-size for 1.1.1 baseline', () => {
    const steps = getCheckRcSteps('1.1.1');
    expect(steps[steps.length - 1]).toBe(CHECK_RC_STEP_LWC);
    expect(steps).toContain('test:scripts');
  });

  it('includes check:lwc-size for 2.0.0 GA skip line only when version matches', () => {
    expect(getCheckRcSteps('2.0.0')).not.toContain(CHECK_RC_STEP_LWC);
    expect(getCheckRcSteps('2.0.1')).toContain(CHECK_RC_STEP_LWC);
  });
});