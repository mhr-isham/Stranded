// Positions and velocities of every body at time t (seconds since landing).
// Heliocentric ecliptic frame: star at the origin, orbits in the z = 0 plane.

import { TAU } from './constants';
import type { Planet, StarSystem } from './types';
import type { Vec3 } from './vec';

export const orbitAngle = (p: { phase0: number; period: number }, t: number) =>
  p.phase0 + (TAU * t) / p.period;

/** Eccentric anomaly from mean anomaly (Newton's method on Kepler's equation). */
export function eccentricAnomaly(M: number, e: number) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-13) break;
  }
  return E;
}

/** Position and velocity on a Kepler ellipse given its mean longitude (circular when e = 0). */
export function keplerState(a: number, period: number, e: number, peri: number, meanLon: number): [Vec3, Vec3] {
  const n = TAU / period;
  if (!e) {
    const v = a * n;
    return [
      [a * Math.cos(meanLon), a * Math.sin(meanLon), 0],
      [-v * Math.sin(meanLon), v * Math.cos(meanLon), 0],
    ];
  }
  const E = eccentricAnomaly(meanLon - peri, e);
  const b = a * Math.sqrt(1 - e * e);
  const cE = Math.cos(E);
  const sE = Math.sin(E);
  const x = a * (cE - e);
  const y = b * sE;
  const Edot = n / (1 - e * cE);
  const vx = -a * sE * Edot;
  const vy = b * cE * Edot;
  const c = Math.cos(peri);
  const s = Math.sin(peri);
  return [
    [x * c - y * s, x * s + y * c, 0],
    [vx * c - vy * s, vx * s + vy * c, 0],
  ];
}

/** Mean longitude that puts a body at true longitude `lon` (inverse of keplerState's angle). */
export function meanLonForTrue(e: number, peri: number, lon: number) {
  if (!e) return lon;
  const nu = lon - peri;
  const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  return E - e * Math.sin(E) + peri;
}

export function planetPos(p: Planet, t: number): Vec3 {
  return keplerState(p.a, p.period, p.e ?? 0, p.peri ?? 0, orbitAngle(p, t))[0];
}

export function planetVel(p: Planet, t: number): Vec3 {
  return keplerState(p.a, p.period, p.e ?? 0, p.peri ?? 0, orbitAngle(p, t))[1];
}

/** True heliocentric longitude. */
export const trueLongitude = (p: Planet, t: number) => {
  if (!p.e) return orbitAngle(p, t);
  const r = planetPos(p, t);
  return Math.atan2(r[1], r[0]);
};

export function moonPos(sys: StarSystem, t: number): Vec3 {
  const c = planetPos(sys.target, t);
  const th = orbitAngle(sys.moon, t);
  return [c[0] + sys.moon.a * Math.cos(th), c[1] + sys.moon.a * Math.sin(th), 0];
}

/** Local solar day of the home planet (s): noon to noon. */
export const solarDay = (sys: StarSystem) =>
  sys.home.siderealDay === sys.home.period ? Infinity : 1 / (1 / sys.home.siderealDay - 1 / sys.home.period);

/** Heliocentric longitude of planet 2 minus planet 1, wrapped to [0, 2pi). */
export function leadAngle(sys: StarSystem, t: number) {
  const d = trueLongitude(sys.target, t) - trueLongitude(sys.home, t);
  return ((d % TAU) + TAU) % TAU;
}

/**
 * Oppositions of an eccentric planet are uneven: find each one numerically,
 * as the zeros of the lead angle (wrapped to ±π).
 */
function eccentricOppositions(sys: StarSystem, t0: number, t1: number): number[] {
  const f = (t: number) => {
    const d = leadAngle(sys, t);
    return d > Math.PI ? d - TAU : d;
  };
  const out: number[] = [];
  const step = sys.synodic / 60;
  let a = t0;
  let fa = f(a);
  for (let b = t0 + step; a < t1; b += step) {
    const fb = f(b);
    // A sign change through zero (not the wrap at ±π).
    if (fa <= 0 && fb > 0 && fb - fa < Math.PI) {
      let lo = a;
      let hi = b;
      for (let i = 0; i < 50; i++) {
        const m = 0.5 * (lo + hi);
        if (f(m) <= 0) lo = m;
        else hi = m;
      }
      const t = 0.5 * (lo + hi);
      if (t >= t0 && t <= t1) out.push(t);
    } else if (fa >= 0 && fb < 0 && fa - fb < Math.PI) {
      let lo = a;
      let hi = b;
      for (let i = 0; i < 50; i++) {
        const m = 0.5 * (lo + hi);
        if (f(m) >= 0) lo = m;
        else hi = m;
      }
      const t = 0.5 * (lo + hi);
      if (t >= t0 && t <= t1) out.push(t);
    }
    a = b;
    fa = fb;
  }
  return out;
}

const oppCache = new WeakMap<StarSystem, number[]>();

/** Times of opposition (planet 2 opposite the star; inferior conjunction for an inner planet) in [t0, t1]. */
export function oppositions(sys: StarSystem, t0: number, t1: number): number[] {
  if (sys.target.e) {
    // Cached over the whole expedition; computed directly outside it.
    let all = oppCache.get(sys);
    const lo = -sys.synodic;
    const hi = sys.lifeSupport + 4 * sys.synodic;
    if (!all) oppCache.set(sys, (all = eccentricOppositions(sys, lo, hi)));
    if (t0 >= lo && t1 <= hi) return all.filter((t) => t >= t0 && t <= t1);
    return eccentricOppositions(sys, t0, t1);
  }
  const out: number[] = [];
  const k0 = Math.ceil((t0 - sys.firstOpposition) / sys.synodic);
  for (let k = k0; ; k++) {
    const t = sys.firstOpposition + k * sys.synodic;
    if (t > t1) break;
    out.push(t);
  }
  return out;
}

/** The opposition nearest time t. */
export function nearestOpposition(sys: StarSystem, t: number) {
  if (!sys.target.e) {
    const k = Math.round((t - sys.firstOpposition) / sys.synodic);
    return sys.firstOpposition + k * sys.synodic;
  }
  const near = oppositions(sys, t - 1.5 * sys.synodic, t + 1.5 * sys.synodic);
  return near.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), near[0] ?? sys.firstOpposition);
}

/** Chapter 7: the giant's moon. */
export function giantMoonPos(sys: StarSystem, t: number): Vec3 {
  const g = sys.giant!;
  const c = planetPos(g, t);
  const th = orbitAngle(g.moon, t);
  return [c[0] + g.moon.a * Math.cos(th), c[1] + g.moon.a * Math.sin(th), 0];
}

/** Oppositions of any circular outer planet (for the giant): when it shares our heliocentric longitude. */
export function oppositionsOf(home: Planet, p: Planet, t0: number, t1: number): number[] {
  const rate = TAU * (1 / home.period - 1 / p.period); // how fast we gain on it
  const S = TAU / Math.abs(rate);
  // Phase of the gap at t = 0, wrapped: opposition when home.phase0 + rate·t − p.phase0 ≡ 0.
  const g0 = home.phase0 - p.phase0;
  const tFirst = ((((-g0 / rate) % S) + S) % S);
  const out: number[] = [];
  for (let t = tFirst + Math.floor((t0 - tFirst) / S) * S; t <= t1; t += S) if (t >= t0) out.push(t);
  return out;
}
