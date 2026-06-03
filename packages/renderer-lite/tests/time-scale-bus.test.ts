import { describe, expect, it } from 'vitest';
import { TimeScaleBus } from '../src/time-scale-bus.js';

describe('TimeScaleBus viewport helpers', () => {
  it('returns null visible range when unset', () => {
    const bus = new TimeScaleBus();
    expect(bus.getVisibleRange()).toBeNull();
  });

  it('getBarSpacing defaults when no chart registered', () => {
    const bus = new TimeScaleBus();
    expect(bus.getBarSpacing()).toBe(6);
  });

  it('setVisibleTimeRange updates tracked ms range', () => {
    const bus = new TimeScaleBus();
    bus.setVisibleTimeRange({ fromMs: 1_000, toMs: 2_000 });
    expect(bus.getVisibleRange()).toEqual({ fromMs: 1_000, toMs: 2_000 });
  });
});