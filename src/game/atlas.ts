// The Atlas: a finished card for every system you measured — even failed
// runs — and the calibration profile built from them: how often the truth
// really fell inside your ± ranges (DESIGN-V2 §12.1).

import type { QuantityKey } from '../engine/chain';
import type { PrimaryKey } from '../engine/chain';
import type { Difficulty } from '../engine/types';
import type { GameState } from './store';

export interface SystemNames {
  star?: string;
  home?: string;
  target?: string;
  moon?: string;
}

export interface AtlasRow {
  k: QuantityKey;
  value: number;
  sigma: number;
  truth: number;
  z: number;
}

export interface AtlasCard {
  id: number;
  seed: number;
  mode: Difficulty;
  survival: boolean;
  date: number;
  names: SystemNames;
  outcome: string;
  grade: string;
  score: number;
  camp: GameState['camp'];
  predictions: { made: number; inside: number };
  rows: AtlasRow[];
}

export const DEFAULT_NAMES: Required<SystemNames> = { star: 'the star', home: 'home planet', target: 'the blue planet', moon: 'the moon' };

export const nameOf = (names: SystemNames, k: keyof SystemNames) => names[k]?.trim() || DEFAULT_NAMES[k];

/** Which tool produced each primary value, for the per-tool calibration. */
export const TOOL_OF: Record<PrimaryKey, string> = {
  g: 'Pendulum',
  R1: 'Hill (horizon dip)',
  P1: 'Year (star drift)',
  tOpp: 'Tracker (opposition)',
  S2: 'Tracker (synodic period)',
  dPar: 'Rover (parallax)',
  alpha2: 'Micrometer',
  thetaM: 'Moon (elongation)',
  Pm: 'Moon (period)',
  vInf: 'Probe (Doppler)',
  vPeak: 'Probe (Doppler)',
  rPeri: 'Probe (altimeter)',
};

export interface Calibration {
  n: number;
  inside: number;
  /** Fraction inside ±1σ; ~0.68 is honest. */
  frac: number;
  verdict: 'honest' | 'overconfident' | 'underconfident' | 'too few';
  perTool: { tool: string; n: number; frac: number; verdict: Calibration['verdict'] }[];
}

const verdictOf = (n: number, frac: number): Calibration['verdict'] => (n < 4 ? 'too few' : frac < 0.5 ? 'overconfident' : frac > 0.9 ? 'underconfident' : 'honest');

/** Calibration over the primary values of every Atlas card. */
export function calibration(atlas: AtlasCard[]): Calibration {
  const rows = atlas.flatMap((c) => c.rows.filter((r) => r.k in TOOL_OF));
  const inside = rows.filter((r) => r.z <= 1).length;
  const n = rows.length;
  const frac = n ? inside / n : 0;
  const tools = new Map<string, { n: number; inside: number }>();
  for (const r of rows) {
    const t = TOOL_OF[r.k as PrimaryKey];
    const e = tools.get(t) ?? { n: 0, inside: 0 };
    e.n++;
    if (r.z <= 1) e.inside++;
    tools.set(t, e);
  }
  return {
    n,
    inside,
    frac,
    verdict: verdictOf(n, frac),
    perTool: [...tools.entries()].map(([tool, e]) => ({ tool, n: e.n, frac: e.inside / e.n, verdict: verdictOf(e.n, e.inside / e.n) })),
  };
}

/** Syllable names for when the player wants a suggestion (always private). */
const SYL_A = ['Ve', 'Ka', 'Tho', 'Ri', 'Su', 'Al', 'Ne', 'Mo', 'Ira', 'Ce', 'Lo', 'Da', 'Ny', 'Ost', 'Ha'];
const SYL_B = ['ra', 'len', 'mir', 'tis', 'van', 'ra', 'lo', 'dun', 'phe', 'ria', 'sca', 'thea', 'nor', 'quil'];
const SYL_C = ['', '', 'a', 'on', 'is', 'e', 'ar', 'ys'];
export function suggestName() {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return pick(SYL_A) + pick(SYL_B) + pick(SYL_C);
}
