/**
 * Legacy v1 12×12 grid → compositor v2 migration helpers.
 *
 * Import from `@coderyo/ui-shell/migrate` (not the main entry).
 *
 * @see docs/MIGRATION-2.0.md §5
 */

export { layoutSchemaToPreset } from './layer/grid-to-preset.js';

export {
  cloneLayoutSchema,
  DEFAULT_LAYOUT_SCHEMA,
  getWidgetPlacement,
  layoutStorageKey,
  loadLayoutSchema,
  LAYOUT_SCHEMA_VERSION,
  normalizeLayoutSchema,
  resolveLayoutSchema,
  saveLayoutSchema,
  type LayoutSchema as MigrateLayoutSchema,
  type LayoutWidgetId as MigrateLayoutWidgetId,
  type LayoutWidgetPlacement as MigrateLayoutWidgetPlacement,
} from './layout-schema.js';