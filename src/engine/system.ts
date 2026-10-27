// Procedural star-system generator. Every system is physically sensible and,
// by construction, has at least one Hohmann window after the player has had
// time to observe two oppositions of the blue planet.

import { AU, DAY, DEG, G, HOUR, L_SUN, M_EARTH, M_SUN, R_SUN, T_SUN, TAU } from './constants';
import { meanLonForTrue, oppositions, orbitAngle, planetPos, planetVel, trueLongitude } from './ephemeris';
import { cheapestAt, costMinima } from './windows';
import { lambert } from './orbits';
import { norm, sub } from './vec';
import {
  captureCost,
  departCost,
  hohmannTof,
  hohmannVInfArrive,
  hohmannVInfDepart,
} from './orbits';
import { makeRng } from './rng';
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
    return {
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
  }
  throw new Error(`No valid system for seed ${seed}`);
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
