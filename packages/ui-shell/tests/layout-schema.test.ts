import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT_SCHEMA,
  normalizeLayoutSchema,
  resolveLayoutSchema,
} from '../src/layout-schema.js';

describe('layout-schema', () => {
  it('resolveLayoutSchema returns default when omitted', () => {
    const s = resolveLayoutSchema();
    expect(s.version).toBe(1);
    expect(s.widgets.find((w) => w.id === 'chartHost')).toBeDefined();
    expect(s.widgets.length).toBe(DEFAULT_LAYOUT_SCHEMA.widgets.length);
  });

  it('normalizeLayoutSchema fills missing widgets from default', () => {
    const s = normalizeLayoutSchema({
      version: 1,
      columns: 12,
      rows: 12,
      widgets: [{ id: 'chartHost', col: 2, row: 2, colSpan: 6, rowSpan: 4 }],
    });
    expect(s.widgets.find((w) => w.id === 'topBar')).toBeDefined();
    const chart = s.widgets.find((w) => w.id === 'chartHost');
    expect(chart?.col).toBe(2);
    expect(chart?.colSpan).toBe(6);
  });
});