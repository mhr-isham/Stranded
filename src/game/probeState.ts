// The chapter 2 probe: launched from camp toward the blue planet, it flies
// past on a hyperbola and radios back its speed and its height at closest
// approach. The aim is the player's; the navigation scatter is real.

import { DAY } from '../engine/constants';
import { flyby, PROBE_COST, probeTransitDays } from '../engine/probe';
import { hash32 } from '../engine/rng';
import type { StarSystem } from '../engine/types';
import type { GameState } from './store';

export interface ProbeState {
  /** Requested closest approach from the planet's centre (m). */
  aim: number;
  launchedAt: number;
  arriveAt: number;
  vInf: number;
  rPeri: number;
  vPeak: number;
  crashed: boolean;
}

/** Launch: the probe's real closest approach scatters by ~6% around the aim. */
export function launchProbe(sys: StarSystem, s: GameState, aim: number, now: number): Partial<GameState> {
  const u1 = hash32(sys.seed, Math.round(now), 0x9b) / 4294967296;
  const u2 = hash32(sys.seed, Math.round(now), 0x9c) / 4294967296;
  const gauss = Math.sqrt(-2 * Math.log(Math.max(1e-9, u1))) * Math.cos(2 * Math.PI * u2);
  const rPeri = aim * (1 + 0.06 * gauss);
  const vInf = sys.hohmann.vInfArrive * 1.35;
  const f = flyby(sys, vInf, rPeri);
  const probe: ProbeState = {
    aim,
    launchedAt: now,
    arriveAt: now + probeTransitDays(sys) * DAY,
    vInf,
    rPeri,
    vPeak: f.vPeak,
    crashed: f.crashed,
  };
  return { probe, penaltyDv: s.penaltyDv + PROBE_COST };
}

/** True flyby values, for scoring. */
export function probeTruth(s: GameState) {
  const p = s.probe;
  return p && !p.crashed ? { vInf: p.vInf, vPeak: p.vPeak, rPeri: p.rPeri } : {};
}
