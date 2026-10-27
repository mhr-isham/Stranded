import { describe, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { starAltitude } from '../src/engine/sky';
import { generateSystem } from '../src/engine/system';

describe('Eratosthenes (chapter 3)', () => {
  it('noon sun angle difference between two sites on one meridian gives the radius', () => {
    const sys = generateSystem(11, 'navigator', 3);
    const R = sys.home.radius;
    const D = 800e3;
    const north = { lat: sys.site.lat + D / R, lon: sys.site.lon };
    // Find local noon on day 3 at camp (highest sun).
    let best = -Infinity;
    let tNoon = 0;
    for (let t = 2 * DAY; t < 3.6 * DAY; t += 120) {
      const a = starAltitude(sys, t, sys.site);
      if (a > best) [best, tNoon] = [a, t];
    }
    const camp = starAltitude(sys, tNoon, sys.site);
    let nb = -Infinity;
    for (let t = tNoon - 3600; t < tNoon + 3600; t += 30) nb = Math.max(nb, starAltitude(sys, t, north));
    const dAlt = Math.abs(camp - nb);
    expect(camp).toBeGreaterThan(5 * DEG);
    expect(Math.abs(D / dAlt / R - 1)).toBeLessThan(0.02);
  });
});
