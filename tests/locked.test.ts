import { describe, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { solarDay } from '../src/engine/ephemeris';
import { flareAt, flaresOf } from '../src/engine/flares';
import { starAltitude } from '../src/engine/sky';
import { generateSystem } from '../src/engine/system';

describe('chapter 6: a tidally locked planet around a red dwarf', () => {
  const sys = generateSystem(3, 'navigator', 6);
  it('the star never moves in the sky', () => {
    for (const d of [0, 7, 19, 33]) expect(starAltitude(sys, d * DAY, sys.site) / DEG).toBeCloseTo(-20, 0);
    expect(solarDay(sys)).toBe(Infinity);
  });
  it('flares come at the advertised average rate', () => {
    const f = flaresOf(sys);
    const mean = (f[f.length - 1].start - f[0].start) / (f.length - 1) / DAY;
    expect(mean).toBeGreaterThan(1.8);
    expect(mean).toBeLessThan(3.4);
    expect(flareAt(sys, f[3].start + 1)).toBe(f[3]);
  });
});
