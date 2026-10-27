// An automatic player. It uses only what the tools would show (true physics
// plus human-scale reading and timing errors), runs the same analysis the
// player does, and flies the resulting plan through the true system.
// The generator uses it to prove each system is solvable.

import { ARCSEC, DAY, DEG, HOUR } from './constants';
import type { Estimate, Primaries } from './chain';
import { oppositions } from './ephemeris';
import { simulateLaunch, type LaunchResult } from './launch';
import {
  horizonDip,
  moonOffset,
  parallaxShift,
  pendulumPeriod,
  siteEastOf,
  starLongitude,
  surfaceGravity,
  targetAngularDiameter,
} from './measure';
import { bestTransfer, modelFromPrimaries, predictedWindows, type PlayerModel } from './planner';
import { makeRng, type Rng } from './rng';
import { localFrame, observerPos, toHorizontal, topocentric } from './sky';
import { generateSystem } from './system';
import { variantOf } from './chapters';
import { nominalFlyby } from './probe';
import type { Difficulty, Site, StarSystem } from './types';
import { norm, sub } from './vec';

export interface BotSkill {
  dipReading: number; // rad, per horizon-dip reading
  tap: number; // s, stopwatch reaction scatter
  lengthReading: number; // m
  lonReading: number; // rad, star position against background stars
  oppositionPick: number; // s, choosing the middle of the retrograde loop
  parallaxReading: number; // rad
  diameterReading: number; // rad
  elongationReading: number; // rad
  moonTiming: number; // s, per moon-period timing
  dopplerRel: number; // relative error of a Doppler speed reading
  repeats: number;
}

export const COMPETENT: BotSkill = {
  dipReading: 0.005 * DEG,
  tap: 0.12,
  lengthReading: 0.002,
  lonReading: 0.03 * DEG,
  oppositionPick: 1.5 * DAY,
  parallaxReading: 0.25 * ARCSEC,
  diameterReading: 0.4 * ARCSEC,
  elongationReading: 2 * ARCSEC,
  moonTiming: 2 * HOUR,
  dopplerRel: 0.004,
  repeats: 6,
};

export const PERFECT: BotSkill = {
  dipReading: 0,
  tap: 0,
  lengthReading: 0,
  lonReading: 0,
  oppositionPick: 0,
  parallaxReading: 0,
  diameterReading: 0,
  elongationReading: 0,
  moonTiming: 0,
  dopplerRel: 0,
  repeats: 3,
};

function summarize(xs: number[], floorRel = 1e-6): Estimate {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  // A careful player quotes the standard error, padded a little for systematics.
  return { value: mean, sigma: Math.max((1.3 * sd) / Math.sqrt(n), Math.abs(mean) * floorRel) };
}

/** Time near t0 when planet 2 is highest in the sky at a site. */
export function transitNear(sys: StarSystem, site: Site, t0: number) {
  const alt = (t: number) => toHorizontal(topocentric(sys, 'target', t, site), localFrame(sys, t, site)).alt;
  let best = t0;
  let bestAlt = -Infinity;
  const day = sys.home.siderealDay;
  for (let i = -48; i <= 48; i++) {
    const t = t0 + (i / 96) * day;
    const a = alt(t);
    if (a > bestAlt) [bestAlt, best] = [a, t];
  }
  let lo = best - day / 96;
  let hi = best + day / 96;
  for (let i = 0; i < 50; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (alt(m1) < alt(m2)) lo = m1;
    else hi = m2;
  }
  return 0.5 * (lo + hi);
}

export interface BotRun {
  primaries: Primaries;
  model: PlayerModel | null;
  departTime?: number;
  result?: LaunchResult;
  readyAt: number;
}

