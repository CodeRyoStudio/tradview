import { describe, expect, it } from 'vitest';
import {
  findVolumeBarDataIssue,
  volumeDataWarningMessage,
} from '../src/validate-volume-bars.js';

describe('validate-volume-bars', () => {
  it('returns null when every bar has finite v', () => {
    expect(
      findVolumeBarDataIssue([{ t: 1, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 }]),
    ).toBeNull();
  });

  it('counts bars missing v', () => {
    const issue = findVolumeBarDataIssue([
      { t: 1, o: 1, h: 2, l: 0.5, c: 1.5, v: 10 },
      { t: 2, o: 1, h: 2, l: 0.5, c: 1.5 },
    ]);
    expect(issue).toEqual({ missingCount: 1, total: 2 });
    expect(volumeDataWarningMessage(issue!)).toMatch(/Disable volume/);
  });
});