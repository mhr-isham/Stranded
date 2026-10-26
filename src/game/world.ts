// The current star system, derived (and cached) from seed + difficulty.
// It is never persisted: regenerating from the seed is deterministic.

import { generateSolvableSystem } from '../engine/solver';
import { starCatalog, type CatalogStar } from '../engine/sky';
import type { Difficulty, StarSystem } from '../engine/types';
import { solarDay } from '../engine/ephemeris';

let cacheKey = '';
let cached: { system: StarSystem; catalog: CatalogStar[]; solarDay: number } | null = null;

export function world(seed: number, difficulty: Difficulty) {
  const key = `${seed}:${difficulty}`;
  if (key !== cacheKey || !cached) {
    const { system } = generateSolvableSystem(seed, difficulty);
    cached = { system, catalog: starCatalog(system.seed), solarDay: solarDay(system) };
    cacheKey = key;
  }
  return cached;
}

export const randomSeed = () => Math.floor(Math.random() * 1e9);

/** Same system for everyone on a given UTC date. */
export function dailySeed(date = new Date()) {
  const s = `${date.getUTCFullYear()}${date.getUTCMonth() + 1}${date.getUTCDate()}`;
  return (Number(s) * 2654435761) >>> 0;
}
