// Real anomalies (docs/DESIGN-V2.md §12.2): physical effects that bend some
// readings in a consistent direction. Each can be noticed and dealt with by a
// careful player. Easy modes correct them; Navigator points them out in the
// debrief; Astronomer and Legend leave them unannounced (Legend, more often).

import { DAY, HOUR } from '../engine/constants';
import { unitHash } from '../engine/rng';
import type { Difficulty } from '../engine/types';
import type { GameState, Reading } from './store';

export interface AnomalyRules {
  /** Share of nights with rough seeing. */
  rough: number;
  /** Share of days with a strong steady wind at the pendulum. */
  windy: number;
  /** Share of mornings with humid, refracting air at the hill. */
  humid: number;
  /** corrected: ECHO removes the effect and says so; debrief: shown after the run; silent: never mentioned during play. */
  announce: 'corrected' | 'debrief' | 'silent';
}

export const ANOMALIES: Record<Difficulty, AnomalyRules> = {
  stargazer: { rough: 0, windy: 0, humid: 0, announce: 'corrected' },
  cadet: { rough: 0, windy: 0.2, humid: 0.2, announce: 'corrected' },
  navigator: { rough: 0.15, windy: 0.2, humid: 0.2, announce: 'debrief' },
  astronomer: { rough: 0.2, windy: 0.25, humid: 0.25, announce: 'silent' },
  legend: { rough: 0.3, windy: 0.35, humid: 0.35, announce: 'silent' },
};

const u = (seed: number, day: number, k: number) => unitHash(seed, day, k);
type S = Pick<GameState, 'seed' | 'settings'>;

/** Wind speed at the pendulum today (m/s): mostly calm, sometimes a strong steady wind. */
export function windAt(s: S, t: number) {
  const day = Math.floor(t / DAY);
  const strong = u(s.seed, day, 0x3a1) < ANOMALIES[s.settings.difficulty].windy;
  return strong ? 7 + 5 * u(s.seed, day, 0x3a2) : 3 * u(s.seed, day, 0x3a3);
}

/** Sideways push of the wind on the bob, as a fraction of gravity (drag grows as the square of the speed). */
export const windPush = (v: number) => 0.12 * (v / 10) ** 2;

/** Does the wind actually bias the swing? (Easy modes: ECHO steadies the rig and says so.) */
export const windBiases = (s: S, t: number) => windAt(s, t) > 6 && ANOMALIES[s.settings.difficulty].announce !== 'corrected';

/** Extra refraction near the horizon on humid mornings (the dip looks smaller). */
export function humidK(s: S, t: number) {
  const day = Math.floor(t / DAY);
  const hourOfDay = (t % DAY) / HOUR;
  if (ANOMALIES[s.settings.difficulty].announce === 'corrected') return 0;
  return hourOfDay < 12 && u(s.seed, day, 0x5b1) < ANOMALIES[s.settings.difficulty].humid ? 0.12 + 0.1 * u(s.seed, day, 0x5b2) : 0;
}

/** Readings that a real anomaly bent (for the debrief and the Sharp Eye bonus). */
export function affectedReadings(s: S & Pick<GameState, 'readings'>): Reading[] {
  return s.readings.filter((r) => (r.key === 'g' && windBiases(s, r.at)) || (r.key === 'R1' && humidK(s, r.at) > 0));
}

/** Sharp Eye: points for each affected reading the player left out. */
export const sharpEyePoints = (s: S & Pick<GameState, 'readings'>) => 15 * affectedReadings(s).filter((r) => !r.kept).length;
