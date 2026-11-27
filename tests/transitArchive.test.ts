import { describe, expect, it } from 'vitest';
import {
  archiveFollowUp, archiveMarkIssue, archivePoints, archivePrediction, archiveReading, SURVEY_END, surveyPoints,
} from '../src/game/transitArchive';

describe('Kepler Transit Archive', () => {
  it('keeps the survey separate from the follow-up and leaves missing observations blank', () => {
    expect(surveyPoints.every(p => p.day <= SURVEY_END)).toBe(true);
    const gaps = archivePoints.slice(1).map((p, i) => ({ before: archivePoints[i], after: p }));
    const gap = gaps.find(({ before, after }) => after.day - before.day > .018);
    expect(gap).toBeDefined();
    expect(archiveReading(archivePoints, (gap!.before.day + gap!.after.day) / 2)).toBeNull();
  });

  it('rejects a bright baseline and duplicate marks and measures from the actual dips', () => {
    expect(archiveMarkIssue([], 1.5)).toContain('misses');
    expect(archiveMarkIssue([.83], .86)).toContain('next dip');
    expect(archivePrediction([.83, 1.5])).toBeNull();
    const result = archivePrediction([.83, 3.03])!;
    expect(result.period).toBeCloseTo(2.2, 2);
    expect(result.depth).toBeCloseTo(.67, 1);
    expect(result.day).toBeCloseTo(5.23, 2);
    const follow = archiveFollowUp(result.day);
    expect(follow.detected).toBe(true);
    expect(follow.points.every(p => p.day > SURVEY_END && Math.abs(p.day - result.day) <= .25)).toBe(true);
  });

  it('lets a slightly mistimed pair produce a miss and supports a refined prediction', () => {
    const early = archivePrediction([.89, 2.97])!;
    const refined = archivePrediction([.89, 3.03])!;
    expect(archiveFollowUp(early.day).detected).toBe(false);
    expect(archiveFollowUp(refined.day).detected).toBe(true);
  });
});
