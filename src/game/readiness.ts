import { QUANTITY_INFO, deriveAll, keysFor, type ChainVariant, type DerivedKey, type Estimate, type Primaries, type PrimaryKey } from '../engine/chain';
import { simulateLaunch } from '../engine/launch';
import { bestDirectTransfer, bestSlingshot, modelFromPrimaries, routeWindows, sampleModel, systemFromModel } from '../engine/planner';
import { makeRng } from '../engine/rng';
import type { StarSystem } from '../engine/types';
import { variantOf } from '../engine/chapters';
import { assessableModel, summarizeForecast, type ForecastSummary } from './forecast';

/** Derived values the flight depends on most. */
const FLIGHT_KEYS: DerivedKey[] = ['a2', 'Mstar', 'M2', 'P2', 'a1', 'M1'];

export function navigationProgress(sheet: Primaries, variant: ChainVariant) {
  const keys = keysFor(variant);
  const missing = keys.filter(key => !sheet[key]);
  const invalid = keys.filter(key => {
    const entry = sheet[key];
    return entry && (!Number.isFinite(entry.value) || !Number.isFinite(entry.sigma) || entry.sigma < 0);
  });
  return { logged: keys.length - missing.length, total: keys.length, missing, invalid };
}

export function navigationModel(sheet: Primaries, variant: ChainVariant) {
  const progress = navigationProgress(sheet, variant);
  if (progress.missing.length || progress.invalid.length) return null;
  const model = modelFromPrimaries(sheet, variant);
  return assessableModel(model) ? model : null;
}

export type FlightReadiness =
  | { status: 'missing' | 'invalid-model' | 'no-window' | 'no-transfer' }
  | { status: 'sampled'; window: number; summary: ForecastSummary };

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
  if (!Number.isFinite(base) || base <= 0) return null;
  let best: { k: PrimaryKey; share: number } | null = null;
  for (const k of keysFor(variant)) {
    const e = p[k];
    if (!e) continue;
    const share = (base - flightVariance({ ...p, [k]: { ...e, sigma: 0 } }, variant)) / base;
    if (Number.isFinite(share) && share > 0 && (!best || share > best.share)) best = { k, share };
  }
  return best;
}

const estimateCache = new WeakMap<Primaries, {
  system: StarSystem; budget: number; window: number; estimate: FlightReadiness;
}>();

/** Assess one upcoming departure using only the sheet's model and the current
 * fuel budget. A sampled success requires capture, not just fuel remaining. */
export function flightReadiness(sheet: Primaries, system: StarSystem, budget: number, now: number, end: number): FlightReadiness {
  const variant = variantOf(system.features);
  const progress = navigationProgress(sheet, variant);
  if (progress.missing.length) return { status: 'missing' };
  if (progress.invalid.length) return { status: 'invalid-model' };
  const model = navigationModel(sheet, variant);
  if (!model) return { status: 'invalid-model' };
  const window = routeWindows(model, now, end, 1)[0];
  if (window === undefined) return { status: 'no-window' };
  const previous = estimateCache.get(sheet);
  if (previous?.system === system && previous.budget === budget && previous.window === window) return previous.estimate;

  const direct = bestDirectTransfer(model, window);
  const flyby = model.giant ? bestSlingshot(model, window) : null;
  const plan = flyby && flyby.total < (direct?.total ?? Infinity) ? flyby : direct;
  let estimate: FlightReadiness = { status: 'no-transfer' };
  if (plan && Number.isFinite(plan.total) && Number.isFinite(budget)) {
    const rng = makeRng(7);
    const trials = Array.from({ length: 24 }, () => {
      const sampled = sampleModel(sheet, rng, variant);
      if (!assessableModel(sampled)) return null;
      const result = simulateLaunch({ ...systemFromModel(sampled, system), fuelDv: budget, lifeSupport: Infinity }, plan.plan);
      return { outcome: result.outcome, fuelLeft: result.fuelLeft };
    });
    estimate = { status: 'sampled', window, summary: summarizeForecast(trials) };
  }
  estimateCache.set(sheet, { system, budget, window, estimate });
  return estimate;
}

export const quantityName = (k: PrimaryKey) => `${QUANTITY_INFO[k].label} (${QUANTITY_INFO[k].symbol})`;

