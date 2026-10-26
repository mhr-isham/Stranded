// The solve chain: which quantities the player measures directly, how every
// other quantity follows from them, and how errors propagate along the way.

import { DAY, G } from './constants';
import { oppositions, planetPos } from './ephemeris';
import { surfaceGravity } from './measure';
import type { StarSystem } from './types';
import { norm, sub } from './vec';

export const PRIMARY_KEYS = ['R1', 'g', 'P1', 'S2', 'tOpp', 'dPar', 'alpha2', 'thetaM', 'Pm'] as const;
export const DERIVED_KEYS = ['M1', 'P2', 'ratio', 'a1', 'a2', 'Mstar', 'R2', 'aM', 'M2'] as const;
export type PrimaryKey = (typeof PRIMARY_KEYS)[number];
export type DerivedKey = (typeof DERIVED_KEYS)[number];
export type QuantityKey = PrimaryKey | DerivedKey;

export interface Estimate {
  value: number;
  sigma: number;
  /** When the reading was taken (s). Needed for angles and distances that change with planet positions. */
  at?: number;
}
export type Primaries = Partial<Record<PrimaryKey, Estimate>>;
export type Values = Partial<Record<QuantityKey, number>>;

type V = Record<PrimaryKey, number>;
type At = Partial<Record<PrimaryKey, number>>;

interface DerivedDef {
  inputs: PrimaryKey[];
  f: (v: V, at: At) => number;
}

const P2of = (v: V) => 1 / (1 / v.P1 - 1 / v.S2);
const ratioOf = (v: V) => (P2of(v) / v.P1) ** (2 / 3);
/**
 * Planet-planet distance in units of a1 at time t (law of cosines). The angle
 * between the planets grows by 2pi every synodic period from zero at opposition.
 */
const distFactor = (v: V, t: number) => {
  const r = ratioOf(v);
  const psi = (2 * Math.PI * (t - v.tOpp)) / v.S2;
  return Math.sqrt(1 + r * r - 2 * r * Math.cos(psi));
};
const a1of = (v: V, at: At) => v.dPar / distFactor(v, at.dPar ?? v.tOpp);
const distAt = (v: V, at: At, t: number) => a1of(v, at) * distFactor(v, t);
const aMof = (v: V, at: At) => distAt(v, at, at.thetaM ?? v.tOpp) * Math.tan(v.thetaM);

const ORBIT: PrimaryKey[] = ['P1', 'S2', 'tOpp', 'dPar'];

/** Each derived quantity as a function of primaries only, so shared inputs propagate correctly. */
export const DERIVED: Record<DerivedKey, DerivedDef> = {
  M1: { inputs: ['g', 'R1'], f: (v) => (v.g * v.R1 ** 2) / G },
  P2: { inputs: ['P1', 'S2'], f: P2of },
  ratio: { inputs: ['P1', 'S2'], f: ratioOf },
  a1: { inputs: ORBIT, f: a1of },
  a2: { inputs: ORBIT, f: (v, at) => ratioOf(v) * a1of(v, at) },
  Mstar: { inputs: ORBIT, f: (v, at) => (4 * Math.PI ** 2 * a1of(v, at) ** 3) / (G * v.P1 ** 2) },
  R2: { inputs: [...ORBIT, 'alpha2'], f: (v, at) => distAt(v, at, at.alpha2 ?? v.tOpp) * Math.tan(v.alpha2 / 2) },
  aM: { inputs: [...ORBIT, 'thetaM'], f: aMof },
  M2: { inputs: [...ORBIT, 'thetaM', 'Pm'], f: (v, at) => (4 * Math.PI ** 2 * aMof(v, at) ** 3) / (G * v.Pm ** 2) },
};

/** Which quantities feed each node (for the constellation map). Direct edges only. */
export const EDGES: Record<DerivedKey, QuantityKey[]> = {
  M1: ['g', 'R1'],
  P2: ['P1', 'S2'],
  ratio: ['P2', 'P1'],
  a1: ['dPar', 'ratio', 'tOpp'],
  a2: ['a1', 'ratio'],
  Mstar: ['a1', 'P1'],
  R2: ['a1', 'alpha2'],
  aM: ['a1', 'thetaM'],
  M2: ['aM', 'Pm'],
};

