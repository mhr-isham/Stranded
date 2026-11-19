import type { LaunchResult } from '../engine/launch';
import type { PlayerModel } from '../engine/planner';

export interface ForecastSummary { attempted: number; succeeded: number; unsuccessful: number; unassessable: number }
/** Independent Gaussian draws can be outside the physical model's domain.
 * Keep those attempts visible rather than silently improving a success ratio. */
export function assessableModel(m: PlayerModel | null): m is PlayerModel {
  if (!m || ![m.P1, m.P2, m.S2, m.a1, m.a2, m.Mstar, m.M1, m.R1, m.M2, m.R2].every((v) => Number.isFinite(v) && v > 0) || !Number.isFinite(m.tOpp)) return false;
  if (m.ecc !== undefined && (!Number.isFinite(m.ecc) || m.ecc < 0 || m.ecc >= 1 || !Number.isFinite(m.peri))) return false;
  return !m.giant || [m.giant.a, m.giant.P, m.giant.M].every((v) => Number.isFinite(v) && v > 0) && Number.isFinite(m.giant.tOpp);
}
export function summarizeForecast(trials: (Pick<LaunchResult, 'outcome' | 'fuelLeft'> | null)[]): ForecastSummary {
  const summary: ForecastSummary = { attempted: trials.length, succeeded: 0, unsuccessful: 0, unassessable: 0 };
  for (const r of trials) {
    // The simulator deliberately uses -Infinity for an unreachable/lost path.
    // Other nonfinite fuel values cannot support a numerical outcome forecast.
    if (!r || !Number.isFinite(r.fuelLeft) && !(r.outcome === 'lost' && r.fuelLeft === -Infinity)) summary.unassessable++;
    else if (r.outcome === 'success' && Number.isFinite(r.fuelLeft) && r.fuelLeft >= 0) summary.succeeded++;
    else if (['flyby', 'lost', 'no-escape', 'expired'].includes(r.outcome)) summary.unsuccessful++;
    else summary.unassessable++;
  }
  return summary;
}
