// The solve chain: which quantities the player measures directly, how every
// other quantity follows from them, and how errors propagate along the way.

import { DAY, G } from './constants';
import { nearStarsOf } from './nearstars';
import { keplerState, meanLonForTrue, nearestOpposition, oppositionsOf, orbitAngle, planetPos } from './ephemeris';

const nearestOf = (ts: number[], t: number) => ts.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), ts[0] ?? NaN);
import { surfaceGravity } from './measure';
import type { StarSystem } from './types';
import { norm, sub } from './vec';

/** Every primary any chapter uses. Each chain variant measures a subset (keysFor). */
export const PRIMARY_KEYS = ['R1', 'g', 'P1', 'S2', 'tOpp', 'dPar', 'alpha2', 'thetaM', 'Pm', 'vInf', 'vPeak', 'rPeri', 'Porb', 'ecc', 'wPeri', 'Sg', 'tOppG', 'thetaMg', 'Pmg', 'pStarA', 'pStarB', 'pStarC'] as const;
export const DERIVED_KEYS = ['M1', 'P2', 'ratio', 'a1', 'a2', 'Mstar', 'R2', 'aM', 'M2', 'aG', 'Mg'] as const;
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

export type { ChainVariant } from './chapters';
import type { ChainVariant } from './chapters';

const STANDARD_KEYS: PrimaryKey[] = ['R1', 'g', 'P1', 'S2', 'tOpp', 'dPar', 'alpha2', 'thetaM', 'Pm'];
/** The primaries a launch needs in each version of the chain. */
export const keysFor = (variant: ChainVariant = 'standard'): PrimaryKey[] =>
  variant === 'probe'
    ? ['R1', 'g', 'P1', 'S2', 'tOpp', 'dPar', 'alpha2', 'vInf', 'vPeak', 'rPeri']
    : variant === 'ellipse'
      ? ['R1', 'g', 'P1', 'tOpp', 'dPar', 'alpha2', 'thetaM', 'Pm', 'Porb', 'ecc', 'wPeri']
      : variant === 'slingshot'
        ? ['R1', 'g', 'P1', 'tOpp', 'dPar', 'alpha2', 'thetaM', 'Pm', 'Porb', 'Sg', 'tOppG', 'thetaMg', 'Pmg']
        : variant === 'stars'
          ? [...STANDARD_KEYS, 'pStarA', 'pStarB', 'pStarC']
          : STANDARD_KEYS;

type V = Record<PrimaryKey, number>;
type At = Partial<Record<PrimaryKey, number>>;

interface DerivedDef {
  inputs: PrimaryKey[];
  f: (v: V, at: At) => number;
}

/** An outer planet: 1/P₂ = 1/P₁ − 1/S. An inner one moves faster: 1/P₂ = 1/P₁ + 1/S. */
const P2for = (inner: boolean) => (v: V) => 1 / (1 / v.P1 + (inner ? 1 : -1) / v.S2);
const ratioFor = (inner: boolean) => (v: V) => (P2for(inner)(v) / v.P1) ** (2 / 3);
/**
 * Planet-planet distance in units of a1 at time t (law of cosines). The angle
 * between the planets grows by 2pi every synodic period from zero at opposition
 * (inferior conjunction for an inner planet).
 */
const distFactorFor = (inner: boolean) => (v: V, t: number) => {
  const r = ratioFor(inner)(v);
  const psi = (2 * Math.PI * (t - v.tOpp)) / v.S2;
  return Math.sqrt(1 + r * r - 2 * r * Math.cos(psi));
};

/**
 * Chapter 4: the blue planet on an ellipse (period Porb, eccentricity ecc,
 * perihelion direction wPeri measured from the opposition direction). Positions
 * in units of a1, with our planet at angle 0 at the opposition tOpp.
 */
export function ellipsePositions(v: { P1: number; Porb: number; ecc: number; wPeri: number; tOpp: number }, t: number) {
  const L1 = (2 * Math.PI * (t - v.tOpp)) / v.P1;
  const ratio = (v.Porb / v.P1) ** (2 / 3);
  const m0 = meanLonForTrue(v.ecc, v.wPeri, 0);
  const [r2] = keplerState(ratio, v.Porb, v.ecc, v.wPeri, m0 + (2 * Math.PI * (t - v.tOpp)) / v.Porb);
  return { home: [Math.cos(L1), Math.sin(L1), 0] as [number, number, number], target: r2 };
}
const ellipseDist = (v: V, t: number) => norm(sub(ellipsePositions(v, t).target, ellipsePositions(v, t).home));

