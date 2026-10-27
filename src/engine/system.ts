// Procedural star-system generator. Every system is physically sensible and,
// by construction, has at least one Hohmann window after the player has had
// time to observe two oppositions of the blue planet.

import { AU, DAY, DEG, G, HOUR, L_SUN, M_EARTH, M_SUN, R_SUN, T_SUN, TAU } from './constants';
import { meanLonForTrue, oppositions, oppositionsOf, orbitAngle, planetPos, planetVel, trueLongitude } from './ephemeris';
import { cheapestAt, costMinima } from './windows';
import { lambert, propagate } from './orbits';
import { add, norm, scale, sub, unit, type Vec3 } from './vec';
import {
  captureCost,
  departCost,
  hohmannTof,
  hohmannVInfArrive,
  hohmannVInfDepart,
} from './orbits';
import { makeRng, type Rng } from './rng';
import { featuresOf } from './chapters';
import type { Difficulty, StarSystem } from './types';

const SIGMA_SB = 5.670374419e-8;

export interface DifficultyRules {
  /** Fuel allowance above the ideal Hohmann cost, as a fraction of (vInfDep + vInfArr). */
  fuelAllowance: number;
  /** Extra life support after the first "fully measurable" window, in synodic periods. */
  lifeSlack: [number, number];
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  stargazer: { fuelAllowance: 1.0, lifeSlack: [0.6, 0.85] },
  cadet: { fuelAllowance: 0.6, lifeSlack: [0.35, 0.5] },
  navigator: { fuelAllowance: 0.35, lifeSlack: [0.2, 0.3] },
  astronomer: { fuelAllowance: 0.2, lifeSlack: [0.1, 0.18] },
  legend: { fuelAllowance: 0.15, lifeSlack: [0.08, 0.14] },
};

/** The real Solar System, circular-orbit version (NASA fact sheets). */
export const REAL = {
  mars: { a: 1.52368 * AU, mass: 0.10745 * M_EARTH, radius: 3389.5e3, siderealDay: 24.6229 * HOUR, obliquity: 25.19 * DEG },
  earth: { a: 1.0 * AU, mass: M_EARTH, radius: 6371e3 },
  moon: { a: 384400e3, radius: 1737.4e3 },
  /** Jezero crater, where Mira made her last camp. */
  siteLat: 18.4 * DEG,
};

const radiusFromDensity = (mass: number, rho: number) => Math.cbrt((3 * mass) / (4 * Math.PI * rho));

