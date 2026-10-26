// Two-body orbital mechanics: universal-variable propagation, a zero-revolution
// Lambert solver, and Hohmann transfer numbers. Based on the standard
// formulation in Curtis, "Orbital Mechanics for Engineering Students".

import { TAU } from './constants';
import { add, cross, dot, norm, scale, sub, type Vec3 } from './vec';

export function stumpffC(z: number) {
  if (Math.abs(z) < 1e-3) return 1 / 2 - z / 24 + (z * z) / 720;
  if (z > 0) return (1 - Math.cos(Math.sqrt(z))) / z;
  return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
}

export function stumpffS(z: number) {
  if (Math.abs(z) < 1e-3) return 1 / 6 - z / 120 + (z * z) / 5040;
  if (z > 0) {
    const s = Math.sqrt(z);
    return (s - Math.sin(s)) / (s * s * s);
  }
  const s = Math.sqrt(-z);
  return (Math.sinh(s) - s) / (s * s * s);
}

/** Propagate a two-body state by dt seconds around a body with parameter mu. */
export function propagate(r0: Vec3, v0: Vec3, dt: number, mu: number): [Vec3, Vec3] {
  if (dt === 0) return [r0, v0];
  const r0n = norm(r0);
  const vr0 = dot(r0, v0) / r0n;
  const alpha = 2 / r0n - dot(v0, v0) / mu;
  const smu = Math.sqrt(mu);
  let chi = smu * Math.abs(alpha) * dt;
  if (!Number.isFinite(chi) || chi === 0) chi = (smu * dt) / r0n;
  for (let i = 0; i < 100; i++) {
    const z = alpha * chi * chi;
    const C = stumpffC(z);
    const S = stumpffS(z);
    const F =
      ((r0n * vr0) / smu) * chi * chi * C + (1 - alpha * r0n) * chi ** 3 * S + r0n * chi - smu * dt;
    const dF = ((r0n * vr0) / smu) * chi * (1 - alpha * chi * chi * S) + (1 - alpha * r0n) * chi * chi * C + r0n;
    const step = F / dF;
    chi -= step;
    if (Math.abs(step) < 1e-9 * Math.max(1, Math.abs(chi))) break;
  }
  const z = alpha * chi * chi;
  const C = stumpffC(z);
  const S = stumpffS(z);
  const f = 1 - ((chi * chi) / r0n) * C;
  const g = dt - (chi ** 3 / smu) * S;
  const r = add(scale(r0, f), scale(v0, g));
  const rn = norm(r);
  const fdot = (smu / (rn * r0n)) * (alpha * chi ** 3 * S - chi);
  const gdot = 1 - ((chi * chi) / rn) * C;
  return [r, add(scale(r0, fdot), scale(v0, gdot))];
}

/**
 * Zero-revolution, prograde Lambert problem: the orbit from r1 to r2 in time dt.
 * Returns the velocities at both ends, or null when no solution was found.
 */
export function lambert(r1: Vec3, r2: Vec3, dt: number, mu: number): [Vec3, Vec3] | null {
  let theta = Math.atan2(cross(r1, r2)[2], dot(r1, r2));
  if (theta < 0) theta += TAU;
  // A 180 degree transfer (exactly the Hohmann case) is singular: average the
  // solutions for targets rotated slightly either side of it.
  const SING = 2e-3;
  if (Math.abs(theta - Math.PI) < SING) {
    const d = SING - (theta - Math.PI); // rotate so the angle becomes pi - SING / pi + SING
    const a = lambertRaw(r1, rotZ(r2, -d), dt, mu);
    const b = lambertRaw(r1, rotZ(r2, 2 * SING - d), dt, mu);
    if (!a || !b) return null;
    const w = (theta - (Math.PI - SING)) / (2 * SING);
    return [lerp(a[0], b[0], w), lerp(a[1], b[1], w)];
  }
  return lambertRaw(r1, r2, dt, mu);
}

const rotZ = (v: Vec3, ang: number): Vec3 => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
};
const lerp = (a: Vec3, b: Vec3, w: number): Vec3 => [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];

function lambertRaw(r1: Vec3, r2: Vec3, dt: number, mu: number): [Vec3, Vec3] | null {
  const r1n = norm(r1);
  const r2n = norm(r2);
  let theta = Math.atan2(cross(r1, r2)[2], dot(r1, r2));
  if (theta < 0) theta += TAU;
  const A = Math.sin(theta) * Math.sqrt((r1n * r2n) / (1 - Math.cos(theta)));
  if (!Number.isFinite(A) || Math.abs(A) < 1e-12) return null;
  const smu = Math.sqrt(mu);
  const y = (z: number) => r1n + r2n + (A * (z * stumpffS(z) - 1)) / Math.sqrt(stumpffC(z));
  const F = (z: number) => {
    const yz = y(z);
    return (yz / stumpffC(z)) ** 1.5 * stumpffS(z) + A * Math.sqrt(yz) - smu * dt;
  };

  // Bracket the root: F rises monotonically in z where y(z) > 0.
  const hi0 = TAU * TAU - 1e-6;
  let lo = -4 * TAU * TAU;
  if (y(lo) <= 0) {
    // Raise lo until y > 0 (only happens for transfer angles below 180 deg).
    let a = lo;
    let b = hi0;
    for (let i = 0; i < 200; i++) {
      const m = 0.5 * (a + b);
      if (y(m) > 0) b = m;
      else a = m;
    }
    lo = b + 1e-9;
  } else {
    while (F(lo) > 0 && lo > -1e4) lo *= 2;
  }
  let hi = hi0;
  if (!(F(lo) <= 0 && F(hi) >= 0)) return null;
  for (let i = 0; i < 200; i++) {
    const m = 0.5 * (lo + hi);
    if (F(m) > 0) hi = m;
    else lo = m;
    if (hi - lo < 1e-12) break;
  }
  const z = 0.5 * (lo + hi);
  const yz = y(z);
  const f = 1 - yz / r1n;
  const g = A * Math.sqrt(yz / mu);
  const gdot = 1 - yz / r2n;
  const v1 = scale(sub(r2, scale(r1, f)), 1 / g);
  const v2 = scale(sub(scale(r2, gdot), r1), 1 / g);
  return [v1, v2];
}

export const hohmannTof = (a1: number, a2: number, mu: number) =>
  Math.PI * Math.sqrt((a1 + a2) ** 3 / (8 * mu));

export const hohmannVInfDepart = (a1: number, a2: number, mu: number) =>
  Math.sqrt(mu / a1) * (Math.sqrt((2 * a2) / (a1 + a2)) - 1);

export const hohmannVInfArrive = (a1: number, a2: number, mu: number) =>
  Math.sqrt(mu / a2) * (1 - Math.sqrt((2 * a1) / (a1 + a2)));

/** Burn from the surface that leaves the planet with excess speed vInf. */
export const departCost = (vInf: number, muPlanet: number, rPlanet: number) =>
  Math.sqrt(vInf * vInf + (2 * muPlanet) / rPlanet);

/** Burn at periapsis rPark that turns a hyperbolic arrival into a circular orbit. */
export const captureCost = (vInf: number, muPlanet: number, rPark: number) =>
  Math.sqrt(vInf * vInf + (2 * muPlanet) / rPark) - Math.sqrt(muPlanet / rPark);
