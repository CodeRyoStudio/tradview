/**
 * One-time per-session runtime warnings for v1 12×12 grid layout (PR-L7a).
 * @see docs/MIGRATION-2.0.md §5
 */

const warnedKeys = new Set<string>();

/** Stable keys for {@link warnLegacyLayoutOnce}. */
export const LEGACY_LAYOUT_WARN_KEYS = {
  createLayoutGrid: 'createLayoutGrid',
  mountChartLayoutLegacyGrid: 'mountChartLayout:legacyGrid',
} as const;

/** Stable URL for npm consumers (warn strings); repo JSDoc may still cite `docs/MIGRATION-2.0.md`. */
export const MIGRATION_LAYOUT_URL =
  'https://github.com/CodeRyoStudio/tradview/blob/main/docs/MIGRATION-2.0.md#5-layout--pr-l7-three-phase-timeline';

export const WARN_MSG_CREATE_LAYOUT_GRID =
  `[@coderyo/ui-shell] createLayoutGrid was removed from the public API in 2.0.0-rc.2 (v1 12×12 grid). ` +
  `Use mountChartLayout({ layerCompositorManaged: true }) + mountLayerCompositor. ` +
  `Migrate persisted grid JSON via @coderyo/ui-shell/migrate (layoutSchemaToPreset). See ${MIGRATION_LAYOUT_URL}.`;

/** @internal Retained for tests; mount path throws {@link ERR_MSG_MOUNT_REQUIRES_COMPOSITOR} @ rc.2+. */
export const WARN_MSG_MOUNT_LEGACY_GRID =
  `[@coderyo/ui-shell] mountChartLayout requires layerCompositorManaged: true (v1 grid removed in 2.0.0-rc.2). ` +
  `Use @coderyo/ui-shell/migrate for layoutSchemaToPreset. See ${MIGRATION_LAYOUT_URL}.`;

/** Thrown when `mountChartLayout` is called without compositor management (PR-L7b @ 2.0.0-rc.2). */
export const ERR_MSG_MOUNT_REQUIRES_COMPOSITOR =
  `[@coderyo/ui-shell] mountChartLayout requires layerCompositorManaged: true (v1 12×12 grid removed in 2.0.0-rc.2). ` +
  `Use mountLayerCompositor + LayoutPreset. Migrate persisted grid JSON via @coderyo/ui-shell/migrate (layoutSchemaToPreset). See ${MIGRATION_LAYOUT_URL}.`;

export type LegacyLayoutWarnKey =
  (typeof LEGACY_LAYOUT_WARN_KEYS)[keyof typeof LEGACY_LAYOUT_WARN_KEYS];

/**
 * Emit `console.warn` at most once per `key` for the lifetime of this module (browser session).
 */
export function warnLegacyLayoutOnce(key: LegacyLayoutWarnKey | string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

/** @internal Vitest-only — clears session warn flags between tests. */
export function resetLegacyLayoutWarningsForTests(): void {
  warnedKeys.clear();
}