const ORBIT_C: PrimaryKey[] = ['P1', 'S2', 'tOpp', 'dPar'];
// Chapter 7: the parallax is taken on the (nearer) giant.
const ORBIT_S: PrimaryKey[] = ['P1', 'Porb', 'tOpp', 'Sg', 'tOppG', 'dPar'];
const ORBIT_E: PrimaryKey[] = ['P1', 'Porb', 'ecc', 'wPeri', 'tOpp', 'dPar'];

function buildDerived(variant: ChainVariant): Partial<Record<DerivedKey, DerivedDef>> {
  const inner = variant === 'inner';
  const ell = variant === 'ellipse';
  // Chapter 7: the far planet's synodic period is almost our own year — a poor clock —
  // so its year comes from the orbit fit (Kepler's method) instead.
  const sling = variant === 'slingshot';
  const P2of = ell || sling ? (v: V) => v.Porb : P2for(inner);
  const ratioOf = ell || sling ? (v: V) => (v.Porb / v.P1) ** (2 / 3) : ratioFor(inner);
  const distFactor = ell
    ? ellipseDist
    : sling
      ? (v: V, t: number) => {
          const r = ratioOf(v);
          const psi = 2 * Math.PI * (t - v.tOpp) * (1 / v.P1 - 1 / v.Porb);
          return Math.sqrt(1 + r * r - 2 * r * Math.cos(psi));
        }
      : distFactorFor(inner);
  const ORBIT = ell ? ORBIT_E : sling ? ORBIT_S : ORBIT_C;
  // Distance to the giant in units of a₁ (chapter 7): law of cosines with its own synodic period.
  const giantFactor = (v: V, t: number) => {
    const r = ((1 / (1 / v.P1 - 1 / v.Sg)) / v.P1) ** (2 / 3);
    const psi = (2 * Math.PI * (t - v.tOppG)) / v.Sg;
    return Math.sqrt(1 + r * r - 2 * r * Math.cos(psi));
  };
  const a1of = sling
    ? (v: V, at: At) => v.dPar / giantFactor(v, at.dPar ?? v.tOppG)
    : (v: V, at: At) => v.dPar / distFactor(v, at.dPar ?? v.tOpp);
  const distAt = (v: V, at: At, t: number) => a1of(v, at) * distFactor(v, t);
  const aMof = (v: V, at: At) => distAt(v, at, at.thetaM ?? v.tOpp) * Math.tan(v.thetaM);
  const base: Partial<Record<DerivedKey, DerivedDef>> = {
    M1: { inputs: ['g', 'R1'], f: (v) => (v.g * v.R1 ** 2) / G },
    P2: { inputs: ell || sling ? ['Porb'] : ['P1', 'S2'], f: P2of },
    ratio: { inputs: ell || sling ? ['P1', 'Porb'] : ['P1', 'S2'], f: ratioOf },
    a1: { inputs: ORBIT, f: a1of },
    a2: { inputs: ORBIT, f: (v, at) => ratioOf(v) * a1of(v, at) },
    Mstar: { inputs: ORBIT, f: (v, at) => (4 * Math.PI ** 2 * a1of(v, at) ** 3) / (G * v.P1 ** 2) },
    R2: { inputs: [...ORBIT, 'alpha2'], f: (v, at) => distAt(v, at, at.alpha2 ?? v.tOpp) * Math.tan(v.alpha2 / 2) },
  };
  if (variant === 'slingshot') {
    // The giant: its orbit from its own synodic period, its distance from the law of
    // cosines, and its mass from its moon — the same steps as for the blue planet.
    const ratioG = (v: V) => ((1 / (1 / v.P1 - 1 / v.Sg)) / v.P1) ** (2 / 3);
    const aGof = (v: V, at: At) => ratioG(v) * a1of(v, at);
    const distG = (v: V, at: At, t: number) => {
      const r = ratioG(v);
      const psi = (2 * Math.PI * (t - v.tOppG)) / v.Sg;
      return a1of(v, at) * Math.sqrt(1 + r * r - 2 * r * Math.cos(psi));
    };
    const GIANT: PrimaryKey[] = [...ORBIT, 'Sg', 'tOppG'];
    base.aG = { inputs: GIANT, f: aGof };
    base.Mg = {
      inputs: [...GIANT, 'thetaMg', 'Pmg'],
      f: (v, at) => (4 * Math.PI ** 2 * (distG(v, at, at.thetaMg ?? v.tOppG) * Math.tan(v.thetaMg)) ** 3) / (G * v.Pmg ** 2),
    };
  }
  if (variant === 'probe') {
    // Energy along the flyby: v_peak² − v∞² = 2GM₂ / r_peri.
    base.M2 = { inputs: ['vInf', 'vPeak', 'rPeri'], f: (v) => (v.rPeri * (v.vPeak ** 2 - v.vInf ** 2)) / (2 * G) };
  } else {
    base.aM = { inputs: [...ORBIT, 'thetaM'], f: aMof };
    base.M2 = { inputs: [...ORBIT, 'thetaM', 'Pm'], f: (v, at) => (4 * Math.PI ** 2 * aMof(v, at) ** 3) / (G * v.Pm ** 2) };
  }
  return base;
}

