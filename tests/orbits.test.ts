import { describe, expect, it } from 'vitest';
import { AU, DAY, G, M_SUN } from '../src/engine/constants';
import { planetPos } from '../src/engine/ephemeris';
import { simulateLaunch } from '../src/engine/launch';
import { hohmannTof, lambert, propagate } from '../src/engine/orbits';
import { generateSystem } from '../src/engine/system';
import { norm, sub, type Vec3 } from '../src/engine/vec';

const MU = G * M_SUN;

describe('orbits', () => {
  it('propagates a circular orbit for a full period', () => {
    const r: Vec3 = [AU, 0, 0];
    const v: Vec3 = [0, Math.sqrt(MU / AU), 0];
    const P = 2 * Math.PI * Math.sqrt(AU ** 3 / MU);
    const [r1] = propagate(r, v, P, MU);
    expect(norm(sub(r1, r)) / AU).toBeLessThan(1e-8);
    const [rHalf] = propagate(r, v, P / 2, MU);
    expect(rHalf[0] / AU).toBeCloseTo(-1, 8);
  });

  it('Earth-Mars Hohmann time is about 259 days', () => {
    expect(hohmannTof(AU, 1.524 * AU, MU) / DAY).toBeCloseTo(259, 0);
  });

  it('lambert reproduces a propagated arc (short and long way)', () => {
    const r0: Vec3 = [AU, 0, 0];
    const v0: Vec3 = [0, Math.sqrt(MU / AU) * 1.1, 0];
    for (const days of [60, 150, 250]) {
      const dt = days * DAY;
      const [r1, v1] = propagate(r0, v0, dt, MU);
      const sol = lambert(r0, r1, dt, MU);
      expect(sol).not.toBeNull();
      expect(norm(sub(sol![0], v0))).toBeLessThan(1e-3);
      expect(norm(sub(sol![1], v1))).toBeLessThan(1e-3);
    }
  });
});

describe('system generator', () => {
  it('is deterministic per seed', () => {
    expect(generateSystem(42)).toEqual(generateSystem(42));
  });

  it('a perfect Hohmann launch at every window succeeds with the designed margin', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const sys = generateSystem(seed);
      expect(sys.windows.length).toBeGreaterThan(0);
      for (const w of sys.windows) {
        const res = simulateLaunch(sys, {
          departTime: w,
          tof: sys.hohmann.tof,
          vInfRadial: 0,
          vInfPrograde: sys.hohmann.vInfDepart,
        });
        expect(res.outcome).toBe('success');
        expect(res.correctionCost).toBeLessThan(1);
        const ideal = sys.hohmann.departCost + sys.hohmann.captureCost;
        expect(Math.abs(res.totalCost - ideal)).toBeLessThan(2);
        // Arrival really is at planet 2.
        expect(res.missUncorrected).toBeLessThan(1e6);
        expect(norm(sub(res.path.at(-1)!, planetPos(sys.target, w + sys.hohmann.tof)))).toBeLessThan(1e6);
      }
    }
  });
});
