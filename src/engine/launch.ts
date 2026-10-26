// Flight simulation. The player's plan is built from *their* numbers; this
// module flies it through the *true* system and reports what happens.
//
// Model: closed-loop ascent guidance delivers the planned escape excess
// velocity (so departure costs the true surface->escape delta-v), the ship
// coasts, performs one optical-navigation correction at mid-course aimed at
// the real planet 2, then brakes into a parking orbit.

import { G } from './constants';
import { planetPos, planetVel } from './ephemeris';
import { captureCost, departCost, lambert, propagate } from './orbits';
import type { StarSystem } from './types';
import { add, norm, scale, sub, unit, type Vec3 } from './vec';

export interface LaunchPlan {
  departTime: number; // s since landing
  tof: number; // planned flight time (s)
  /** Escape excess velocity relative to planet 1, split into radial / prograde parts (m/s). */
  vInfRadial: number;
  vInfPrograde: number;
}

export type LaunchOutcome = 'success' | 'flyby' | 'lost' | 'no-escape' | 'expired';

export interface LaunchResult {
  outcome: LaunchOutcome;
  departCost: number;
  correctionCost: number;
  captureCost: number;
  totalCost: number;
  fuelLeft: number; // m/s, negative when the plan could not be flown
  missUncorrected: number; // closest approach if no correction was made (m)
  arrivalVInf: number;
  /** Heliocentric path samples for animation (actual flown path). */
  path: Vec3[];
}

export function closestApproach(sys: StarSystem, r0: Vec3, v0: Vec3, t0: number, span: number) {
  const mu = G * sys.star.mass;
  const dist = (dt: number) => norm(sub(propagate(r0, v0, dt, mu)[0], planetPos(sys.target, t0 + dt)));
  const n = 300;
  let bestI = 0;
  let best = Infinity;
  for (let i = 0; i <= n; i++) {
    const d = dist((span * i) / n);
    if (d < best) [best, bestI] = [d, i];
  }
  // Refine around the coarse minimum with a golden-section search.
  let a = (span * Math.max(0, bestI - 1)) / n;
  let b = (span * Math.min(n, bestI + 1)) / n;
  const k = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 60; i++) {
    const c = b - k * (b - a);
    const d = a + k * (b - a);
    if (dist(c) < dist(d)) b = d;
    else a = c;
  }
  return Math.min(best, dist(0.5 * (a + b)));
}

export function simulateLaunch(sys: StarSystem, plan: LaunchPlan): LaunchResult {
  const mu = G * sys.star.mass;
  const budget = sys.fuelDv;
  const t0 = plan.departTime;
  const r1 = planetPos(sys.home, t0);
  const v1 = planetVel(sys.home, t0);
  const vInf = add(scale(unit(r1), plan.vInfRadial), scale(unit(v1), plan.vInfPrograde));
  const dep = departCost(norm(vInf), G * sys.home.mass, sys.home.radius);
  const v0 = add(v1, vInf);

  const base = { departCost: dep, correctionCost: 0, captureCost: 0, arrivalVInf: 0 };
  const missUncorrected = closestApproach(sys, r1, v0, t0, plan.tof * 1.5);
  const coast = sampleCoast(r1, v0, plan.tof, mu);

  if (t0 > sys.lifeSupport) {
    return { ...base, outcome: 'expired', totalCost: 0, fuelLeft: budget, missUncorrected, path: [] };
  }
  if (dep > budget) {
    return { ...base, outcome: 'no-escape', totalCost: dep, fuelLeft: budget - dep, missUncorrected, path: [] };
  }

  const half = plan.tof / 2;
  const [rm, vm] = propagate(r1, v0, half, mu);
  const tArr = t0 + plan.tof;
  const r2 = planetPos(sys.target, tArr);
  const sol = lambert(rm, r2, half, mu);
  if (!sol) {
    return { ...base, outcome: 'lost', totalCost: Infinity, fuelLeft: -Infinity, missUncorrected, path: coast };
  }
  const correction = norm(sub(sol[0], vm));
  const arrivalVInf = norm(sub(sol[1], planetVel(sys.target, tArr)));
  const cap = captureCost(arrivalVInf, G * sys.target.mass, sys.parkingRadius);
  const total = dep + correction + cap;
  const path = [...sampleCoast(r1, v0, half, mu), ...sampleCoast(rm, sol[0], half, mu)];
  const result = {
    departCost: dep,
    correctionCost: correction,
    captureCost: cap,
    totalCost: total,
    fuelLeft: budget - total,
    missUncorrected,
    arrivalVInf,
  };
  if (dep + correction > budget) return { ...result, outcome: 'lost', path: coast };
  if (total > budget) return { ...result, outcome: 'flyby', path };
  return { ...result, outcome: 'success', path };
}

function sampleCoast(r0: Vec3, v0: Vec3, span: number, mu: number, n = 60): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) out.push(propagate(r0, v0, (span * i) / n, mu)[0]);
  return out;
}
