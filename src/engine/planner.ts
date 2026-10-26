// Launch planning from the player's own numbers. Nothing here reads the true
// system: the plan is only as good as the measurements behind it.

import { G, TAU } from './constants';
import type { Estimate, Primaries, PrimaryKey } from './chain';
import { deriveAll } from './chain';
import type { LaunchPlan } from './launch';
import { captureCost, departCost, hohmannTof, hohmannVInfArrive, hohmannVInfDepart, lambert } from './orbits';
import type { Rng } from './rng';
import type { StarSystem } from './types';
import { dot, norm, sub, type Vec3 } from './vec';

/** The player's picture of the system, built from the progress sheet. */
export interface PlayerModel {
  P1: number;
  P2: number;
  S2: number;
  a1: number;
  a2: number;
  Mstar: number;
  tOpp: number;
  M1: number;
  R1: number;
  M2: number;
  R2: number;
}

export const LAUNCH_KEYS: PrimaryKey[] = ['R1', 'g', 'P1', 'S2', 'tOpp', 'dPar', 'alpha2', 'thetaM', 'Pm'];

export function modelFromPrimaries(p: Primaries): PlayerModel | null {
  const d = deriveAll(p);
  if (!d.P2 || !d.a1 || !d.a2 || !d.Mstar || !d.M1 || !d.M2 || !d.R2 || !p.tOpp || !p.R1) return null;
  return {
    P1: p.P1!.value,
    P2: d.P2.value,
    S2: p.S2!.value,
    a1: d.a1.value,
    a2: d.a2.value,
    Mstar: d.Mstar.value,
    tOpp: p.tOpp.value,
    M1: d.M1.value,
    R1: p.R1.value,
    M2: d.M2.value,
    R2: d.R2.value,
  };
}

export const posAt = (a: number, P: number, m: PlayerModel, t: number): Vec3 => {
  const th = (TAU * (t - m.tOpp)) / P;
  return [a * Math.cos(th), a * Math.sin(th), 0];
};
export const velAt = (a: number, P: number, m: PlayerModel, t: number): Vec3 => {
  const th = (TAU * (t - m.tOpp)) / P;
  const v = (TAU * a) / P;
  return [-v * Math.sin(th), v * Math.cos(th), 0];
};

export interface PlannedTransfer {
  plan: LaunchPlan;
  departCost: number;
  captureCost: number;
  total: number;
  vInfDepart: number;
  vInfArrive: number;
}

/** Plan a transfer leaving at `departTime` and arriving `tof` later, in the player's model. */
export function planTransfer(m: PlayerModel, departTime: number, tof: number): PlannedTransfer | null {
  const mu = G * m.Mstar;
  const r1 = posAt(m.a1, m.P1, m, departTime);
  const v1 = velAt(m.a1, m.P1, m, departTime);
  const r2 = posAt(m.a2, m.P2, m, departTime + tof);
  const v2 = velAt(m.a2, m.P2, m, departTime + tof);
  const sol = lambert(r1, r2, tof, mu);
  if (!sol) return null;
  const vInf = sub(sol[0], v1);
  const vInfArr = norm(sub(sol[1], v2));
  const rHat = r1.map((x) => x / norm(r1)) as Vec3;
  const pHat = v1.map((x) => x / norm(v1)) as Vec3;
  const dep = departCost(norm(vInf), G * m.M1, m.R1);
  const cap = captureCost(vInfArr, G * m.M2, 1.3 * m.R2);
  return {
    plan: { departTime, tof, vInfRadial: dot(vInf, rHat), vInfPrograde: dot(vInf, pHat) },
    departCost: dep,
    captureCost: cap,
    total: dep + cap,
    vInfDepart: norm(vInf),
    vInfArrive: vInfArr,
  };
}

export function hohmannFor(m: PlayerModel) {
  const mu = G * m.Mstar;
  const tof = hohmannTof(m.a1, m.a2, mu);
  const lead = Math.PI - (TAU * tof) / m.P2;
  const vInfD = hohmannVInfDepart(m.a1, m.a2, mu);
  const vInfA = hohmannVInfArrive(m.a1, m.a2, mu);
  return {
    tof,
    lead,
    vInfDepart: vInfD,
    vInfArrive: vInfA,
    departCost: departCost(vInfD, G * m.M1, m.R1),
    captureCost: captureCost(vInfA, G * m.M2, 1.3 * m.R2),
  };
}

/** Hohmann windows predicted by the player's model between t0 and t1. */
export function predictedWindows(m: PlayerModel, t0: number, t1: number) {
  const { lead } = hohmannFor(m);
  const out: number[] = [];
  const offset = (lead / TAU) * m.S2;
  const k0 = Math.ceil((t0 - m.tOpp + offset) / m.S2);
  for (let k = k0; ; k++) {
    const t = m.tOpp + k * m.S2 - offset;
    if (t > t1) break;
    if (t >= t0) out.push(t);
  }
  return out;
}

/** Best flight time for a given departure, by golden-section search on total cost. */
export function bestTransfer(m: PlayerModel, departTime: number): PlannedTransfer | null {
  const tH = hohmannFor(m).tof;
  let a = 0.45 * tH;
  let b = 1.6 * tH;
  const cost = (tof: number) => planTransfer(m, departTime, tof)?.total ?? Infinity;
  // Coarse scan first: the cost curve can have more than one dip.
  let bestTof = a;
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const tof = a + ((b - a) * i) / 40;
    const c = cost(tof);
    if (c < best) [best, bestTof] = [c, tof];
  }
  const step = (b - a) / 40;
  a = bestTof - step;
  b = bestTof + step;
  const k = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 40; i++) {
    const c = b - k * (b - a);
    const d = a + k * (b - a);
    if (cost(c) < cost(d)) b = d;
    else a = c;
  }
  return planTransfer(m, departTime, 0.5 * (a + b));
}

/**
 * A plausible universe consistent with a player model: used to show the player
 * how their error bars could play out, without ever reading the truth.
 */
export function systemFromModel(m: PlayerModel, template: StarSystem): StarSystem {
  const phaseHome = 0 - (TAU * m.tOpp) / m.P1; // angle zero at tOpp
  return {
    ...template,
    star: { ...template.star, mass: m.Mstar },
    home: { ...template.home, a: m.a1, period: m.P1, phase0: phaseHome, mass: m.M1, radius: m.R1 },
    target: { a: m.a2, period: m.P2, phase0: -(TAU * m.tOpp) / m.P2, mass: m.M2, radius: m.R2 },
    parkingRadius: 1.3 * m.R2,
  };
}

/** Draw a random model from the player's primaries (Gaussian in each primary). */
export function sampleModel(p: Primaries, rng: Rng): PlayerModel | null {
  const s: Primaries = {};
  for (const k of LAUNCH_KEYS) {
    const e = p[k] as Estimate | undefined;
    if (!e) return null;
    s[k] = { value: rng.normal(e.value, e.sigma), sigma: 0, at: e.at };
  }
  return modelFromPrimaries(s);
}