/** Value and linearly propagated 1-sigma error of every derived quantity that can be computed. */
export function deriveAll(p: Primaries): Partial<Record<DerivedKey, Estimate>> {
  const out: Partial<Record<DerivedKey, Estimate>> = {};
  for (const key of DERIVED_KEYS) {
    const def = DERIVED[key];
    if (!def.inputs.every((k) => p[k] && Number.isFinite(p[k]!.value))) continue;
    const base = Object.fromEntries(def.inputs.map((k) => [k, p[k]!.value])) as V;
    const at = Object.fromEntries(def.inputs.map((k) => [k, p[k]!.at])) as At;
    const value = def.f(base, at);
    let variance = 0;
    for (const k of def.inputs) {
      const s = p[k]!.sigma;
      if (!(s > 0)) continue;
      const h = Math.max(Math.abs(base[k]) * 1e-6, s * 1e-3);
      const up = def.f({ ...base, [k]: base[k] + h }, at);
      const dn = def.f({ ...base, [k]: base[k] - h }, at);
      variance += (((up - dn) / (2 * h)) * s) ** 2;
    }
    if (Number.isFinite(value)) out[key] = { value, sigma: Math.sqrt(variance) };
  }
  return out;
}

/**
 * The true value of every quantity. Time-stamped readings are compared with the
 * truth at the moment they were taken; tOpp is scored against the opposition
 * nearest the player's own entry.
 */
export function truthValues(sys: StarSystem, p: Primaries = {}): Record<QuantityKey, number> {
  let tOpp = sys.firstOpposition;
  const guess = p.tOpp?.value;
  if (guess !== undefined) {
    const near = oppositions(sys, guess - sys.synodic, guess + sys.synodic);
    tOpp = near.reduce((best, t) => (Math.abs(t - guess) < Math.abs(best - guess) ? t : best), near[0] ?? tOpp);
  }
  const dist = (t: number) => norm(sub(planetPos(sys.target, t), planetPos(sys.home, t)));
  const dAt = (k: PrimaryKey) => dist(p[k]?.at ?? tOpp);
  return {
    R1: sys.home.radius,
    g: surfaceGravity(sys),
    P1: sys.home.period,
    S2: sys.synodic,
    tOpp,
    dPar: dAt('dPar'),
    alpha2: 2 * Math.atan(sys.target.radius / dAt('alpha2')),
    thetaM: Math.atan(sys.moon.a / dAt('thetaM')),
    Pm: sys.moon.period,
    M1: sys.home.mass,
    P2: sys.target.period,
    ratio: sys.target.a / sys.home.a,
    a1: sys.home.a,
    a2: sys.target.a,
    Mstar: sys.star.mass,
    R2: sys.target.radius,
    aM: sys.moon.a,
    M2: sys.target.mass,
  };
}

export const QUANTITY_INFO: Record<QuantityKey, { label: string; symbol: string; unit: string; scale: number; digits: number }> = {
  R1: { label: 'Home planet radius', symbol: 'R₁', unit: 'km', scale: 1e3, digits: 0 },
  g: { label: 'Surface gravity', symbol: 'g', unit: 'm/s²', scale: 1, digits: 3 },
  P1: { label: 'Year length', symbol: 'P₁', unit: 'days', scale: DAY, digits: 2 },
  S2: { label: 'Synodic period of the blue planet', symbol: 'S', unit: 'days', scale: DAY, digits: 1 },
  tOpp: { label: 'Date of opposition', symbol: 't₀', unit: 'day', scale: DAY, digits: 1 },
  dPar: { label: 'Distance to blue planet (parallax)', symbol: 'd', unit: 'million km', scale: 1e9, digits: 3 },
  alpha2: { label: 'Angular diameter of blue planet', symbol: 'α₂', unit: '″', scale: Math.PI / 648000, digits: 2 },
  thetaM: { label: 'Moon greatest elongation', symbol: 'θₘ', unit: '′', scale: Math.PI / 10800, digits: 3 },
  Pm: { label: 'Moon orbital period', symbol: 'Pₘ', unit: 'days', scale: DAY, digits: 3 },
  M1: { label: 'Home planet mass', symbol: 'M₁', unit: '×10²⁴ kg', scale: 1e24, digits: 3 },
  P2: { label: 'Blue planet year', symbol: 'P₂', unit: 'days', scale: DAY, digits: 1 },
  ratio: { label: 'Orbit ratio a₂/a₁', symbol: 'a₂/a₁', unit: '', scale: 1, digits: 4 },
  a1: { label: 'Home orbit radius', symbol: 'a₁', unit: 'million km', scale: 1e9, digits: 2 },
  a2: { label: 'Blue planet orbit radius', symbol: 'a₂', unit: 'million km', scale: 1e9, digits: 2 },
  Mstar: { label: 'Star mass', symbol: 'M★', unit: '×10³⁰ kg', scale: 1e30, digits: 3 },
  R2: { label: 'Blue planet radius', symbol: 'R₂', unit: 'km', scale: 1e3, digits: 0 },
  aM: { label: 'Moon orbit radius', symbol: 'aₘ', unit: 'thousand km', scale: 1e6, digits: 1 },
  M2: { label: 'Blue planet mass', symbol: 'M₂', unit: '×10²⁴ kg', scale: 1e24, digits: 3 },
};
