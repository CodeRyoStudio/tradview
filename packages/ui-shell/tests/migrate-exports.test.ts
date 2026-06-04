import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Migrate from '../src/migrate.js';

const MIGRATE_VALUE_EXPORTS = [
  'DEFAULT_LAYOUT_SCHEMA',
  'LAYOUT_SCHEMA_VERSION',
  'cloneLayoutSchema',
  'getWidgetPlacement',
  'layoutSchemaToPreset',
  'layoutStorageKey',
  'loadLayoutSchema',
  'normalizeLayoutSchema',
  'resolveLayoutSchema',
  'saveLayoutSchema',
] as const;

describe('@coderyo/ui-shell/migrate exports', () => {
  it('package.json exposes migrate subpath', () => {
    const pkg = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
        'utf8',
      ),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(pkg.exports).sort()).toEqual(['.', './migrate']);
  });

  it('migrate runtime exports match allowlist', () => {
    expect(Object.keys(Migrate).sort()).toEqual([...MIGRATE_VALUE_EXPORTS].sort());
  });

  it('layoutSchemaToPreset converts default schema to preset', () => {
    const preset = Migrate.layoutSchemaToPreset(Migrate.DEFAULT_LAYOUT_SCHEMA);
    expect(preset.version).toBe(2);
    expect(preset.layers.some((l) => l.widgetKey === 'chartMain')).toBe(true);
  });
});