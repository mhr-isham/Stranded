import { describe, expect, it } from 'vitest';
import { predictionGuidance } from '../src/game/modes';

describe('expedition prediction guidance', () => {
  it.each([
    ['stargazer', true, true],
    ['cadet', true, true],
    ['navigator', false, true],
    ['astronomer', false, false],
    ['legend', false, false],
  ] as const)('applies the %s contract', (difficulty, walkthrough, logEstimate) => {
    expect(predictionGuidance({ difficulty })).toEqual({ walkthrough, logEstimate });
  });

  it('honors disabled Cadet guidance and the Free Roam toggle', () => {
    expect(predictionGuidance({ difficulty: 'cadet', cadetGuidance: false })).toEqual({ walkthrough: false, logEstimate: false });
    expect(predictionGuidance({ difficulty: 'navigator', freeRoam: true })).toEqual({ walkthrough: false, logEstimate: false });
    expect(predictionGuidance({ difficulty: 'navigator', freeRoam: true, freeRoamGuidance: true })).toEqual({ walkthrough: false, logEstimate: true });
    expect(predictionGuidance({ difficulty: 'legend', freeRoam: true, freeRoamGuidance: true })).toEqual({ walkthrough: false, logEstimate: false });
  });

  it('disables automatic estimates during the manual-fit challenge', () => {
    expect(predictionGuidance({ difficulty: 'navigator', challenges: ['handFit'] })).toEqual({ walkthrough: false, logEstimate: false });
  });
});