export function generateSystem(seed: number, difficulty: Difficulty = 'navigator', chapter = 1): StarSystem {
  const features = featuresOf(chapter);
  // Chapter 1 keeps the original seeds; other chapters mix the chapter in.
  const rng = makeRng(chapter === 1 ? seed : (seed ^ (chapter * 0x9e3779b1)) >>> 0);
  const rules = DIFFICULTY[difficulty];

  const real = !!features.real;
  for (let attempt = 0; attempt < 1000; attempt++) {
    // Star: main-sequence-ish scalings.
    const locked = !!features.locked;
    // A red dwarf (chapter 6): small, cool and dim, so the temperate zone hugs it.
    const mSol = real ? 1 : locked ? rng.range(0.38, 0.52) : rng.range(0.72, 1.12);
    const star = {
      mass: mSol * M_SUN,
      radius: (locked ? mSol ** 0.95 : mSol ** 0.85) * R_SUN,
      temperature: locked ? rng.range(3300, 3800) : T_SUN * mSol ** 0.5,
      luminosity: 0,
    };
    star.luminosity = 4 * Math.PI * star.radius ** 2 * SIGMA_SB * star.temperature ** 4;
    const mu = G * star.mass;

    // Home planet in the temperate zone.
    const a1 = real ? REAL.mars.a : Math.sqrt(star.luminosity / L_SUN) * rng.range(0.92, 1.12) * AU;
    const P1 = TAU * Math.sqrt(a1 ** 3 / mu);
    if (!real && !locked && (P1 < 120 * DAY || P1 > 320 * DAY)) continue;
    if (locked && (P1 < 18 * DAY || P1 > 70 * DAY)) continue;

    const ratio = features.inner ? rng.range(0.55, 0.78) : rng.range(1.35, 1.95);
    const a2 = real ? REAL.earth.a : ratio * a1;
    const P2 = TAU * Math.sqrt(a2 ** 3 / mu);
    const synodic = 1 / Math.abs(1 / P1 - 1 / P2);

    const m1 = real ? REAL.mars.mass : rng.range(0.6, 1.7) * M_EARTH;
    const r1 = real ? REAL.mars.radius : radiusFromDensity(m1, rng.range(4300, 6100));
    const m2 = real ? REAL.earth.mass : rng.range(0.4, 1.4) * M_EARTH;
    const r2 = real ? REAL.earth.radius : radiusFromDensity(m2, rng.range(3800, 5600));

    // Around a red dwarf everything is quick: a tighter moon, so the planet's distance barely changes during one moon orbit.
    const moonA = real ? REAL.moon.a : rng.range(18, locked ? 28 : 55) * r2;
    const moonP = TAU * Math.sqrt(moonA ** 3 / (G * m2));

    // Phases: the first opposition happens a little after landing.
    const firstOpposition = rng.range(0.1, 0.25) * synodic;
    const home = {
      a: a1,
      period: P1,
      phase0: rng.range(0, TAU),
      mass: m1,
      radius: r1,
      siderealDay: real ? REAL.mars.siderealDay : rng.range(17, 36) * HOUR,
      rotPhase0: rng.range(0, TAU),
      obliquity: real ? REAL.mars.obliquity : rng.range(6, 26) * DEG,
    };
    // At t = firstOpposition both planets share a heliocentric longitude.
    let phase2 = orbitAngle(home, firstOpposition) - (TAU * firstOpposition) / P2;
    const target: StarSystem['target'] = { a: a2, period: P2, phase0: phase2, mass: m2, radius: r2 };
    if (features.ellipse) {
      // An eccentric orbit: place the planet so its TRUE longitude matches ours at the first opposition.
      const e = rng.range(...features.ellipse);
      const peri = rng.range(0, TAU);
      phase2 = meanLonForTrue(e, peri, orbitAngle(home, firstOpposition)) - (TAU * firstOpposition) / P2;
      Object.assign(target, { e, peri, phase0: phase2 });
    }

    const tof = hohmannTof(a1, a2, mu);
    // Angle the target must lead us by at departure, in (-pi, pi].
    let lead = Math.PI - (TAU * tof) / P2;
    lead = Math.atan2(Math.sin(lead), Math.cos(lead));
    const vInfDepart = Math.abs(hohmannVInfDepart(a1, a2, mu));
    const vInfArrive = Math.abs(hohmannVInfArrive(a1, a2, mu));
    const parkingRadius = 1.3 * r2;
    const hohmann = {
      tof,
      leadAngle: lead,
      vInfDepart,
      vInfArrive,
      departCost: departCost(vInfDepart, G * m1, r1),
      captureCost: captureCost(vInfArrive, G * m2, parkingRadius),
    };

    // Window k happens when the target's lead angle equals `lead`. For an outer
    // target the lead shrinks over time, lead(t) = (firstOpposition - t)·2π/S;
    // for an inner one it grows, lead(t) = (t - firstOpposition)·2π/S (mod 2π).
    const windowAt = (k: number) =>
      features.inner
        ? firstOpposition + k * synodic + ((((lead / TAU) % 1) + 1) % 1) * synodic
        : firstOpposition + k * synodic - (lead / TAU) * synodic;
    let windows: number[] = [];
    let lifeSupport: number;
    let fuelDv: number;
    if (!target.e) {
      const secondOpposition = firstOpposition + synodic;
      let k = 0;
      while (windowAt(k) < secondOpposition + 10 * DAY) k++;
      const measuredWindow = windowAt(k);
      lifeSupport = measuredWindow + rng.range(...rules.lifeSlack) * synodic;
      for (let j = 0; windowAt(j) <= lifeSupport; j++) if (windowAt(j) > 0) windows.push(windowAt(j));
      fuelDv = hohmann.departCost + hohmann.captureCost + rules.fuelAllowance * (vInfDepart + vInfArrive);
    } else {
      // Eccentric target: windows are uneven, so find them as the dips in the real transfer cost.
      const H = { pos: (t: number) => planetPos(home, t), vel: (t: number) => planetVel(home, t) };
      const T = { pos: (t: number) => planetPos(target, t), vel: (t: number) => planetVel(target, t) };
      const tmp = { home, target, synodic, firstOpposition, lifeSupport: 3 * synodic } as unknown as StarSystem;
      const secondOpposition = oppositions(tmp, firstOpposition + 0.5 * synodic, firstOpposition + 1.6 * synodic)[0];
      if (secondOpposition === undefined) continue;
      const lo = 0.55 * tof;
      const hi = 1.5 * tof;
      const cost = (t: number) => cheapestAt(H, T, mu, m1, r1, m2, parkingRadius, t, lo, hi).cost;
      const minima = costMinima(cost, DAY, secondOpposition + 2.5 * synodic, synodic / 40);
      // The window we expect the player to use: the cheapest within a synodic period after the second opposition.
      const after = minima.filter((t) => t > secondOpposition + 10 * DAY && t < secondOpposition + 10 * DAY + 1.2 * synodic);
      const measuredWindow = after.length ? after.reduce((b, t) => (cost(t) < cost(b) ? t : b)) : undefined;
      if (measuredWindow === undefined) continue;
      lifeSupport = measuredWindow + rng.range(...rules.lifeSlack) * synodic;
      windows = minima.filter((t) => t <= lifeSupport);
      // The real cheapest transfer at the window we expect the player to use.
      const best = cheapestAt(H, T, mu, m1, r1, m2, parkingRadius, measuredWindow, lo, hi, 80);
      const sol = lambert(H.pos(measuredWindow), T.pos(measuredWindow + best.tof), best.tof, mu)!;
      const vD = norm(sub(sol[0], H.vel(measuredWindow)));
      const vA = norm(sub(sol[1], T.vel(measuredWindow + best.tof)));
      let lead2 = trueLongitude(target, measuredWindow) - orbitAngle(home, measuredWindow);
      lead2 = Math.atan2(Math.sin(lead2), Math.cos(lead2));
      Object.assign(hohmann, {
        tof: best.tof,
        leadAngle: lead2,
        vInfDepart: vD,
        vInfArrive: vA,
        departCost: departCost(vD, G * m1, r1),
        captureCost: captureCost(vA, G * m2, parkingRadius),
      });
      fuelDv = best.cost + rules.fuelAllowance * (vD + vA);
    }

    // Drawn in the same order as always, so a seed keeps its system (saves, daily challenge).
    const moonPhase = rng.range(0, TAU);
    const moonRadius = real ? REAL.moon.radius : r2 * rng.range(0.15, 0.3);
    const siteLat = real ? REAL.siteLat : rng.range(8, 36) * DEG;
    if (locked) {
      // Tidally locked: one turn per orbit, no tilt. Fix the star's hour angle so it
      // stays 20° below the horizon — the camp is just inside the night side, forever,
      // with the point opposite the star 20° up in the east.
      home.siderealDay = P1;
      home.obliquity = 0;
      const H = Math.acos(Math.sin(-20 * DEG) / Math.cos(siteLat));
      home.rotPhase0 = H + home.phase0 + Math.PI;
    }
    const out: StarSystem = {
      seed,
      difficulty,
      chapter,
      features,
      star,
      home,
      target,
      moon: { a: moonA, period: moonP, phase0: moonPhase, radius: moonRadius },
      site: { lat: siteLat, lon: 0 },
      hillHeight: Math.round(rng.range(700, 1500) / 10) * 10,
      synodic,
      firstOpposition,
      hohmann,
      windows,
      parkingRadius,
      fuelDv,
      lifeSupport,
    };
    if (features.slingshot) {
      const sl = makeSlingshot(out, rng, rules);
      if (!sl) continue;
      return sl;
    }
    return out;
  }
  throw new Error(`No valid system for seed ${seed}`);
}

