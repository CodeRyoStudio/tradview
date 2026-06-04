/**
 * RC gate helpers (V2-00). Imported by check-rc.mjs and unit tests.
 * @see docs/DESIGN-v2.md §10
 */

export const CHECK_RC_STEP_LWC = 'check:lwc-size';
export const CHECK_RC_STEP_WEBGL = 'check:webgl-size';

/** Ordered pnpm script names executed by check-rc.mjs (excludes version file read). */
export const CHECK_RC_STEPS_BASE = [
  'version:sync',
  'build',
  'test',
  'test:scripts',
  'typecheck',
  'lint',
  'check:webgl-size',
  'build:cdn',
  'check:cdn-size',
];

/** @param {string} version Root VERSION file contents (may include trailing newline) */
export function shouldSkipLwcSizeGate(version) {
  const v = version.trim();
  return /^2\.0\.0(-rc\.\d+)?$/.test(v);
}

/** @param {string} version Root VERSION file contents */
export function getCheckRcSteps(version) {
  const steps = [...CHECK_RC_STEPS_BASE];
  if (!shouldSkipLwcSizeGate(version)) {
    steps.push(CHECK_RC_STEP_LWC);
  }
  return steps;
}