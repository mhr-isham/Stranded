// Mission readiness, computed only from the player's own sheet (never the
// truth): how many values are measured, which one adds most uncertainty to
// the flight, and — once everything is measured — the chance that a launch at
// the next window succeeds if the system is anywhere inside the error bars.

import { QUANTITY_INFO, deriveAll, keysFor, type ChainVariant, type DerivedKey, type Estimate, type Primaries, type PrimaryKey } from '../engine/chain';
import { DAY } from '../engine/constants';
import { simulateLaunch } from '../engine/launch';
import { bestTransfer, modelFromPrimaries, predictedWindows, sampleModel, systemFromModel } from '../engine/planner';
import { makeRng } from '../engine/rng';
import type { StarSystem } from '../engine/types';
import { variantOf } from '../engine/chapters';

/** Derived values the flight depends on most. */
const FLIGHT_KEYS: DerivedKey[] = ['a2', 'Mstar', 'M2', 'P2', 'a1', 'M1'];

export interface Readiness {
  measured: number;
  total: number;
  /** Primary whose error matters most for the flight, with its share of the uncertainty (0–1). */
  weakest: { k: PrimaryKey; share: number } | null;
  /** Chance of success at the next window, when the sheet is complete. */
  success: number | null;
  window: number | null;
}

function flightVariance(p: Primaries, variant: ChainVariant) {
  const d = deriveAll(p, variant) as Record<string, Estimate | undefined>;
  let v = 0;
  for (const k of FLIGHT_KEYS) {
    const e = d[k];
    if (e && e.value) v += (e.sigma / e.value) ** 2;
  }
  return v;
}

/** Which measured value, if it were perfect, would shrink the flight's uncertainty most. */
export function weakestValue(p: Primaries, variant: ChainVariant = 'standard') {
  const base = flightVariance(p, variant);
  if (!(base > 0)) return null;
  let best: { k: PrimaryKey; share: number } | null = null;
  for (const k of keysFor(variant)) {
    const e = p[k];
    if (!e) continue;
    const share = (base - flightVariance({ ...p, [k]: { ...e, sigma: 0 } }, variant)) / base;
    if (!best || share > best.share) best = { k, share };
  }
  return best;
}

const cache = new WeakMap<object, Map<string, Readiness>>();

export function readiness(p: Primaries, sys: StarSystem, budget: number, now: number, end: number): Readiness {
  const variant = variantOf(sys.features);
  const keys = keysFor(variant);
  const model = modelFromPrimaries(p, variant);
  const window = model ? (predictedWindows(model, now, end)[0] ?? null) : null;
  // Cached per sheet and per window, so warping time doesn't re-run the simulation.
  const key = `${Math.round(budget)}:${window === null ? '-' : Math.round(window / DAY)}`;
  const hit = cache.get(p)?.get(key);
  if (hit) return hit;
  const measured = keys.filter((k) => p[k]).length;
  const r: Readiness = { measured, total: keys.length, weakest: weakestValue(p, variant), success: null, window };
  const plan = model && window !== null ? bestTransfer(model, window) : null;
  if (plan) {
    const rng = makeRng(7);
    let ok = 0;
    let n = 0;
    for (let i = 0; i < 24; i++) {
      const m = sampleModel(p, rng, variant);
      if (!m) continue;
      n++;
      const res = simulateLaunch({ ...systemFromModel(m, sys), fuelDv: budget, lifeSupport: Infinity }, plan.plan);
      if (res.fuelLeft >= 0) ok++;
    }
    r.success = n ? ok / n : null;
  }
  if (!cache.has(p)) cache.set(p, new Map());
  cache.get(p)!.set(key, r);
  return r;
}

export const quantityName = (k: PrimaryKey) => `${QUANTITY_INFO[k].label} (${QUANTITY_INFO[k].symbol})`;

