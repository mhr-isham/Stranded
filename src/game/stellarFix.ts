import { deriveAll, type Primaries } from '../engine/chain';
import { ARCSEC, DAY } from '../engine/constants';
import { catalogueOf, fitParallax, LIGHT_YEAR, type CataloguePlace } from '../engine/nearstars';
import type { StarSystem } from '../engine/types';
import type { GameState } from './store';

export const STELLAR_KEYS = ['pStarA', 'pStarB', 'pStarC'] as const;
const MIN_EPOCHS = 6;
const MIN_ORBIT_COVERAGE = .55;
const RANGE_SIGMAS = 2;

type Interval = [low: number, high: number];

export function stellarEpochs(log: GameState['starPar'], index: number) {
  const nights = new Map<number, { t: number; v: number; noise: number }>();
  for (const obs of log) {
    if (obs.i !== index || !Number.isFinite(obs.at) || obs.at < 0 || !Number.isFinite(obs.v)) continue;
    const night = Math.floor(obs.at / DAY);
    const seeing = obs.environment?.seeing?.factor ?? 1;
    const noise = .01 * ARCSEC * Math.max(1, Number.isFinite(seeing) ? seeing : 1);
    const previous = nights.get(night);
    if (!previous || previous.noise > noise) nights.set(night, { t: obs.at, v: obs.v, noise });
  }
  return [...nights.values()].sort((a, b) => a.t - b.t);
}

function stellarFit(epochs: ReturnType<typeof stellarEpochs>, period: Primaries['P1']) {
  const span = (epochs.at(-1)?.t ?? 0) - (epochs[0]?.t ?? 0);
  if (!period || !(period.value > 0 && Number.isFinite(period.value) && period.sigma >= 0 && Number.isFinite(period.sigma))
    || epochs.length < MIN_EPOCHS || span < MIN_ORBIT_COVERAGE * period.value) return { epochs, span, fit: null };
  const floor = Math.hypot(...epochs.map(o => o.noise)) / Math.sqrt(epochs.length);
  const fit = fitParallax(epochs, period.value, floor);
  if (!fit || !Number.isFinite(fit.parallax) || !Number.isFinite(fit.sigma)) return { epochs, span, fit: null };
  if (period.sigma > 0) {
    const earlier = fitParallax(epochs, period.value - period.sigma, floor);
    const later = fitParallax(epochs, period.value + period.sigma, floor);
    if (!earlier || !later) return { epochs, span, fit: null };
    fit.sigma = Math.hypot(fit.sigma, Math.max(Math.abs(earlier.parallax - fit.parallax), Math.abs(later.parallax - fit.parallax)));
  }
  return { epochs, span, fit: Number.isFinite(fit.sigma) ? fit : null };
}

function overlap(w: Interval, b: Interval): Interval | null {
  const low = Math.max(w[0], b[0]), high = Math.min(w[1], b[1]);
  return low <= high ? [low, high] : null;
}

/** Test whether one orbit radius can explain all three parallax ranges for a
 * catalogue row. Each star shares that radius rather than drawing its own. */
export function matchingPlaces(places: CataloguePlace[], orbit: Interval, parallaxes: Interval[]) {
  return places.filter(place => {
    let common: Interval | null = orbit;
    for (const [i, [lo, hi]] of parallaxes.entries()) {
      const d = place.ly[i] * LIGHT_YEAR;
      common = overlap(common, [d * Math.tan(lo), d * Math.tan(hi)]);
      if (!common) return false;
    }
    return true;
  });
}

export function stellarEvidence(s: Pick<GameState, 'sheet' | 'starPar'>, sys: StarSystem) {
  const { P1 } = s.sheet;
  const a1 = deriveAll(s.sheet, 'stars').a1;
  const orbit: Interval | null = a1 && a1.value > 0 && Number.isFinite(a1.sigma) && a1.sigma >= 0
    ? [Math.max(0, a1.value - RANGE_SIGMAS * a1.sigma), a1.value + RANGE_SIGMAS * a1.sigma] : null;
  const stars = STELLAR_KEYS.map((_, i) => {
    const data = stellarFit(stellarEpochs(s.starPar, i), P1);
    const { fit } = data;
    const range: Interval | null = fit && fit.parallax > 0 && fit.parallax + RANGE_SIGMAS * fit.sigma < Math.PI / 2
      ? [Math.max(0, fit.parallax - RANGE_SIGMAS * fit.sigma), fit.parallax + RANGE_SIGMAS * fit.sigma] : null;
    const distance = orbit && range ? {
      value: a1!.value / Math.tan(fit!.parallax) / LIGHT_YEAR,
      low: orbit[0] / Math.tan(range[1]) / LIGHT_YEAR,
      high: range[0] > 0 ? orbit[1] / Math.tan(range[0]) / LIGHT_YEAR : Infinity,
    } : null;
    return { ...data, range, distance };
  });
  const catalogue = catalogueOf(sys);
  const ranges = stars.flatMap(star => star.range ? [star.range] : []);
  const ready = !!orbit && ranges.length === STELLAR_KEYS.length;
  const matches = ready ? matchingPlaces(catalogue, orbit, ranges) : [];
  return { stars, orbit, catalogue, matches, ready };
}

/** Select the star with the most separated predictions relative to its observed range. */
export function discriminatingStar(evidence: ReturnType<typeof stellarEvidence>) {
  if (evidence.matches.length < 2) return null;
  let best: { index: number; score: number } | null = null;
  for (const [index, star] of evidence.stars.entries()) {
    const values = evidence.matches.map(place => place.ly[index]);
    const distance = star.distance;
    const spread = Math.max(...values) - Math.min(...values);
    const score = spread / (distance ? Math.max(.01, distance.high - distance.low) : Infinity);
    if (score > (best?.score ?? 0)) best = { index, score };
  }
  return best?.index ?? null;
}
