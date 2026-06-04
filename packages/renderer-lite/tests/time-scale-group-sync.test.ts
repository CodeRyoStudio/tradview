import { describe, expect, it } from 'vitest';
import {
  independentBusKey,
  normalizeSyncGroupId,
  resolveBusMapKey,
  TimeScaleBusRegistry,
} from '../src/time-scale-bus-registry.js';

describe('normalizeSyncGroupId', () => {
  it('treats empty as independent', () => {
    expect(normalizeSyncGroupId(undefined)).toBeNull();
    expect(normalizeSyncGroupId('')).toBeNull();
    expect(normalizeSyncGroupId('   ')).toBeNull();
  });

  it('trims non-empty ids', () => {
    expect(normalizeSyncGroupId('  group-a  ')).toBe('group-a');
  });
});

describe('TimeScaleBusRegistry', () => {
  it('uses per-pane keys when group id is empty', () => {
    expect(resolveBusMapKey(undefined, 'main')).toBe(independentBusKey('main'));
    expect(resolveBusMapKey(undefined, 'volume')).toBe(independentBusKey('volume'));
    expect(resolveBusMapKey(undefined, 'main')).not.toBe(
      resolveBusMapKey(undefined, 'volume'),
    );
  });

  it('shares one bus for the same non-empty group id', () => {
    const reg = new TimeScaleBusRegistry();
    reg.setPaneSyncGroup('main', 'A');
    reg.setPaneSyncGroup('volume', 'A');
    expect(reg.getBusKeyForPane('main')).toBe(reg.getBusKeyForPane('volume'));
    expect(reg.getBusForPane('main')).toBe(reg.getBusForPane('volume'));
  });

  it('keeps different group ids on separate buses', () => {
    const reg = new TimeScaleBusRegistry();
    reg.setPaneSyncGroup('main', 'A');
    reg.setPaneSyncGroup('indicator', 'B');
    expect(reg.getBusForPane('main')).not.toBe(reg.getBusForPane('indicator'));
  });

  it('tracks active bus by focused pane', () => {
    const reg = new TimeScaleBusRegistry();
    reg.setPaneSyncGroup('main', 'A');
    reg.setPaneSyncGroup('indicator', 'B');
    reg.setActivePane('indicator');
    expect(reg.activeBus).toBe(reg.getBusForPane('indicator'));
  });
});