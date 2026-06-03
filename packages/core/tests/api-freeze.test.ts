import { describe, expect, it } from 'vitest';
import {
  TRADVIEW_API_VERSION,
  TRADVIEW_VERSION,
  createChart,
} from '../src/index.js';

describe('RC API freeze (apiVersion 1)', () => {
  it('exports stable version constants', () => {
    expect(TRADVIEW_API_VERSION).toBe(1);
    expect(TRADVIEW_VERSION).toMatch(/^\d+\.\d+\.\d+-rc\.\d+$/);
  });

  it('createChart factory exists', () => {
    expect(typeof createChart).toBe('function');
  });
});