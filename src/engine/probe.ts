// A probe flying past the blue planet on a hyperbola (chapter 2). With no moon
// to weigh the planet, the probe's speed-up as it falls past it does the job:
// energy conservation gives v_peak² − v∞² = 2GM / r_peri.

import { DAY, G } from './constants';
import type { StarSystem } from './types';

export interface Flyby {
  vInf: number; // m/s, speed relative to the planet far away
  rPeri: number; // m, closest approach from the planet's centre
  vPeak: number; // m/s
  /** Turning angle of the path (rad). */
  deflection: number;
  crashed: boolean;
}

export function flyby(sys: StarSystem, vInf: number, rPeri: number): Flyby {
  const mu = G * sys.target.mass;
  const vPeak = Math.sqrt(vInf * vInf + (2 * mu) / rPeri);
  const e = 1 + (rPeri * vInf * vInf) / mu;
  return { vInf, rPeri, vPeak, deflection: 2 * Math.asin(1 / e), crashed: rPeri < sys.target.radius * 1.02 };
}

/** The flyby the solver bot uses: arriving on a Hohmann transfer, aimed at twice the radius. */
export const nominalFlyby = (sys: StarSystem, rFactor = 2) => flyby(sys, sys.hohmann.vInfArrive, rFactor * sys.target.radius);

/**
 * Speed relative to the planet at time t from closest approach (s), from the
 * hyperbolic Kepler equation t = √(−a³/μ)(e sinh H − H).
 */
export function flybySpeedAt(sys: StarSystem, f: Flyby, t: number) {
  const mu = G * sys.target.mass;
  const a = -mu / (f.vInf * f.vInf);
  const e = 1 + (f.rPeri * f.vInf * f.vInf) / mu;
  const n = Math.sqrt(-(a ** 3) / mu);
  const M = Math.abs(t) / n;
  // Solve e sinh H − H = M by Newton's method.
  let H = Math.asinh(M / e);
  for (let i = 0; i < 30; i++) {
    const fH = e * Math.sinh(H) - H - M;
    H -= fH / (e * Math.cosh(H) - 1);
  }
  const r = a * (1 - e * Math.cosh(H));
  return Math.sqrt(f.vInf * f.vInf + (2 * mu) / r);
}

/** Days the probe takes to reach the blue planet on a fast transfer. */
export const probeTransitDays = (sys: StarSystem) => (0.75 * sys.hohmann.tof) / DAY;

/** Fuel the probe launch takes from the ship (m/s of the ship's Δv budget). */
export const PROBE_COST = 450;
