// Launch planning from the player's own numbers. Nothing here reads the true
// system: the plan is only as good as the measurements behind it.

import { G, TAU } from './constants';
import type { Estimate, Primaries, PrimaryKey } from './chain';
import { deriveAll, keysFor, type ChainVariant } from './chain';
import type { LaunchPlan } from './launch';
import { captureCost, departCost, hohmannTof, hohmannVInfArrive, hohmannVInfDepart, lambert } from './orbits';
import type { Rng } from './rng';
import type { StarSystem } from './types';
import { dot, norm, sub, type Vec3 } from './vec';
import { keplerState, meanLonForTrue } from './ephemeris';
import { cheapestAt, costMinima } from './windows';

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
  /** The target orbits inside ours. */
  inner: boolean;
  /** Chapter 4: the target's eccentricity and perihelion direction (model frame: our planet at angle 0 at tOpp). */
  ecc?: number;
  peri?: number;
}

export const LAUNCH_KEYS: PrimaryKey[] = keysFor('standard');

export function modelFromPrimaries(p: Primaries, variant: ChainVariant = 'standard'): PlayerModel | null {
  const d = deriveAll(p, variant);
  if (!d.P2 || !d.a1 || !d.a2 || !d.Mstar || !d.M1 || !d.M2 || !d.R2 || !p.tOpp || !p.R1) return null;
  return {
    P1: p.P1!.value,
    P2: d.P2.value,
    // An ellipse has no fixed synodic period; use the mean one.
    S2: p.S2?.value ?? 1 / Math.abs(1 / p.P1!.value - 1 / d.P2.value),
    a1: d.a1.value,
    a2: d.a2.value,
    Mstar: d.Mstar.value,
    tOpp: p.tOpp.value,
    M1: d.M1.value,
    R1: p.R1.value,
    M2: d.M2.value,
    R2: d.R2.value,
    inner: variant === 'inner',
    ...(variant === 'ellipse' && p.ecc && p.wPeri ? { ecc: p.ecc.value, peri: p.wPeri.value } : {}),
  };
}

/** The target's position and velocity in the player's model (an ellipse when the model has one). */
export function targetState(m: PlayerModel, t: number): [Vec3, Vec3] {
  if (!m.ecc) return [posAt(m.a2, m.P2, m, t), velAt(m.a2, m.P2, m, t)];
  const m0 = meanLonForTrue(m.ecc, m.peri ?? 0, 0);
  return keplerState(m.a2, m.P2, m.ecc, m.peri ?? 0, m0 + (TAU * (t - m.tOpp)) / m.P2);
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
  const [r2, v2] = targetState(m, departTime + tof);
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
  const lead0 = Math.PI - (TAU * tof) / m.P2;
  const lead = Math.atan2(Math.sin(lead0), Math.cos(lead0));
  const vInfD = Math.abs(hohmannVInfDepart(m.a1, m.a2, mu));
  const vInfA = Math.abs(hohmannVInfArrive(m.a1, m.a2, mu));
  return {
    tof,
    lead,
    vInfDepart: vInfD,
    vInfArrive: vInfA,
    departCost: departCost(vInfD, G * m.M1, m.R1),
    captureCost: captureCost(vInfA, G * m.M2, 1.3 * m.R2),
  };
}

const ellipseCache = new Map<string, number[]>();

/**
 * Uneven windows: the dips of the transfer cost in the player's own ellipse.
 * Searched once per model over the whole expedition (it is the slow part), then cached.
 */
function ellipseWindows(m: PlayerModel): number[] {
  const key = [m.P1, m.P2, m.a1, m.a2, m.Mstar, m.tOpp, m.M1, m.R1, m.M2, m.R2, m.ecc, m.peri].join(',');
  let w = ellipseCache.get(key);
  if (w) return w;
  const tof = hohmannFor(m).tof;
  const H = { pos: (t: number) => posAt(m.a1, m.P1, m, t), vel: (t: number) => velAt(m.a1, m.P1, m, t) };
  const T = { pos: (t: number) => targetState(m, t)[0], vel: (t: number) => targetState(m, t)[1] };
  const cost = (t: number) => cheapestAt(H, T, G * m.Mstar, m.M1, m.R1, m.M2, 1.3 * m.R2, t, 0.55 * tof, 1.5 * tof).cost;
  w = costMinima(cost, Math.max(0, m.tOpp - 2 * m.S2), m.tOpp + 4 * m.S2, m.S2 / 40);
  if (ellipseCache.size > 200) ellipseCache.clear();
  ellipseCache.set(key, w);
  return w;
}

/** Hohmann windows predicted by the player's model between t0 and t1. */
export function predictedWindows(m: PlayerModel, t0: number, t1: number) {
  if (m.ecc) return ellipseWindows(m).filter((t) => t >= t0 && t <= t1);
  const { lead } = hohmannFor(m);
  const out: number[] = [];
  // Outer target: the lead shrinks with time; inner target: it grows.
  const offset = m.inner ? -((((lead / TAU) % 1) + 1) % 1) * m.S2 : (lead / TAU) * m.S2;
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
    target: m.ecc
      ? { a: m.a2, period: m.P2, phase0: meanLonForTrue(m.ecc, m.peri ?? 0, 0) - (TAU * m.tOpp) / m.P2, mass: m.M2, radius: m.R2, e: m.ecc, peri: m.peri ?? 0 }
      : { a: m.a2, period: m.P2, phase0: -(TAU * m.tOpp) / m.P2, mass: m.M2, radius: m.R2 },
    parkingRadius: 1.3 * m.R2,
  };
}

/** Draw a random model from the player's primaries (Gaussian in each primary). */
export function sampleModel(p: Primaries, rng: Rng, variant: ChainVariant = 'standard'): PlayerModel | null {
  const s: Primaries = {};
  for (const k of keysFor(variant)) {
    const e = p[k] as Estimate | undefined;
    if (!e) return null;
    s[k] = { value: rng.normal(e.value, e.sigma), sigma: 0, at: e.at };
  }
  return modelFromPrimaries(s, variant);
}
