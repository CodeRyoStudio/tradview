import type { Bar } from '@coderyo/data';

export interface VolumeBarDataIssue {
  missingCount: number;
  total: number;
}

/** Bars missing finite `v` while volume pane is enabled. */
export function findVolumeBarDataIssue(bars: readonly Bar[]): VolumeBarDataIssue | null {
  if (bars.length === 0) return null;
  let missingCount = 0;
  for (const bar of bars) {
    if (bar.v == null || !Number.isFinite(bar.v)) missingCount += 1;
  }
  if (missingCount === 0) return null;
  return { missingCount, total: bars.length };
}

export function volumeDataWarningMessage(issue: VolumeBarDataIssue): string {
  return (
    `Volume pane is enabled but ${issue.missingCount}/${issue.total} bars lack a finite ` +
    `"v" field. Disable volume (showVolume: false or disableIndicatorLayer("volume")) ` +
    `or supply volume data.`
  );
}