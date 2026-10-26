// Positions and velocities of every body at time t (seconds since landing).
// Heliocentric ecliptic frame: star at the origin, orbits in the z = 0 plane.

import { TAU } from './constants';
import type { Planet, StarSystem } from './types';
import type { Vec3 } from './vec';

export const orbitAngle = (p: { phase0: number; period: number }, t: number) =>
  p.phase0 + (TAU * t) / p.period;

export function planetPos(p: Planet, t: number): Vec3 {
  const th = orbitAngle(p, t);
  return [p.a * Math.cos(th), p.a * Math.sin(th), 0];
}

export function planetVel(p: Planet, t: number): Vec3 {
  const th = orbitAngle(p, t);
  const v = (TAU * p.a) / p.period;
  return [-v * Math.sin(th), v * Math.cos(th), 0];
}

export function moonPos(sys: StarSystem, t: number): Vec3 {
  const c = planetPos(sys.target, t);
  const th = orbitAngle(sys.moon, t);
  return [c[0] + sys.moon.a * Math.cos(th), c[1] + sys.moon.a * Math.sin(th), 0];
}

/** Local solar day of the home planet (s): noon to noon. */
export const solarDay = (sys: StarSystem) =>
  1 / (1 / sys.home.siderealDay - 1 / sys.home.period);

/** Heliocentric longitude of planet 2 minus planet 1, wrapped to [0, 2pi). */
export function leadAngle(sys: StarSystem, t: number) {
  const d = orbitAngle(sys.target, t) - orbitAngle(sys.home, t);
  return ((d % TAU) + TAU) % TAU;
}

/** Times of opposition (planet 2 opposite the star) in [t0, t1]. */
export function oppositions(sys: StarSystem, t0: number, t1: number): number[] {
  const out: number[] = [];
  const k0 = Math.ceil((t0 - sys.firstOpposition) / sys.synodic);
  for (let k = k0; ; k++) {
    const t = sys.firstOpposition + k * sys.synodic;
    if (t > t1) break;
    out.push(t);
  }
  return out;
}