const derivedCache = new Map<ChainVariant, Partial<Record<DerivedKey, DerivedDef>>>();
/** Each derived quantity as a function of primaries only, so shared inputs propagate correctly. */
export function derivedFor(variant: ChainVariant = 'standard') {
  let d = derivedCache.get(variant);
  if (!d) derivedCache.set(variant, (d = buildDerived(variant)));
  return d;
}
/** The standard chain (chapter 1). */
export const DERIVED = derivedFor('standard') as Record<DerivedKey, DerivedDef>;

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
  aG: ['a1', 'Sg', 'P1'],
  Mg: ['aG', 'tOppG', 'thetaMg', 'Pmg'],
};

export function edgesFor(variant: ChainVariant = 'standard'): Partial<Record<DerivedKey, QuantityKey[]>> {
  if (variant === 'ellipse') return { ...EDGES, P2: ['Porb'], a1: ['dPar', 'ratio', 'tOpp', 'ecc', 'wPeri'] };
  if (variant !== 'probe' && variant !== 'slingshot') {
    const { aG: _a, Mg: _m, ...rest } = EDGES;
    return rest;
  }
  if (variant === 'slingshot') return { ...EDGES, P2: ['Porb'], a1: ['dPar', 'Sg', 'tOppG'] };
  const { aM: _aM, ...rest } = EDGES;
  return { ...rest, M2: ['vInf', 'vPeak', 'rPeri'] };
}

