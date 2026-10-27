// Procedural star-system generator. Every system is physically sensible and,
// by construction, has at least one Hohmann window after the player has had
// time to observe two oppositions of the blue planet.

import { AU, DAY, DEG, G, HOUR, L_SUN, M_EARTH, M_SUN, R_SUN, T_SUN, TAU } from './constants';
import { orbitAngle } from './ephemeris';
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

const radiusFromDensity = (mass: number, rho: number) => Math.cbrt((3 * mass) / (4 * Math.PI * rho));

export function generateSystem(seed: number, difficulty: Difficulty = 'navigator', chapter = 1): StarSystem {
  const features = featuresOf(chapter);
  // Chapter 1 keeps the original seeds; other chapters mix the chapter in.
  const rng = makeRng(chapter === 1 ? seed : (seed ^ (chapter * 0x9e3779b1)) >>> 0);
  const rules = DIFFICULTY[difficulty];

  for (let attempt = 0; attempt < 1000; attempt++) {
    // Star: main-sequence-ish scalings.
    const mSol = rng.range(0.72, 1.12);
    const star = {
      mass: mSol * M_SUN,
      radius: mSol ** 0.85 * R_SUN,
      temperature: T_SUN * mSol ** 0.5,
      luminosity: 0,
    };
    star.luminosity = 4 * Math.PI * star.radius ** 2 * SIGMA_SB * star.temperature ** 4;
    const mu = G * star.mass;

    // Home planet in the temperate zone.
    const a1 = Math.sqrt(star.luminosity / L_SUN) * rng.range(0.92, 1.12) * AU;
    const P1 = TAU * Math.sqrt(a1 ** 3 / mu);
    if (P1 < 120 * DAY || P1 > 320 * DAY) continue;

    const ratio = features.inner ? rng.range(0.55, 0.78) : rng.range(1.35, 1.95);
    const a2 = ratio * a1;
    const P2 = TAU * Math.sqrt(a2 ** 3 / mu);
    const synodic = 1 / Math.abs(1 / P1 - 1 / P2);

    const m1 = rng.range(0.6, 1.7) * M_EARTH;
    const r1 = radiusFromDensity(m1, rng.range(4300, 6100));
    const m2 = rng.range(0.4, 1.4) * M_EARTH;
    const r2 = radiusFromDensity(m2, rng.range(3800, 5600));

    const moonA = rng.range(18, 55) * r2;
    const moonP = TAU * Math.sqrt(moonA ** 3 / (G * m2));

    // Phases: the first opposition happens a little after landing.
    const firstOpposition = rng.range(0.1, 0.25) * synodic;
    const home = {
      a: a1,
      period: P1,
      phase0: rng.range(0, TAU),
      mass: m1,
      radius: r1,
      siderealDay: rng.range(17, 36) * HOUR,
      rotPhase0: rng.range(0, TAU),
      obliquity: rng.range(6, 26) * DEG,
    };
    // At t = firstOpposition both planets share a heliocentric longitude.
    const phase2 = orbitAngle(home, firstOpposition) - (TAU * firstOpposition) / P2;
    const target = { a: a2, period: P2, phase0: phase2, mass: m2, radius: r2 };

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
    const secondOpposition = firstOpposition + synodic;
    let k = 0;
    while (windowAt(k) < secondOpposition + 10 * DAY) k++;
    const measuredWindow = windowAt(k);
    const lifeSupport = measuredWindow + rng.range(...rules.lifeSlack) * synodic;
    const windows: number[] = [];
    for (let j = 0; windowAt(j) <= lifeSupport; j++) if (windowAt(j) > 0) windows.push(windowAt(j));

    const fuelDv =
      hohmann.departCost + hohmann.captureCost + rules.fuelAllowance * (vInfDepart + vInfArrive);

    return {
      seed,
      difficulty,
      chapter,
      features,
      star,
      home,
      target,
      moon: { a: moonA, period: moonP, phase0: rng.range(0, TAU), radius: r2 * rng.range(0.15, 0.3) },
      site: { lat: rng.range(8, 36) * DEG, lon: 0 },
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
