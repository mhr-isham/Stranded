// Launch windows found numerically: the local minima of the transfer cost as a
// function of departure time. Needed when the target's orbit is an ellipse and
// the windows are no longer evenly spaced (chapter 4).

import { G } from './constants';
import { captureCost, departCost, lambert } from './orbits';
import { norm, sub, type Vec3 } from './vec';

export interface Body {
  pos: (t: number) => Vec3;
  vel: (t: number) => Vec3;
}

/** Cheapest total Δv (depart + capture) for leaving at t, over a coarse grid of flight times, and the flight time. */
export function cheapestAt(home: Body, target: Body, muStar: number, m1: number, r1: number, m2: number, rPark: number, t: number, tofLo: number, tofHi: number, n = 10) {
  const r0 = home.pos(t);
  const v0 = home.vel(t);
  const costOf = (tof: number) => {
    const sol = lambert(r0, target.pos(t + tof), tof, muStar);
    if (!sol) return Infinity;
    return departCost(norm(sub(sol[0], v0)), G * m1, r1) + captureCost(norm(sub(sol[1], target.vel(t + tof))), G * m2, rPark);
  };
  let best = Infinity;
  let bestTof = tofLo;
  for (let i = 0; i <= n; i++) {
    const tof = tofLo + ((tofHi - tofLo) * i) / n;
    const c = costOf(tof);
    if (c < best) [best, bestTof] = [c, tof];
  }
  // Refine the flight time so the cost is a smooth function of t.
  const h = (tofHi - tofLo) / n;
  let a = Math.max(tofLo, bestTof - h);
  let b = Math.min(tofHi, bestTof + h);
  const k = (Math.sqrt(5) - 1) / 2;
  for (let j = 0; j < 14; j++) {
    const c = b - k * (b - a);
    const d = a + k * (b - a);
    if (costOf(c) < costOf(d)) b = d;
    else a = c;
  }
  const tof = 0.5 * (a + b);
  const c = costOf(tof);
  return c < best ? { cost: c, tof } : { cost: best, tof: bestTof };
}

/**
 * Local minima of cost(t) on [t0, t1], each refined by golden-section search.
 * Shallow dips well above the cheapest one (expensive fast transfers) are not
 * windows: only minima within `relTol` of the cheapest are kept.
 */
export function costMinima(cost: (t: number) => number, t0: number, t1: number, step: number, minGap = 8 * step, relTol = 1.3): number[] {
  const ts: number[] = [];
  const cs: number[] = [];
  for (let t = t0; t <= t1; t += step) {
    ts.push(t);
    cs.push(cost(t));
  }
  const out: number[] = [];
  const k = (Math.sqrt(5) - 1) / 2;
  for (let i = 1; i < ts.length - 1; i++) {
    if (!(cs[i] < cs[i - 1] && cs[i] <= cs[i + 1])) continue;
    let a = ts[i - 1];
    let b = ts[i + 1];
    for (let j = 0; j < 18; j++) {
      const c = b - k * (b - a);
      const d = a + k * (b - a);
      if (cost(c) < cost(d)) b = d;
      else a = c;
    }
    const t = 0.5 * (a + b);
    // Two dips close together are one window: keep the cheaper.
    const prev = out[out.length - 1];
    if (prev !== undefined && t - prev < minGap) {
      if (cost(t) < cost(prev)) out[out.length - 1] = t;
    } else out.push(t);
  }
  const costs = out.map(cost);
  const best = Math.min(...costs);
  return out.filter((_, i) => costs[i] <= relTol * best);
}