export function botMeasure(sys: StarSystem, skill: BotSkill, rng: Rng): { primaries: Primaries; readyAt: number } {
  const n = skill.repeats;
  const p: Primaries = {};

  // Horizon dip from the summit.
  const h = sys.hillHeight + 1.7;
  const dip = horizonDip(sys.home.radius, h);
  p.R1 = summarize(
    Array.from({ length: n }, () => {
      const th = dip + rng.normal(0, skill.dipReading);
      return (h * Math.cos(th)) / (1 - Math.cos(th));
    }),
  );

  // Pendulum: 2 m string, 4 degree release, 20 swings per trial.
  const g = surfaceGravity(sys);
  const L = 2.0;
  const T = pendulumPeriod(g, L, 4 * DEG);
  p.g = summarize(
    Array.from({ length: n }, () => {
      const N = 20;
      const total = N * T + rng.normal(0, skill.tap) - rng.normal(0, skill.tap);
      const Lm = L + rng.normal(0, skill.lengthReading);
      return (4 * Math.PI ** 2 * Lm * N * N) / (total * total);
    }),
  );

  // Year length from the star's drift against the background stars (11 dusk readings over 60 days).
  const ts: number[] = [];
  const lons: number[] = [];
  let prev = 0;
  let wraps = 0;
  for (let i = 0; i <= 10; i++) {
    const t = (2 + 6 * i) * DAY;
    let lon = starLongitude(sys, t, sys.site) + rng.normal(0, skill.lonReading);
    if (i > 0 && lon + wraps * 2 * Math.PI < prev - Math.PI) wraps++;
    lon += wraps * 2 * Math.PI;
    prev = lon;
    ts.push(t);
    lons.push(lon);
  }
  const fit = linearFit(ts, lons);
  const P1 = (2 * Math.PI) / fit.slope;
  p.P1 = { value: P1, sigma: Math.max(1.3 * P1 * (fit.slopeSigma / fit.slope), P1 * 1e-5) };

  // Two oppositions picked from the middle of the retrograde loops.
  const [o1, o2] = oppositions(sys, 0, sys.lifeSupport);
  const t1 = o1 + rng.normal(0, skill.oppositionPick);
  const t2 = o2 + rng.normal(0, skill.oppositionPick);
  const pickSigma = Math.max(skill.oppositionPick, 0.05 * DAY);
  p.S2 = { value: t2 - t1, sigma: Math.SQRT2 * pickSigma };
  p.tOpp = { value: t2, sigma: pickSigma };

  // Parallax with a rover 3000 km east, measured when planet 2 crosses the midpoint meridian:
  // at opposition, or for an inner planet near greatest elongation (it is lost in the glare at conjunction).
  const B = 3000e3;
  const rover = siteEastOf(sys, sys.site, B);
  const mid = siteEastOf(sys, sys.site, B / 2);
  const tObs = transitNear(sys, mid, sys.features.inner ? o2 + 0.22 * sys.synodic : o2);
  const baseline = norm(sub(observerPos(sys, tObs, sys.site), observerPos(sys, tObs, rover)));
  const pTrue = parallaxShift(sys, tObs, sys.site, rover);
  p.dPar = { ...summarize(Array.from({ length: n }, () => baseline / (pTrue + rng.normal(0, skill.parallaxReading)))), at: tObs };

  // Angular diameter the same night, and the moon's greatest elongation nearest opposition.
  const alpha = targetAngularDiameter(sys, tObs, sys.site);
  p.alpha2 = { ...summarize(Array.from({ length: n }, () => alpha + rng.normal(0, skill.diameterReading))), at: tObs };
  let maxOff = 0;
  let tMax = o2;
  for (let i = -200; i <= 200; i++) {
    const t = o2 + (i / 400) * sys.moon.period;
    const off = Math.abs(moonOffset(sys, t, sys.site));
    if (off > maxOff) [maxOff, tMax] = [off, t];
  }
  p.thetaM = { ...summarize(Array.from({ length: n }, () => maxOff + rng.normal(0, skill.elongationReading))), at: tMax };

  // Moon period: time three orbits.
  p.Pm = summarize(Array.from({ length: n }, () => (3 * sys.moon.period + rng.normal(0, skill.moonTiming)) / 3));

  // No moon (chapter 2): a probe flyby at twice the planet's radius, tracked by Doppler.
  if (!sys.features.moon) {
    const fb = nominalFlyby(sys);
    p.vInf = summarize(Array.from({ length: n }, () => fb.vInf * (1 + rng.normal(0, skill.dopplerRel))));
    p.vPeak = summarize(Array.from({ length: n }, () => fb.vPeak * (1 + rng.normal(0, skill.dopplerRel))));
    p.rPeri = summarize(Array.from({ length: n }, () => fb.rPeri * (1 + rng.normal(0, skill.dopplerRel * 0.75))));
    delete p.thetaM;
    delete p.Pm;
  }

  return { primaries: p, readyAt: o2 + 5 * DAY };
}

export function linearFit(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (x[i] - mx) ** 2;
    sxy += (x[i] - mx) * (y[i] - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let rss = 0;
  for (let i = 0; i < n; i++) rss += (y[i] - intercept - slope * x[i]) ** 2;
  const s2 = n > 2 ? rss / (n - 2) : 0;
  return { slope, intercept, slopeSigma: Math.sqrt(s2 / sxx) };
}

export function botPlay(sys: StarSystem, skill: BotSkill, seed = 1): BotRun {
  const rng = makeRng(seed);
  const { primaries, readyAt } = botMeasure(sys, skill, rng);
  const model = modelFromPrimaries(primaries, variantOf(sys.features));
  if (!model) return { primaries, model, readyAt };
  const windows = predictedWindows(model, readyAt, sys.lifeSupport);
  if (!windows.length) return { primaries, model, readyAt };
  const plan = bestTransfer(model, windows[0]);
  if (!plan) return { primaries, model, readyAt, departTime: windows[0] };
  return { primaries, model, readyAt, departTime: windows[0], result: simulateLaunch(sys, plan.plan) };
}

/**
 * Generate a system the bot can solve with a competent skill level. Seeds the
 * bot cannot solve are skipped (deterministically), and the count is reported.
 */
export function generateSolvableSystem(seed: number, difficulty: Difficulty = 'navigator', chapter = 1) {
  for (let k = 0; k < 50; k++) {
    const s = (seed + k * 7919) >>> 0;
    const sys = generateSystem(s, difficulty, chapter);
    let ok = true;
    for (let trial = 0; trial < 3 && ok; trial++) {
      const run = botPlay(sys, COMPETENT, s * 31 + trial);
      ok = run.result?.outcome === 'success';
    }
    if (ok) return { system: sys, rejected: k };
  }
  throw new Error(`No solvable system near seed ${seed}`);
}
