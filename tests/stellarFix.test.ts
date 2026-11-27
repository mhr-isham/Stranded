import { describe, expect, it } from 'vitest';
import { ARCSEC, DAY } from '../src/engine/constants';
import { LIGHT_YEAR } from '../src/engine/nearstars';
import { matchingPlaces, stellarEpochs } from '../src/game/stellarFix';

describe('stellar location evidence', () => {
  const at = 6 * DAY;
  it('treats scans from one day as one epoch and retains the clearest scan', () => {
    expect(stellarEpochs([
      { i: 0, at, v: 1, environment: { instrument: 'telescope', at, rawValue: 1, seeing: { factor: 2, frozen: false } } },
      { i: 0, at: at + 1, v: 2 },
      { i: 0, at: DAY, v: 3 },
      { i: 1, at, v: 4 },
      { i: 0, at: DAY * 3, v: NaN },
    ], 0).map(o => [o.t, o.v])).toEqual([[DAY, 3], [at + 1, 2]]);
  });

  it('requires one common orbit radius for the three stars', () => {
    const p = Math.atan(2e11 / (10 * LIGHT_YEAR));
    const ranges: [number, number][] = [[p * .95, p * 1.05], [p * .95, p * 1.05], [p * .95, p * 1.05]];
    const places = [{ label: 'shared', ly: [10, 10.2, 9.9] }, { label: 'inconsistent', ly: [8, 10, 12] }];
    expect(matchingPlaces(places, [1.5e11, 2.5e11], ranges).map(p => p.label)).toEqual(['shared']);
    const broad: [number, number][] = Array.from({ length: 3 }, () => [.1 * ARCSEC, 1 * ARCSEC]);
    expect(matchingPlaces(places, [1.5e11, 2.5e11], broad)).toHaveLength(2);
  });
});
