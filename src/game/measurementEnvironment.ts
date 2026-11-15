import type { Reading } from './store';

/** Observed conditions and chosen treatment, frozen when a measurement is made. */
export interface MeasurementEnvironment {
  instrument: 'pendulum' | 'horizon' | 'telescope';
  at: number;
  rawValue: number;
  wind?: { speed: number; endSpeed?: number; protection: 'none' | 'windscreen' | 'echo'; changed?: boolean };
  horizon?: {
    height: number; station: string; rawAngle: number; usedAngle: number; damp: boolean; legacyCompensated?: boolean;
    correction?: { source: 'player' | 'echo-humidity'; k: number; sigmaK: number; sigmaValue: number; sampledAt?: number };
  };
  seeing?: { factor: number; frozen: boolean };
}

/** The apparent dip model is theta_app = theta_geometric sqrt(1-k).
 * k is an entered estimate, not a lookup of the planet's radius or true k.
 */
export function correctHorizon(height: number, apparent: number, k = 0, sigmaK = 0) {
  if (![height, apparent, k, sigmaK].every(Number.isFinite) || height <= 0 || apparent <= 0 || k < 0 || k > .85 || sigmaK < 0 || k + sigmaK >= .95) return null;
  const angle = apparent / Math.sqrt(1 - k);
  if (angle >= Math.PI / 2) return null;
  // 2 sin²(theta/2) avoids cancellation at small dip angles.
  const denominator = 2 * Math.sin(angle / 2) ** 2;
  const radius = height * Math.cos(angle) / denominator;
  const sigmaValue = height * Math.sin(angle) / denominator ** 2 * angle / (2 * (1 - k)) * sigmaK;
  return Number.isFinite(radius) && Number.isFinite(sigmaValue) ? { angle, radius, sigmaValue } : null;
}

/** A conservative shared model contribution: repeating does not divide it by sqrt(n). */
export function conditionUncertainty(readings: Reading[]) {
  return Math.max(0, ...readings.filter((r) => r.kept).map((r) => r.environment?.horizon?.correction?.sigmaValue ?? 0));
}

export function conditionSummary(e: MeasurementEnvironment) {
  if (e.wind) return `${e.wind.speed.toFixed(1)}${e.wind.changed && e.wind.endSpeed !== undefined ? ` → ${e.wind.endSpeed.toFixed(1)}` : ''} m/s wind · ${e.wind.protection === 'echo' ? 'ECHO stabilization' : e.wind.protection === 'windscreen' ? 'windscreen fitted' : 'exposed rig'}${e.wind.changed ? ' · conditions changed during timing' : ''}`;
  if (e.horizon) return `${e.horizon.legacyCompensated ? 'Legacy compensated sight' : e.horizon.damp ? 'Damp air' : 'No damp episode'} · ${e.horizon.correction ? e.horizon.correction.source === 'echo-humidity' ? 'ECHO humidity correction' : 'your refraction correction' : 'displayed angle kept'}`;
  return `${e.seeing && e.seeing.factor > 1.5 ? 'Turbulent' : 'Steadier'} image${e.seeing?.frozen ? ' · frozen exposure pair' : ''}`;
}