/**
 * Chapter 7: put a giant between us and a far-away target, arranged so that a
 * real gravity-assist route opens once the player has had time to measure both
 * planets — and so that the direct route costs more fuel than the ship carries.
 * Built forwards from the route itself: depart, coast to the giant's orbit and
 * put the giant there, fly past it, coast on and put the target where we cross its orbit.
 */
/** Test hook: reports each candidate's cost ratios against the direct route. */
export let slingDebug: ((sling: number, fuel: number) => void) | null = null;
export const setSlingDebug = (f: typeof slingDebug) => (slingDebug = f);

function makeSlingshot(base: StarSystem, rng: Rng, rules: DifficultyRules): StarSystem | null {
  const mu = G * base.star.mass;
  const { home } = base;
  const a1 = home.a;
  const P1 = home.period;
  const aT = rng.range(4.5, 6.5) * a1;
  const PT = TAU * Math.sqrt(aT ** 3 / mu);
  const aG = rng.range(1.7, 2.3) * a1;
  const PG = TAU * Math.sqrt(aG ** 3 / mu);
  const mG = rng.range(200, 600) * M_EARTH;
  const rG = radiusFromDensity(mG, rng.range(900, 1500));
  const moonGa = rng.range(25, 60) * rG;
  const giantMoon = { a: moonGa, period: TAU * Math.sqrt(moonGa ** 3 / (G * mG)), phase0: rng.range(0, TAU), radius: 0.03 * rG };
  const synT = 1 / Math.abs(1 / P1 - 1 / PT);
  const synG = 1 / Math.abs(1 / P1 - 1 / PG);
  // Depart once both planets have shown two oppositions each.
  const tDep = 2 * Math.max(synT, synG) + rng.range(15, 60) * DAY;
  const crossing = (r: Vec3, v: Vec3, rad: number, span: number) => {
    // First time the coast reaches radius `rad` going outwards.
    const n = 160;
    let prev = 0;
    for (let i = 1; i <= n; i++) {
      const t = (span * i) / n;
      if (norm(propagate(r, v, t, mu)[0]) >= rad) {
        let lo = prev;
        let hi = t;
        for (let k = 0; k < 40; k++) {
          const m = 0.5 * (lo + hi);
          if (norm(propagate(r, v, m, mu)[0]) >= rad) hi = m;
          else lo = m;
        }
        return 0.5 * (lo + hi);
      }
      prev = t;
    }
    return null;
  };
  const r0 = planetPos(home, tDep);
  const vh = planetVel(home, tDep);
  const muG = G * mG;
  const rot = (v: Vec3, th: number): Vec3 => [v[0] * Math.cos(th) - v[1] * Math.sin(th), v[0] * Math.sin(th) + v[1] * Math.cos(th), 0];
  // Search the departure ellipse and the flyby (closest approach, turn direction)
  // for the cheapest route, the way a mission designer would.
  let best: { cost: number; vInfDep: number; tof1: number; tof2: number; lonG: number; t1: number; lonT: number; t2: number; vInfArr: number } | null = null;
  for (const qf of [1.03, 1.12, 1.25, 1.45]) {
    const Q = qf * aG;
    const vPeri = Math.sqrt((mu * 2 * Q) / (a1 * (a1 + Q)));
    const v0 = add(vh, scale(unit(vh), vPeri - norm(vh)));
    const vInfDep = vPeri - norm(vh);
    const tof1 = crossing(r0, v0, aG, P1 * (Q / a1) ** 1.5);
    if (tof1 === null) continue;
    const t1 = tDep + tof1;
    const [rS1, vS1] = propagate(r0, v0, tof1, mu);
    const lonG = Math.atan2(rS1[1], rS1[0]);
    const vG = scale([-Math.sin(lonG), Math.cos(lonG), 0], Math.sqrt(mu / aG));
    const vInfIn = sub(vS1, vG);
    for (const rpf of [1.6, 2.2, 3, 4.5, 7, 11, 18, 30]) {
      const turn = 2 * Math.asin(1 / (1 + (rpf * rG * norm(vInfIn) ** 2) / muG));
      for (const sgn of [1, -1]) {
        const vOut = add(vG, rot(vInfIn, sgn * turn));
        const tof2 = crossing(rS1, vOut, aT, 1.5 * PT);
        if (tof2 === null) continue;
        const [rS2, vS2] = propagate(rS1, vOut, tof2, mu);
        const lonT = Math.atan2(rS2[1], rS2[0]);
        // The target's circular velocity where we meet it.
        const vT = scale([-Math.sin(lonT), Math.cos(lonT), 0], Math.sqrt(mu / aT));
        const vInfArr = norm(sub(vS2, vT));
        const cost = departCost(vInfDep, G * home.mass, home.radius) + captureCost(vInfArr, G * base.target.mass, base.parkingRadius);
        if (!best || cost < best.cost) best = { cost, vInfDep, tof1, tof2, lonG, t1, lonT, t2: t1 + tof2, vInfArr };
      }
    }
  }
  if (!best) return null;
  const { vInfDep, tof1, tof2, lonG, t1, lonT, t2, vInfArr } = best;
  const giant = { a: aG, period: PG, phase0: lonG - (TAU * t1) / PG, mass: mG, radius: rG, moon: giantMoon };
  const target = { ...base.target, a: aT, period: PT, phase0: lonT - (TAU * t2) / PT };
  const dep = departCost(vInfDep, G * home.mass, home.radius);
  const cap = captureCost(vInfArr, G * target.mass, base.parkingRadius);
  const sling = dep + cap;
  // The direct route must be out of reach.
  const dHoh = departCost(Math.abs(hohmannVInfDepart(a1, aT, mu)), G * home.mass, home.radius) + captureCost(Math.abs(hohmannVInfArrive(a1, aT, mu)), G * target.mass, base.parkingRadius);
  // A larger margin than usual (two legs, two corrections, and the giant's position after
  // a long extrapolation), but always short of what the direct route would need.
  const want = rules.fuelAllowance * (vInfDep + vInfArr);
  const margin = Math.min(1.6 * want, 0.95 * dHoh - sling);
  slingDebug?.(sling / dHoh, margin / want);
  // In the easy modes the full margin matters more than the plot: the slingshot is then
  // simply the cheaper route, not the only one.
  const easy = rules.fuelAllowance >= DIFFICULTY.cadet.fuelAllowance;
  if (margin < 0.7 * want && !easy) return null;
  const fuelDv = sling + (easy ? want : margin);
  const firstOpposition = oppositionsOf(home, target, 0, 2 * synT)[0];
  const lifeSupport = tDep + rng.range(...rules.lifeSlack) * synT;
  let lead = lonT - (TAU * (t2 - tDep)) / PT - orbitAngle(home, tDep);
  lead = Math.atan2(Math.sin(lead), Math.cos(lead));
  return {
    ...base,
    target,
    giant,
    synodic: synT,
    firstOpposition,
    hohmann: { tof: tof1 + tof2, leadAngle: lead, vInfDepart: vInfDep, vInfArrive: vInfArr, departCost: dep, captureCost: cap },
    windows: [tDep],
    fuelDv,
    lifeSupport,
  };
}

export const describeSystem = (s: StarSystem) => ({
  starMass_Msun: s.star.mass / M_SUN,
  a1_AU: s.home.a / AU,
  a2_AU: s.target.a / AU,
  P1_days: s.home.period / DAY,
  P2_days: s.target.period / DAY,
  synodic_days: s.synodic / DAY,
  M1_Mearth: s.home.mass / M_EARTH,
  M2_Mearth: s.target.mass / M_EARTH,
  R1_km: s.home.radius / 1000,
  R2_km: s.target.radius / 1000,
  g1: (G * s.home.mass) / s.home.radius ** 2,
  moonP_days: s.moon.period / DAY,
  day_hours: s.home.siderealDay / HOUR,
  tof_days: s.hohmann.tof / DAY,
  lead_deg: s.hohmann.leadAngle / DEG,
  windows_days: s.windows.map((w) => w / DAY),
  lifeSupport_days: s.lifeSupport / DAY,
  fuel_kms: s.fuelDv / 1000,
});
