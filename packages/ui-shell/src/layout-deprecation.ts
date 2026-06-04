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
  `[@coderyo/ui-shell] createLayoutGrid is deprecated (v1 12×12 grid) and will be removed in 2.0.0-rc.2. ` +
  `Use layer compositor: mountChartLayout({ layerCompositorManaged: true }) + mountLayerCompositor. See ${MIGRATION_LAYOUT_URL}.`;

export const WARN_MSG_MOUNT_LEGACY_GRID =
  `[@coderyo/ui-shell] mountChartLayout is using the legacy 12×12 grid path (layerCompositorManaged !== true). ` +
  `Set layerCompositorManaged: true and use the layer compositor preset API. Grid public exports are removed in 2.0.0-rc.2. See ${MIGRATION_LAYOUT_URL}.`;

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