import { describe, expect, it } from 'vitest';
import { DAY, G } from '../src/engine/constants';
import { ascentStart, autopilot, inOrbit, stepAscent } from '../src/engine/ascent';
import { flightAtmosphere } from '../src/engine/atmosphere';
import { dynPressure, judgeTouchdown, stepDescent, type DescentParams, type DescentState } from '../src/engine/descent';
import { hopParams } from '../src/engine/hop';
import { actsFor, completedActs } from '../src/game/acts';
import { missionsFor } from '../src/game/missions';
import { useGame } from '../src/game/store';
import { generateSystem } from '../src/engine/system';
import { generateSolvableSystem } from '../src/engine/solver';

describe('chapter 9: the real Solar System', () => {
  const sys = generateSystem(11, 'navigator', 9);
  it('uses the real Mars and Earth', () => {
    expect(sys.home.period / DAY).toBeCloseTo(687, 0);
    expect(sys.target.period / DAY).toBeCloseTo(365.25, 0);
    expect(sys.synodic / DAY).toBeCloseTo(780, 0);
    expect(sys.hohmann.tof / DAY).toBeCloseTo(259, 0);
    expect(sys.features.inner).toBe(true);
  });
  it('is solvable in every mode', () => {
    for (const d of ['stargazer', 'cadet', 'navigator', 'astronomer', 'legend'] as const) expect(generateSolvableSystem(11, d, 9)).toBeTruthy();
  });
});

describe('Home mission progression and atmospheric flight', () => {
  it('credits the transit milestone in Act III', () => {
    const missions = missionsFor({ chapter: 9 });
    expect(actsFor(9)[2].missions).toEqual(['transit', 'parallax', 'disk']);
    const transit = missions.find(m => m.id === 'transit')!;
    const s = { ...useGame.getState(), chapter: 9, missionsDone: ['parallax', 'disk'], oppPicks: [32 * DAY] };
    expect(transit.done(s)).toBe(true);
    expect(completedActs(s)).not.toContain(3);
    expect(completedActs({ ...s, missionsDone: [...s.missionsDone, 'transit'] })).toContain(3);
  });

  it('gives Mars much weaker chute braking than Earth at the same speed', () => {
    const mars = hopParams(3.73, false, flightAtmosphere(true));
    const earth = hopParams(9.82, false, flightAtmosphere(true, true));
    expect(earth.rho0 / mars.rho0).toBeGreaterThan(70);
    const start: DescentState = { x: 0, y: 2000, vx: 0, vy: -80, th: 0, om: 0, fuel: 650, chute: 'open', t: 0 };
    expect(dynPressure(earth, start) / dynPressure(mars, start)).toBeGreaterThan(65);
    const coast = (p: DescentParams) => {
      let s = start;
      while (s.y > 0 && s.t < 200) s = stepDescent(p, s, { turn: 0, throttle: 0 }, .05);
      expect(s.y).toBeLessThanOrEqual(0);
      return Math.abs(s.vy);
    };
    expect(coast(mars)).toBeGreaterThan(65);
    expect(coast(earth)).toBeLessThan(18);
    expect(flightAtmosphere(false)).toEqual({ rho0: 1.1, scaleH: 8500 });
  });

  it('can bring a Mars chute descent to a clean powered touchdown with a Legend fuel budget', () => {
    const p = hopParams(3.73, false, flightAtmosphere(true));
    const terrain = { features: [], height: () => 0, hillX: 0, hillH: 0 };
    let s: DescentState = { x: 0, y: 8000, vx: 0, vy: -100, th: 0, om: 0, fuel: 650, chute: 'open', t: 0 };
    while (s.y > 0 && s.t < 300) {
      const target = -Math.min(85, Math.sqrt(2 * (p.thrust - p.g) * s.y * .6 + 9));
      const throttle = s.vy < target ? 1 : 0;
      s = stepDescent(p, s, { turn: 0, throttle }, .02);
    }
    expect(s.y).toBeLessThanOrEqual(0);
    expect(s.fuel).toBeGreaterThan(0);
    expect(s.fuel).toBeLessThan(600);
    expect(judgeTouchdown(terrain, s, false)).toBe('clean');
  });

  it('can reach a safe Mars parking orbit with ECHO’s ascent profile', () => {
    const sys = generateSystem(11, 'navigator', 9);
    const mu = G * sys.home.mass, R = sys.home.radius;
    const p = { mu, R, ...flightAtmosphere(true), thrust: 2.2 * mu / R ** 2, cda: .0004, orbitAlt: 200e3 };
    let s = ascentStart(p);
    for (let i = 0; i < 120000 && !inOrbit(p, s); i++) s = stepAscent(p, s, autopilot(p, s), .05);
    expect(inOrbit(p, s)).toBe(true);
    expect(s.dv).toBeLessThan(6200);
  });
});
