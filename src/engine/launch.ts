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
import { flyFlyby, planFlyby, type FlybyPlan } from './flyby';

export interface LaunchPlan {
  departTime: number; // s since landing
  tof: number; // planned flight time (s)
  /** Escape excess velocity relative to planet 1, split into radial / prograde parts (m/s). */
  vInfRadial: number;
  vInfPrograde: number;
  /** Chapter 7: a gravity assist at the giant, reached `tof1` after departure. */
  flyby?: FlybyPlan & { tof1: number; muModel: number; rpMin: number };
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

  if (plan.flyby && sys.giant) return simulateSlingshot(sys, plan, { r1, v0, dep, missUncorrected, coast });

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

/**
 * Chapter 7: depart, correct course at mid-leg to meet the REAL giant, fly past
 * it with its REAL mass (a wrong mass bends the path the wrong amount), correct
 * again at mid-leg to meet the target, and brake.
 */
function simulateSlingshot(
  sys: StarSystem,
  plan: LaunchPlan,
  d: { r1: Vec3; v0: Vec3; dep: number; missUncorrected: number; coast: Vec3[] },
): LaunchResult {
  const mu = G * sys.star.mass;
  const budget = sys.fuelDv;
  const fb = plan.flyby!;
  const giant = sys.giant!;
  const t0 = plan.departTime;
  const t1 = t0 + fb.tof1;
  const tof2 = plan.tof - fb.tof1;
  const t2 = t1 + tof2;
  const lost = (correction: number, path: Vec3[]): LaunchResult => ({
    outcome: 'lost',
    departCost: d.dep,
    correctionCost: correction,
    captureCost: 0,
    totalCost: Infinity,
    fuelLeft: -Infinity,
    missUncorrected: d.missUncorrected,
    arrivalVInf: 0,
    path,
  });
  // Leg 1, with a mid-course correction aimed at the real giant.
  const [rm1, vm1] = propagate(d.r1, d.v0, fb.tof1 / 2, mu);
  const rG = planetPos(giant, t1);
  const vG = planetVel(giant, t1);
  const sol1 = lambert(rm1, rG, fb.tof1 / 2, mu);
  if (!sol1) return lost(0, d.coast);
  const corr1 = norm(sub(sol1[0], vm1));
  // On approach ECHO sights the real target and re-aims the flyby for it — but it can
  // only use the giant's mass from YOUR measurements. The real mass decides the bend.
  const vInfIn = sub(sol1[1], vG);
  const want = lambert(rG, planetPos(sys.target, t2), tof2, mu);
  const aim = want ? planFlyby(vInfIn, sub(want[0], vG), fb.muModel, fb.rpMin) : { ...fb, cost: Math.abs(fb.dv) + fb.extraDv };
  const vInfOut = flyFlyby(vInfIn, G * giant.mass, aim);
  const fbCost = aim.cost;
  const vOut = add(vG, vInfOut);
  // Leg 2, with a second correction aimed at the real target.
  const [rm2, vm2] = propagate(rG, vOut, tof2 / 2, mu);
  const r2 = planetPos(sys.target, t2);
  const sol2 = lambert(rm2, r2, tof2 / 2, mu);
  const path1 = [...sampleCoast(d.r1, d.v0, fb.tof1 / 2, mu, 30), ...sampleCoast(rm1, sol1[0], fb.tof1 / 2, mu, 30)];
  if (!sol2) return lost(corr1, path1);
  const corr2 = norm(sub(sol2[0], vm2));
  const arrivalVInf = norm(sub(sol2[1], planetVel(sys.target, t2)));
  const cap = captureCost(arrivalVInf, G * sys.target.mass, sys.parkingRadius);
  const correction = corr1 + corr2;
  const total = d.dep + fbCost + correction + cap;
  const path = [...path1, ...sampleCoast(rG, vOut, tof2 / 2, mu, 30), ...sampleCoast(rm2, sol2[0], tof2 / 2, mu, 30)];
  const result = {
    departCost: d.dep + fbCost,
    correctionCost: correction,
    captureCost: cap,
    totalCost: total,
    fuelLeft: budget - total,
    missUncorrected: closestApproach(sys, rG, vOut, t1, tof2 * 1.5),
    arrivalVInf,
  };
  if (d.dep + fbCost + correction > budget) return { ...result, outcome: 'lost', path: path1 };
  if (total > budget) return { ...result, outcome: 'flyby', path };
  return { ...result, outcome: 'success', path };
}

function sampleCoast(r0: Vec3, v0: Vec3, span: number, mu: number, n = 60): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) out.push(propagate(r0, v0, (span * i) / n, mu)[0]);
  return out;
}
