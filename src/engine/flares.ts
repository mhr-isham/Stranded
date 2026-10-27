// Red-dwarf flares (chapter 6). They come at random — about one every few days,
// like the clicks of a Geiger counter — so the next one can't be predicted, only
// the rate. While one burns, the sky is washed out and the instruments are blind.

import { DAY, HOUR } from './constants';
import { unitHash } from './rng';
import type { StarSystem } from './types';

export const FLARE_RATE = 1 / (2.5 * DAY); // mean flares per second

export interface Flare {
  start: number;
  end: number;
  /** Peak brightness relative to the star (for the sky tint). */
  peak: number;
}

const cache = new WeakMap<StarSystem, Flare[]>();

/** Every flare of the expedition: exponential gaps (a Poisson process), deterministic per system. */
export function flaresOf(sys: StarSystem): Flare[] {
  let f = cache.get(sys);
  if (f) return f;
  f = [];
  if (sys.features.locked) {
    const u = (i: number, k: number) => unitHash(sys.seed, i, k) + 0.5 / 4294967296;
    let t = 0;
    for (let i = 0; t < sys.lifeSupport + 30 * DAY && i < 5000; i++) {
      t += -Math.log(u(i, 0xf1a)) / FLARE_RATE;
      const len = (1 + 6 * u(i, 0xf1b)) * HOUR;
      f.push({ start: t, end: t + len, peak: 0.3 + 0.7 * u(i, 0xf1c) });
    }
  }
  cache.set(sys, f);
  return f;
}

/** The flare burning at time t, if any. */
export function flareAt(sys: StarSystem, t: number): Flare | null {
  if (!sys.features.locked) return null;
  const f = flaresOf(sys);
  // Binary search on start time.
  let lo = 0;
  let hi = f.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (f[m].start <= t) lo = m;
    else hi = m - 1;
  }
  const x = f[lo];
  return x && x.start <= t && t < x.end ? x : null;
}

/** Flares seen so far (for the flare log and the statistics). */
export const flaresBefore = (sys: StarSystem, t: number) => flaresOf(sys).filter((x) => x.start < t);