/** Value and linearly propagated 1-sigma error of every derived quantity that can be computed. */
export function deriveAll(p: Primaries, variant: ChainVariant = 'standard'): Partial<Record<DerivedKey, Estimate>> {
  const out: Partial<Record<DerivedKey, Estimate>> = {};
  const defs = derivedFor(variant);
  for (const key of DERIVED_KEYS) {
    const def = defs[key];
    if (!def) continue;
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
export function truthValues(sys: StarSystem, p: Primaries = {}, extra: Partial<Record<QuantityKey, number>> = {}): Record<QuantityKey, number> {
  let tOpp = sys.firstOpposition;
  const guess = p.tOpp?.value;
  if (guess !== undefined) tOpp = nearestOpposition(sys, guess);
  // Perihelion direction measured from our planet's direction at that opposition,
  // on the branch nearest the player's own value.
  let wPeri = (sys.target.peri ?? 0) - orbitAngle(sys.home, tOpp);
  const wRef = p.wPeri?.value ?? 0;
  wPeri = wRef + Math.atan2(Math.sin(wPeri - wRef), Math.cos(wPeri - wRef));
  const dist = (t: number) => norm(sub(planetPos(sys.target, t), planetPos(sys.home, t)));
  const dAt = (k: PrimaryKey) => dist(p[k]?.at ?? tOpp);
  return {
    R1: sys.home.radius,
    g: surfaceGravity(sys),
    P1: sys.home.period,
    S2: sys.synodic,
    tOpp,
    // Chapter 7 takes its parallax on the giant.
    dPar: sys.giant ? norm(sub(planetPos(sys.giant, p.dPar?.at ?? 0), planetPos(sys.home, p.dPar?.at ?? 0))) : dAt('dPar'),
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
    // Probe flyby values depend on how the probe was flown; the caller passes them in.
    vInf: NaN,
    vPeak: NaN,
    rPeri: NaN,
    Sg: sys.giant ? 1 / Math.abs(1 / sys.home.period - 1 / sys.giant.period) : NaN,
    tOppG: sys.giant ? nearestOf(oppositionsOf(sys.home, sys.giant, (p.tOppG?.value ?? 0) - 2 * sys.synodic, (p.tOppG?.value ?? 0) + 2 * sys.synodic), p.tOppG?.value ?? 0) : NaN,
    thetaMg: sys.giant ? Math.atan(sys.giant.moon.a / norm(sub(planetPos(sys.giant, p.thetaMg?.at ?? 0), planetPos(sys.home, p.thetaMg?.at ?? 0)))) : NaN,
    Pmg: sys.giant?.moon.period ?? NaN,
    aG: sys.giant?.a ?? NaN,
    Mg: sys.giant?.mass ?? NaN,
    // Chapter 8: the three nearby stars' annual parallaxes.
    ...(() => {
      const ns = nearStarsOf(sys);
      return { pStarA: ns[0]?.parallax ?? NaN, pStarB: ns[1]?.parallax ?? NaN, pStarC: ns[2]?.parallax ?? NaN };
    })(),
    Porb: sys.target.period,
    ecc: sys.target.e ?? 0,
    wPeri,
    ...extra,
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
  vInf: { label: 'Probe speed far from the planet', symbol: 'v∞', unit: 'km/s', scale: 1e3, digits: 3 },
  vPeak: { label: 'Probe speed at closest approach', symbol: 'vₚ', unit: 'km/s', scale: 1e3, digits: 3 },
  rPeri: { label: 'Probe closest approach (from centre)', symbol: 'rₚ', unit: 'km', scale: 1e3, digits: 0 },
  Sg: { label: 'Synodic period of the giant', symbol: 'S_G', unit: 'days', scale: DAY, digits: 1 },
  tOppG: { label: 'Date of the giant’s opposition', symbol: 't_G', unit: 'day', scale: DAY, digits: 1 },
  thetaMg: { label: 'Giant’s moon greatest elongation', symbol: 'θ_G', unit: '′', scale: Math.PI / 10800, digits: 3 },
  Pmg: { label: 'Giant’s moon period', symbol: 'P_G', unit: 'days', scale: DAY, digits: 3 },
  aG: { label: 'Giant orbit radius', symbol: 'a_G', unit: 'million km', scale: 1e9, digits: 1 },
  Mg: { label: 'Giant mass', symbol: 'M_G', unit: '×10²⁴ kg', scale: 1e24, digits: 1 },
  pStarA: { label: 'Parallax of Kestrel', symbol: 'p_K', unit: '″', scale: Math.PI / 648000, digits: 4 },
  pStarB: { label: 'Parallax of Wren', symbol: 'p_W', unit: '″', scale: Math.PI / 648000, digits: 4 },
  pStarC: { label: 'Parallax of Osprey', symbol: 'p_O', unit: '″', scale: Math.PI / 648000, digits: 4 },
  Porb: { label: 'Blue planet year (orbit fit)', symbol: 'P₂', unit: 'days', scale: DAY, digits: 2 },
  ecc: { label: 'Orbit eccentricity', symbol: 'e', unit: '', scale: 1, digits: 3 },
  wPeri: { label: 'Perihelion direction (from opposition)', symbol: 'ϖ', unit: '°', scale: Math.PI / 180, digits: 1 },
};

/** Labels that change with the chain variant (an inner planet has transits, not oppositions). */
export function labelFor(k: QuantityKey, variant: ChainVariant = 'standard') {
  if (variant === 'inner') {
    if (k === 'tOpp') return 'Date of transit (inferior conjunction)';
    if (k === 'S2') return 'Synodic period (transit to transit)';
  }
  if (variant === 'slingshot' && k === 'dPar') return 'Distance to the giant (parallax)';
  return QUANTITY_INFO[k].label;
}
