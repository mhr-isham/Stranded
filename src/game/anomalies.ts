// Environmental episodes and assistance policy. New readings preserve chosen
// mitigation/corrections; instruments expose conditions in every mode, with
// optional methods. Legacy readings retain their original debrief fallback.

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
export const windBiases = (s: S, t: number, windscreen = false) => !windscreen && windAt(s, t) > 6 && ANOMALIES[s.settings.difficulty].announce !== 'corrected';

/** Extra refraction near the horizon on humid mornings (the dip looks smaller). */
export function rawHumidK(s: S, t: number) {
  const day = Math.floor(t / DAY);
  const hourOfDay = (t % DAY) / HOUR;
  return hourOfDay < 12 && u(s.seed, day, 0x5b1) < ANOMALIES[s.settings.difficulty].humid ? 0.12 + 0.1 * u(s.seed, day, 0x5b2) : 0;
}

/** Legacy saves keep their compensated sight; new runs record the apparent angle first. */
export const humidK = (s: S, t: number) => ANOMALIES[s.settings.difficulty].announce === 'corrected' ? 0 : rawHumidK(s, t);
export const instrumentHumidK = (s: S, t: number) => (s.settings.rulesetVersion ?? 1) >= 3 ? rawHumidK(s, t) : humidK(s, t);

/** A local air-probe calibration, with a shared calibration uncertainty.
 * It estimates episodic humidity only, not the full atmospheric profile.
 */
export function humidityCalibration(s: S, t: number) {
  const wet = rawHumidK(s, t);
  const offset = (u(s.seed, Math.floor(t / DAY), 0x5b3) - .5) * .02;
  return { k: Math.max(0, wet + offset), sigmaK: .02 };
}

/** Post-run condition review only. Sharp Eye uses recorded investigations. */
export function affectedReadings(s: S & Pick<GameState, 'readings'>): Reading[] {
  return s.readings.filter((r) => {
    const e = r.environment;
    if (e?.wind) return (e.wind.speed > 6 || (e.wind.endSpeed ?? 0) > 6) && e.wind.protection === 'none';
    if (e?.horizon) return e.horizon.damp && !e.horizon.correction;
    return (r.key === 'g' && windBiases(s, r.at)) || (r.key === 'R1' && humidK(s, r.at) > 0);
  });
}

export { sharpEyePoints } from './sharpEye';
