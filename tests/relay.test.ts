import { describe, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { relayOrbit, relaySunlit, relayTopocentric } from '../src/engine/relay';
import { localFrame, toHorizontal, topocentric } from '../src/engine/sky';
import { world } from '../src/game/world';

describe('Halcyon relay', () => {
  const { system: sys } = world(316, 'cadet');
  it('orbits in hours', () => {
    const o = relayOrbit(sys);
    expect(o.period).toBeGreaterThan(2 * 3600);
    expect(o.period).toBeLessThan(12 * 3600);
  });
  it('is visible some evenings or mornings, never in daylight', () => {
    let visible = 0;
    let daylight = 0;
    for (let t = 0; t < 10 * DAY; t += 300) {
      const f = localFrame(sys, t, sys.site);
      const sun = toHorizontal(topocentric(sys, 'star', t, sys.site), f).alt;
      const alt = toHorizontal(relayTopocentric(sys, t, sys.site), f).alt;
      const v = sun < -6 * DEG && alt > 3 * DEG && relaySunlit(sys, t);
      if (v) visible++;
      if (v && sun > 0) daylight++;
    }
    expect(visible).toBeGreaterThan(5);
    expect(daylight).toBe(0);
  });
});
