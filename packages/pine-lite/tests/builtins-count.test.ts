import { describe, expect, it } from 'vitest';
import { INDICATOR_BUILTINS } from '../src/builtins.js';

describe('Pine-lite builtins (V2-PINE2)', () => {
  it('has at least 18 indicator builtins', () => {
    expect(INDICATOR_BUILTINS.size).toBeGreaterThanOrEqual(18);
  });
});