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
import { planFlyby } from './flyby';

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
  /** Chapter 7: the giant, from the player's own measurements. */
  giant?: { a: number; P: number; tOpp: number; M: number };
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
    ...(variant === 'slingshot' && d.aG && d.Mg && p.Sg && p.tOppG
      ? { giant: { a: d.aG.value, P: 1 / (1 / p.P1!.value - 1 / p.Sg.value), tOpp: p.tOppG.value, M: d.Mg.value } }
      : {}),
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

/** The giant's position and velocity in the player's model (circular; at tOppG it lines up with us). */
export function giantState(m: PlayerModel, t: number): [Vec3, Vec3] {
  const g = m.giant!;
  const th = (TAU * (g.tOpp - m.tOpp)) / m.P1 + (TAU * (t - g.tOpp)) / g.P;
  const v = (TAU * g.a) / g.P;
  return [
    [g.a * Math.cos(th), g.a * Math.sin(th), 0],
    [-v * Math.sin(th), v * Math.cos(th), 0],
  ];
}

/**
 * How close ECHO will dare to pass: twice the giant's radius as estimated from
 * the measured mass, for a gas giant's density (about 1300 kg/m³).
 */
export const giantRpMin = (M: number) => 2 * Math.cbrt((3 * M) / (4 * Math.PI * 1300));

/** A two-leg route in the player's model: home → giant (tof1) → target (tof2). */
export function planSlingshot(m: PlayerModel, t0: number, tof1: number, tof2: number): PlannedTransfer | null {
  const mu = G * m.Mstar;
  const r1 = posAt(m.a1, m.P1, m, t0);
  const v1 = velAt(m.a1, m.P1, m, t0);
  const [rg, vg] = giantState(m, t0 + tof1);
  const leg1 = lambert(r1, rg, tof1, mu);
  if (!leg1) return null;
  const [r2, v2] = targetState(m, t0 + tof1 + tof2);
  const leg2 = lambert(rg, r2, tof2, mu);
  if (!leg2) return null;
  const vInf = sub(leg1[0], v1);
  const fb = planFlyby(sub(leg1[1], vg), sub(leg2[0], vg), G * m.giant!.M, giantRpMin(m.giant!.M));
  const vInfArr = norm(sub(leg2[1], v2));
  const rHat = r1.map((x) => x / norm(r1)) as Vec3;
  const pHat = v1.map((x) => x / norm(v1)) as Vec3;
  const dep = departCost(norm(vInf), G * m.M1, m.R1);
  const cap = captureCost(vInfArr, G * m.M2, 1.3 * m.R2);
  const { cost: fbCost, ...flyby } = fb;
  return {
    plan: {
      departTime: t0,
      tof: tof1 + tof2,
      vInfRadial: dot(vInf, rHat),
      vInfPrograde: dot(vInf, pHat),
      flyby: { ...flyby, tof1, muModel: G * m.giant!.M, rpMin: giantRpMin(m.giant!.M) },
    },
    departCost: dep + fbCost,
    captureCost: cap,
    total: dep + fbCost + cap,
    vInfDepart: norm(vInf),
    vInfArrive: vInfArr,
  };
}

/** Rough flight-time ranges for the two legs (Hohmann-like times in the player's model). */
function legRanges(m: PlayerModel) {
  const mu = G * m.Mstar;
  const t1 = hohmannTof(m.a1, m.giant!.a, mu);
  const t2 = hohmannTof(m.giant!.a, m.a2, mu);
  return { t1, t2 };
}

/** Best slingshot route leaving at t0: grid over both flight times, then refined. */
export function bestSlingshot(m: PlayerModel, t0: number, coarse = 8, refine = true): PlannedTransfer | null {
  const { t1, t2 } = legRanges(m);
  let best: PlannedTransfer | null = null;
  let bi = 0;
  let bj = 0;
  const f1 = (i: number) => t1 * (0.5 + (0.9 * i) / coarse);
  const f2 = (j: number) => t2 * (0.35 + (1.0 * j) / coarse);
  for (let i = 0; i <= coarse; i++)
    for (let j = 0; j <= coarse; j++) {
      const p = planSlingshot(m, t0, f1(i), f2(j));
      if (p && (!best || p.total < best.total)) [best, bi, bj] = [p, i, j];
    }
  if (!best || !refine) return best;
  // Pattern search around the best grid point.
  let a = f1(bi);
  let b = f2(bj);
  let h1 = (0.9 * t1) / coarse;
  let h2 = (1.0 * t2) / coarse;
  for (let it = 0; it < 30 && (h1 > 3600 || h2 > 3600); it++) {
    let moved = false;
    for (const [da, db] of [[h1, 0], [-h1, 0], [0, h2], [0, -h2]]) {
      const p = planSlingshot(m, t0, a + da, b + db);
      if (p && p.total < best.total) {
        best = p;
        a += da;
        b += db;
        moved = true;
        break;
      }
    }
    if (!moved) {
      h1 /= 2;
      h2 /= 2;
    }
  }
  return best;
}

const slingCache = new Map<string, number[]>();
const DAY_S = 86400;

/** Slingshot windows in the player's model: dips of the best route cost over departure dates. */
function slingshotWindows(m: PlayerModel, t1: number): number[] {
  // Searched from day 0 on a fixed grid (so a window doesn't shift or vanish as the
  // clock moves on), up to the end asked for, rounded so it caches: it is the slow part.
  const a = 0;
  const b = Math.ceil(t1 / (100 * DAY_S)) * 100 * DAY_S;
  const key = [m.P1, m.P2, m.a1, m.a2, m.Mstar, m.tOpp, m.M1, m.R1, m.M2, m.R2, m.giant!.a, m.giant!.P, m.giant!.tOpp, m.giant!.M, a, b].join(',');
  let w = slingCache.get(key);
  if (w) return w;
  const cost = (t: number) => bestSlingshot(m, t, 4, false)?.total ?? Infinity;
  w = costMinima(cost, Math.max(0, a), b, m.P1 / 30, m.P1 / 6, 1.15);
  if (slingCache.size > 100) slingCache.clear();
  slingCache.set(key, w);
  return w;
}

/** Hohmann windows predicted by the player's model between t0 and t1. */
export function predictedWindows(m: PlayerModel, t0: number, t1: number) {
  if (m.ecc) return ellipseWindows(m).filter((t) => t >= t0 && t <= t1);
  if (m.giant) return slingshotWindows(m, t1).filter((t) => t >= t0 && t <= t1);
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
  if (m.giant) return bestSlingshot(m, departTime);
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
    // The giant as the player measured it (never the real one).
    giant:
      m.giant && template.giant
        ? {
            ...template.giant,
            a: m.giant.a,
            period: m.giant.P,
            phase0: (TAU * (m.giant.tOpp - m.tOpp)) / m.P1 - (TAU * m.giant.tOpp) / m.giant.P,
            mass: m.giant.M,
            radius: giantRpMin(m.giant.M) / 2,
          }
        : undefined,
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
